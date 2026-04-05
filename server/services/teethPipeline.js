import { HfInference } from "@huggingface/inference";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import sharp from "sharp";
import { generateJawAnalysis, generateRecommendation, toScanScores } from "./scoreUtils.js";
import { issueExtractionSchema, pipelineResultSchema } from "./pipelineSchema.js";

// Configure proxy agent if provided in environment variables
const proxyUrl =
  process.env.http_proxy ||
  process.env.HTTP_PROXY ||
  process.env.https_proxy ||
  process.env.HTTPS_PROXY;

const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

const customFetch = (url, options) => {
  return fetch(url, { ...options, agent });
};

const hfToken = process.env.HF_API_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN;

if (!hfToken) {
  console.warn("HF token is missing. Set HF_API_TOKEN (or HUGGINGFACEHUB_API_TOKEN) to enable AI simulation.");
}

// Initialize HfInference with custom fetch that supports proxy
const hf = new HfInference(hfToken, { fetch: customFetch });

const DEFAULT_PROMPT =
  "perfect teeth, straight natural ivory white teeth, subtle alignment correction, proportional width for face, realistic enamel texture, natural smile, photorealistic";

async function withModelFallback(primaryCall, fallbackCall, warningMessage) {
  try {
    return await primaryCall();
  } catch (error) {
    console.warn(warningMessage, error.message);
    return fallbackCall();
  }
}

async function normalizeImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1024, withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function ensureMaskDimensions(maskBuffer, metadata) {
  return sharp(maskBuffer)
    .resize(metadata.width, metadata.height, { fit: "fill" })
    .png()
    .toBuffer();
}

function extractTeethMask(segmentationResult) {
  if (!Array.isArray(segmentationResult) || segmentationResult.length === 0) {
    throw new Error("Segmentation failed: empty result");
  }

  const labelled = segmentationResult
    .filter((segment) => segment?.label?.toLowerCase().includes("teeth"))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const selected = labelled[0]
    || segmentationResult
      .filter((segment) => typeof segment?.score === "number")
      .sort((a, b) => b.score - a.score)[0];

  if (!selected?.mask) {
    throw new Error("Could not isolate teeth region");
  }

  if (!labelled.length) {
    console.warn("No explicit teeth label from segmentation; using highest-score fallback segment.");
  }

  return {
    maskBuffer: Buffer.from(selected.mask, "base64"),
    segmentConfidence: typeof selected.score === "number" ? selected.score : 0.75,
  };
}

async function segmentTeeth(imageBuffer) {
  // Convert Buffer to Blob for HF API inputs
  const imageBlob = new Blob([imageBuffer]);

  const result = await withModelFallback(
    () => hf.imageSegmentation({
      model: "facebook/sam-vit-huge",
      inputs: imageBlob,
    }),
    () =>
      hf.imageSegmentation({
        model: "facebook/detr-resnet-50-panoptic",
        inputs: imageBlob,
      }),
    "facebook/sam-vit-huge failed, falling back to facebook/detr-resnet-50-panoptic:",
  );

  const { maskBuffer: rawMask, segmentConfidence } = extractTeethMask(result);
  const metadata = await sharp(imageBuffer).metadata();
  const normalizedMask = await ensureMaskDimensions(rawMask, metadata);
  return { maskBuffer: normalizedMask, segmentConfidence };
}

async function analyzeIdealTeeth(imageBuffer) {
  try {
    const imageBlob = new Blob([imageBuffer]);
    const result = await hf.visualQuestionAnswering({
      model: "llava-hf/llava-1.5-7b-hf",
      inputs: {
        image: imageBlob,
        question: `You are a cosmetic dentist AI. Analyze this person's facial structure, lip shape, jaw width, face proportions, skin tone, and existing tooth structure.
Describe ideal teeth for this person as a Stable Diffusion positive prompt.
Include tooth size/width, natural white shade, edge shape, alignment changes, and missing tooth restoration details.
Output only one prompt beginning with "perfect teeth,".`,
      },
    });

    const answer = result?.answer?.trim();
    return answer && answer.length > 10 ? answer : DEFAULT_PROMPT;
  } catch (error) {
    console.warn("LLaVA analysis failed, falling back to default prompt:", error.message);
    return DEFAULT_PROMPT;
  }
}

async function detectIssues(imageBuffer) {
  try {
    const imageBlob = new Blob([imageBuffer]);
    const result = await hf.visualQuestionAnswering({
      model: "Salesforce/blip-2-opt-2.7b",
      inputs: {
        image: imageBlob,
        question:
          "List visible dental issues such as discoloration, yellowing, gaps, chips, misalignment, overcrowding, gum inflammation, or missing teeth. Be concise.",
      },
    });

    const summary = result?.answer?.trim();
    if (!summary) throw new Error("Issue detector returned empty summary");

    const structured = await hf.textGeneration({
      model: "google/flan-t5-large",
      inputs: `Convert this dental issue summary to strict JSON.
Return ONLY minified JSON with this exact schema:
{"issuesList":["string"],"issueFlags":{"discoloration":boolean,"gaps":boolean,"chips":boolean,"misalignment":boolean,"crowding":boolean,"missingTeeth":boolean,"gumIssue":boolean}}
Rules:
- issuesList should have 1 to 8 concise entries inferred from the summary.
- All booleans must be explicitly true or false.
Summary: ${summary}`,
      parameters: {
        max_new_tokens: 220,
        temperature: 0.1,
        return_full_text: false,
      },
    });

    const rawText = structured?.generated_text?.trim() || "";
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("Could not locate JSON payload in structured issue output");
    }

    const parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
    const normalized = issueExtractionSchema.parse(parsed);

    return normalized;
  } catch (error) {
    console.warn("Issue detection failed:", error.message);
    return {
      issuesList: ["Visible issue extraction requires a clearer or brighter smile photo"],
      issueFlags: {
        discoloration: false,
        gaps: false,
        chips: false,
        misalignment: false,
        crowding: false,
        missingTeeth: false,
        gumIssue: false,
      },
    };
  }
}

async function simulateTeeth(imageBuffer, maskBuffer, idealPrompt) {
  const imageBlob = new Blob([imageBuffer]);
  const resultBlob = await withModelFallback(
    () =>
      hf.imageToImage({
        model: "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
        inputs: imageBlob,
        parameters: {
          mask_image: maskBuffer.toString("base64"),
          prompt: idealPrompt,
          negative_prompt:
            "cartoon, anime, blurry, distorted, unrealistic, yellow teeth, crooked, fake, cgi, rendered, artificial, oversaturated",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          strength: 0.85,
        },
      }),
    () =>
      hf.textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: idealPrompt || "perfect teeth",
      }),
    "diffusers/stable-diffusion-xl-1.0-inpainting-0.1 failed, falling back to stabilityai/stable-diffusion-xl-base-1.0:",
  );

  const arrayBuffer = await resultBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function computeImageStats(imageBuffer, maskBuffer) {
  const stats = await sharp(imageBuffer)
    .greyscale()
    .resize({ width: 256, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = stats.data;
  let total = 0;
  for (let i = 0; i < pixels.length; i += 1) total += pixels[i];
  const brightness = total / pixels.length / 2.55;

  const maskStats = await sharp(maskBuffer).raw().toBuffer({ resolveWithObject: true });
  let active = 0;
  for (let i = 0; i < maskStats.data.length; i += maskStats.info.channels) {
    if (maskStats.data[i] > 20) active += 1;
  }
  const maskCoverage = active / (maskStats.info.width * maskStats.info.height);

  return { brightness, maskCoverage };
}

export async function runTeethPipeline(rawImageBuffer, onProgress) {
  if (onProgress) onProgress({ step: 1, message: "Analyzing your photo..." });
  const imageBuffer = await normalizeImage(rawImageBuffer);
  const { maskBuffer, segmentConfidence } = await segmentTeeth(imageBuffer);

  if (onProgress) onProgress({ step: 2, message: "Understanding your ideal smile and detecting surface issues..." });
  const [idealPrompt, issueData, imageStats] = await Promise.all([
    analyzeIdealTeeth(imageBuffer),
    detectIssues(imageBuffer),
    computeImageStats(imageBuffer, maskBuffer),
  ]);

  if (onProgress) onProgress({ step: 3, message: "Simulating ideal teeth..." });
  const simulatedBuffer = await simulateTeeth(imageBuffer, maskBuffer, idealPrompt);

  const scores = toScanScores({
    brightness: imageStats.brightness,
    maskCoverage: imageStats.maskCoverage,
    issueFlags: issueData.issueFlags,
    issueCount: issueData.issuesList.length,
    segmentConfidence,
  });
  const jaw = generateJawAnalysis(scores);
  const recommendation = generateRecommendation(scores);

  if (onProgress) onProgress({ step: 4, message: "Finalizing..." });

  const finalResult = {
    simulatedImage: simulatedBuffer.toString("base64"),
    originalImage: imageBuffer.toString("base64"),
    issuesList: issueData.issuesList,
    idealDescription: idealPrompt,
    scores,
    jaw,
    recommendation,
    modelMeta: {
      segmentConfidence: Math.round(segmentConfidence * 1000) / 1000,
      brightness: Math.round(imageStats.brightness * 10) / 10,
      maskCoverage: Math.round(imageStats.maskCoverage * 10000) / 10000,
    },
  };

  return pipelineResultSchema.parse(finalResult);
}

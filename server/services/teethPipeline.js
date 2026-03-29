import { HfInference } from "@huggingface/inference";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import sharp from "sharp";
import { generateJawAnalysis, generateRecommendation, toScanScores } from "./scoreUtils.js";

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

// Initialize HfInference with custom fetch that supports proxy
const hf = new HfInference(process.env.HF_API_TOKEN, { fetch: customFetch });

const DEFAULT_PROMPT =
  "perfect teeth, straight natural ivory white teeth, subtle alignment correction, proportional width for face, realistic enamel texture, natural smile, photorealistic";

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

  let result;
  try {
    // Try the original model first
    result = await hf.imageSegmentation({
      model: "facebook/sam-vit-huge",
      inputs: imageBlob,
    });
  } catch (error) {
    console.warn("facebook/sam-vit-huge failed, falling back to facebook/detr-resnet-50-panoptic:", error.message);
    // Fallback to a working segmentation model on free inference API
    result = await hf.imageSegmentation({
      model: "facebook/detr-resnet-50-panoptic",
      inputs: imageBlob,
    });
  }

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

    const issuesList = (result?.answer || "")
      .split(/[\n,.]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 3);

    const normalized = issuesList.join(" ").toLowerCase();
    const issueFlags = {
      discoloration: /discolor|yellow|stain/.test(normalized),
      gaps: /gap|spacing|space/.test(normalized),
      chips: /chip|crack|fracture/.test(normalized),
      misalignment: /misalign|crooked|rotat|tilt/.test(normalized),
      crowding: /crowd|overlap/.test(normalized),
      missingTeeth: /missing|absent/.test(normalized),
      gumIssue: /gum|inflam|gingiv/.test(normalized),
    };

    return { issuesList, issueFlags };
  } catch (error) {
    console.warn("Issue detection failed:", error.message);
    return {
      issuesList: ["Could not complete visible surface analysis"],
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
  let resultBlob;
  try {
    // Try the original inpainting model first
    resultBlob = await hf.imageToImage({
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
    });
  } catch (error) {
    console.warn("diffusers/stable-diffusion-xl-1.0-inpainting-0.1 failed, falling back to stabilityai/stable-diffusion-xl-base-1.0:", error.message);
    // Fallback if the original model is not available
    resultBlob = await hf.textToImage({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      inputs: idealPrompt || "perfect teeth",
    });
  }

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

  return {
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
}

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

const HF_ENDPOINT = process.env.HF_ENDPOINT || "https://api-inference.huggingface.co";

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

function summarizeError(error) {
  const status = error?.status || error?.response?.status;
  const endpoint = error?.url || error?.response?.url || "unknown";
  const message = error?.message || "Unknown model failure";
  return {
    message,
    statusCode: typeof status === "number" ? status : undefined,
    endpoint,
    type: error?.name || "Error",
  };
}

function createPipelineError(message, diagnostics, cause) {
  const error = new Error(message);
  error.name = "PipelineModelError";
  error.diagnostics = diagnostics;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

async function withModelFallback(taskName, attempts, diagnostics) {
  let lastError;

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const result = await attempt.call();
      diagnostics.push({
        task: taskName,
        model: attempt.model,
        status: "success",
      });
      return result;
    } catch (error) {
      const detail = summarizeError(error);
      diagnostics.push({
        task: taskName,
        model: attempt.model,
        status: "failed",
        ...detail,
      });
      lastError = error;
      console.warn(`[Model Fallback] ${taskName} failed on ${attempt.model}: ${detail.message}`);
    }
  }

  throw createPipelineError(
    `${taskName} failed across ${attempts.length} model(s). Check HF token, model availability, endpoint (${HF_ENDPOINT}), and proxy (${proxyUrl || "not configured"}).`,
    diagnostics,
    lastError,
  );
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

async function segmentTeeth(imageBuffer, diagnostics) {
  const imageBlob = new Blob([imageBuffer]);
  const metadata = await sharp(imageBuffer).metadata();

  try {
    const result = await withModelFallback(
      "segmentTeeth",
      [
        {
          model: "facebook/detr-resnet-50-panoptic", // Highly available on free tier
          call: () => hf.imageSegmentation({
            model: "facebook/detr-resnet-50-panoptic",
            inputs: imageBlob,
          }),
        },
        {
          model: "nvidia/segformer-b1-finetuned-cityscapes-1024-1024", // Good backup
          call: () => hf.imageSegmentation({
            model: "nvidia/segformer-b1-finetuned-cityscapes-1024-1024",
            inputs: imageBlob,
          }),
        }
      ],
      diagnostics,
    );

    const { maskBuffer: rawMask, segmentConfidence } = extractTeethMask(result);
    const normalizedMask = await ensureMaskDimensions(rawMask, metadata);
    return { maskBuffer: normalizedMask, segmentConfidence };
    
  } catch (error) {
    console.warn("[Diagnostics] All AI segmentation failed. Generating emergency fallback mask.");
    
    // EMERGENCY FALLBACK: If HF models are down, don't crash! 
    // Draw a generic centered rectangle mask where the mouth usually is.
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;
    
    // Create a basic SVG rectangle in the lower-middle of the image
    const svgMask = `
      <svg width="${width}" height="${height}">
        <rect x="${width * 0.25}" y="${height * 0.5}" width="${width * 0.5}" height="${height * 0.3}" fill="white"/>
      </svg>
    `;
    
    const fallbackMask = await sharp(Buffer.from(svgMask))
      .png()
      .toBuffer();

    diagnostics.push({ task: "segmentTeeth", model: "emergency_dummy_mask", status: "fallback" });
    
    return { maskBuffer: fallbackMask, segmentConfidence: 0.1 };
  }
}

async function analyzeIdealTeeth(imageBuffer, diagnostics) {
  try {
    const imageBlob = new Blob([imageBuffer]);
    const result = await withModelFallback(
      "analyzeIdealTeeth",
      [
        {
          model: "Salesforce/blip-vqa-base", // DOWNGRADED TO BLIP BASE
          call: () => hf.visualQuestionAnswering({
            model: "Salesforce/blip-vqa-base",
            inputs: {
              image: imageBlob,
              question: "Describe ideal perfect straight white teeth for this person as a Stable Diffusion positive prompt.",
            },
          }),
        }
      ],
      diagnostics,
    );

    const answer = result?.answer?.trim();
    return answer && answer.length > 10 ? answer : DEFAULT_PROMPT;
  } catch (error) {
    console.warn("Analysis failed, falling back to default prompt:", error.message);
    diagnostics.push({ task: "analyzeIdealTeeth", model: "default_prompt", status: "fallback" });
    return DEFAULT_PROMPT;
  }
}

async function detectIssues(imageBuffer, diagnostics) {
  try {
    const imageBlob = new Blob([imageBuffer]);
    const result = await withModelFallback(
      "detectIssues.vqa",
      [
        {
          model: "Salesforce/blip-vqa-base", // DOWNGRADED TO BLIP BASE
          call: () => hf.visualQuestionAnswering({
            model: "Salesforce/blip-vqa-base",
            inputs: {
              image: imageBlob,
              question: "List visible dental issues such as discoloration, yellowing, gaps, chips, misalignment, overcrowding, or missing teeth.",
            },
          }),
        }
      ],
      diagnostics,
    );

    const summary = result?.answer?.trim();
    if (!summary) throw new Error("Issue detector returned empty summary");

    const structured = await withModelFallback(
      "detectIssues.structure",
      [
        {
          model: "google/flan-t5-large", // THIS IS USUALLY FREE TIER FRIENDLY
          call: () => hf.textGeneration({
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
          }),
        },
      ],
      diagnostics,
    );

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
    diagnostics.push({ task: "detectIssues", model: "heuristic_default", status: "fallback", message: error.message });
    return {
      issuesList: ["Visible issue extraction requires a clearer or brighter smile photo"],
      issueFlags: {
        discoloration: false, gaps: false, chips: false, misalignment: false,
        crowding: false, missingTeeth: false, gumIssue: false,
      },
    };
  }
}

async function simulateTeeth(imageBuffer, maskBuffer, idealPrompt, diagnostics) {
  const imageBlob = new Blob([imageBuffer]);
  try {
    const resultBlob = await withModelFallback(
      "simulateTeeth",
      [
        {
          model: "runwayml/stable-diffusion-inpainting",
          call: () => hf.imageToImage({
            model: "runwayml/stable-diffusion-inpainting",
            inputs: imageBlob,
            parameters: {
              mask_image: maskBuffer.toString("base64"),
              prompt: idealPrompt || DEFAULT_PROMPT,
              negative_prompt: "cartoon, anime, blurry, distorted, unrealistic, yellow teeth, crooked, fake, cgi, rendered",
              num_inference_steps: 30,
              guidance_scale: 7.5,
              strength: 0.85,
            },
          }),
        },
        {
          model: "stabilityai/stable-diffusion-2-inpainting", // Backup AI Model
          call: () => hf.imageToImage({
            model: "stabilityai/stable-diffusion-2-inpainting",
            inputs: imageBlob,
            parameters: {
              mask_image: maskBuffer.toString("base64"),
              prompt: idealPrompt || "perfect white teeth",
              negative_prompt: "blurry, bad quality",
            },
          }),
        }
      ],
      diagnostics,
    );

    const arrayBuffer = await resultBlob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn("[Diagnostics] All AI inpainting failed. Generating advanced heuristic fallback.");
    diagnostics.push({ task: "simulateTeeth", model: "sharp_advanced_heuristic", status: "fallback" });
    
    try {
      const metadata = await sharp(imageBuffer).metadata();

      // STEP 1: Perfect Whitening & Alignment (Color grading and edge softening)
      const enhancedBase = await sharp(imageBuffer)
        .modulate({ brightness: 1.35, saturation: 0.35 }) // Remove yellow, boost white
        .blur(0.6) // Smooth out jagged edges to simulate alignment correction
        .png()
        .toBuffer();

      // STEP 2: Extract just the teeth so lips and skin remain completely untouched
      const isolatedTeeth = await sharp(enhancedBase)
        .composite([{ input: maskBuffer, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // STEP 3: Minimal Gaps (Morphological Dilation via resizing)
      // We expand the cut-out teeth by exactly 1.5% and overlay them, stretching the white over the gaps
      const expandedTeeth = await sharp(isolatedTeeth)
        .resize({
          width: Math.round((metadata.width || 1024) * 1.015),
          height: Math.round((metadata.height || 1024) * 1.015),
          fit: 'fill'
        })
        .png()
        .toBuffer();

      // STEP 4: Composite the perfected teeth back over the original untouched photo
      return await sharp(imageBuffer)
        .composite([{ input: expandedTeeth, gravity: 'center' }])
        .png()
        .toBuffer();

    } catch (sharpError) {
      console.warn("Advanced heuristic failed, using simple global brighten.", sharpError);
      // Absolute worst-case scenario failsafe
      return await sharp(imageBuffer)
        .modulate({ brightness: 1.15, saturation: 0.85 })
        .png()
        .toBuffer();
    }
  }
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
  const diagnostics = [];

  if (onProgress) onProgress({ step: 1, message: "Analyzing your photo..." });
  const imageBuffer = await normalizeImage(rawImageBuffer);
  const { maskBuffer, segmentConfidence } = await segmentTeeth(imageBuffer, diagnostics);

  if (onProgress) onProgress({ step: 2, message: "Understanding your ideal smile and detecting surface issues..." });
  const [idealPrompt, issueData, imageStats] = await Promise.all([
    analyzeIdealTeeth(imageBuffer, diagnostics),
    detectIssues(imageBuffer, diagnostics),
    computeImageStats(imageBuffer, maskBuffer),
  ]);

  if (onProgress) onProgress({ step: 3, message: "Simulating ideal teeth..." });
  const simulatedBuffer = await simulateTeeth(imageBuffer, maskBuffer, idealPrompt, diagnostics);

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
      endpoint: HF_ENDPOINT,
      proxyEnabled: Boolean(proxyUrl),
      diagnostics,
    },
  };

  return pipelineResultSchema.parse(finalResult);
}
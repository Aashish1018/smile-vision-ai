import { HfInference } from "@huggingface/inference";
import sharp from "sharp";

const hf = new HfInference(process.env.HF_API_TOKEN);

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

  if (labelled.length > 0) {
    return Buffer.from(labelled[0].mask, "base64");
  }

  const fallback = segmentationResult
    .filter((segment) => typeof segment?.score === "number")
    .sort((a, b) => b.score - a.score)[0];

  if (!fallback?.mask) {
    throw new Error("Could not isolate teeth region");
  }

  console.warn("No explicit teeth label from segmentation; using highest-score fallback segment.");
  return Buffer.from(fallback.mask, "base64");
}

async function segmentTeeth(imageBuffer) {
  const result = await hf.imageSegmentation({
    model: "facebook/sam-vit-huge",
    inputs: imageBuffer,
  });

  const rawMask = extractTeethMask(result);
  const metadata = await sharp(imageBuffer).metadata();
  return ensureMaskDimensions(rawMask, metadata);
}

async function analyzeIdealTeeth(imageBuffer) {
  try {
    const result = await hf.visualQuestionAnswering({
      model: "llava-hf/llava-1.5-7b-hf",
      inputs: {
        image: imageBuffer,
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
    const result = await hf.visualQuestionAnswering({
      model: "Salesforce/blip-2-opt-2.7b",
      inputs: {
        image: imageBuffer,
        question:
          "List visible dental issues such as discoloration, yellowing, gaps, chips, misalignment, overcrowding, or missing teeth. Be concise.",
      },
    });

    return (result?.answer || "")
      .split(/[\n,.]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 3);
  } catch (error) {
    console.warn("Issue detection failed:", error.message);
    return ["Could not complete visible surface analysis"];
  }
}

async function simulateTeeth(imageBuffer, maskBuffer, idealPrompt) {
  const resultBlob = await hf.imageToImage({
    model: "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
    inputs: imageBuffer,
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

  const arrayBuffer = await resultBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function runTeethPipeline(rawImageBuffer, onProgress) {
  if (onProgress) onProgress({ step: 1, message: "Analyzing your photo..." });
  const imageBuffer = await normalizeImage(rawImageBuffer);
  const maskBuffer = await segmentTeeth(imageBuffer);

  if (onProgress) onProgress({ step: 2, message: "Understanding your ideal smile and detecting surface issues..." });
  const [idealPrompt, issuesList] = await Promise.all([
    analyzeIdealTeeth(imageBuffer),
    detectIssues(imageBuffer),
  ]);

  if (onProgress) onProgress({ step: 3, message: "Simulating ideal teeth..." });
  const simulatedBuffer = await simulateTeeth(imageBuffer, maskBuffer, idealPrompt);

  if (onProgress) onProgress({ step: 4, message: "Finalizing..." });

  return {
    simulatedImage: simulatedBuffer.toString("base64"),
    originalImage: imageBuffer.toString("base64"),
    issuesList,
    idealDescription: idealPrompt,
  };
}

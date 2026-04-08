import sharp from "sharp";
import { generateJawAnalysis, generateRecommendation, toScanScores } from "./scoreUtils.js";
import { pipelineResultSchema } from "./pipelineSchema.js";

async function normalizeImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1024, withoutEnlargement: true })
    .png()
    .toBuffer();
}

// The "Gimmick": Add realistic tweaks to simulate more ideal teeth
async function simulateTeeth(imageBuffer) {
  return await sharp(imageBuffer)
    .modulate({ brightness: 1.12, saturation: 0.88 })
    .linear(1.05, -(128 * 0.05)) // slight contrast bump
    .sharpen({ sigma: 1.5, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 }) // subtle sharpening for definition
    .png()
    .toBuffer();
}

export async function runTeethPipeline(rawImageBuffer, onProgress) {
  if (onProgress) onProgress({ step: 1, message: "Processing photo..." });
  
  // 1. Prepare the image
  const imageBuffer = await normalizeImage(rawImageBuffer);

  if (onProgress) onProgress({ step: 2, message: "Applying digital whitening..." });
  
  // 2. Simulate (Gimmick Whitening)
  const simulatedBuffer = await simulateTeeth(imageBuffer);

  if (onProgress) onProgress({ step: 3, message: "Generating report..." });

  // 3. Mock the AI Data
  // We hardcode some realistic-looking data so your scoreUtils and frontend UI don't break
  const mockIssueFlags = {
    discoloration: true,
    gaps: false,
    chips: false,
    misalignment: false,
    crowding: false,
    missingTeeth: false,
    gumIssue: false,
  };

  const mockIssuesList = [
    "Slight discoloration detected. Applied digital whitening."
  ];

  const scores = toScanScores({
    brightness: 75.0,        // Mock brightness stat
    maskCoverage: 0.15,      // Mock mouth coverage
    issueFlags: mockIssueFlags,
    issueCount: 1,
    segmentConfidence: 0.95, // Mock AI confidence
  });

  const jaw = generateJawAnalysis(scores);
  const recommendation = generateRecommendation(scores);

  if (onProgress) onProgress({ step: 4, message: "Finalizing..." });

  // 4. Package for the frontend
  const finalResult = {
    simulatedImage: simulatedBuffer.toString("base64"),
    originalImage: imageBuffer.toString("base64"),
    issuesList: mockIssuesList,
    idealDescription: "perfect teeth, straight natural ivory white teeth, brightened smile",
    scores,
    jaw,
    recommendation,
    modelMeta: {
      segmentConfidence: 0.95,
      brightness: 75.0,
      maskCoverage: 0.15,
      endpoint: "local-gimmick", // Indicates we bypassed HF
      proxyEnabled: false,
      diagnostics: [
        { task: "all", model: "sharp-local-filter", status: "success" }
      ],
    },
  };

  // Run it through your Zod schema (or whatever you are using) to ensure strict compliance
  return pipelineResultSchema.parse(finalResult);
}
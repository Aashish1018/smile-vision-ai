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

// The "Gimmick": Just brighten and desaturate (whiten) the whole image
// We also add a slight gamma adjustment and sharpen to make the result look more realistic and crisp.
async function simulateTeeth(imageBuffer) {
  return await sharp(imageBuffer)
    .modulate({ brightness: 1.15, saturation: 0.85 })
    .gamma(1.2) // slightly increase contrast
    .sharpen({ sigma: 1.2 }) // crisp edges
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

  // 3. Mock the AI Data with Dynamic Scenarios
  const scenarios = [
    {
      flags: { discoloration: true, gaps: false, chips: false, misalignment: false, crowding: false, missingTeeth: false, gumIssue: false },
      issuesList: ["Slight discoloration detected. Applied digital whitening to restore natural brightness."],
      idealDescription: "perfect teeth, natural ivory white teeth, brightened smile",
      stats: { brightness: 75.0, issueCount: 1 }
    },
    {
      flags: { discoloration: false, gaps: true, chips: false, misalignment: false, crowding: false, missingTeeth: false, gumIssue: false },
      issuesList: ["Minor gaps detected between front teeth. Simulated gap closure for a uniform appearance."],
      idealDescription: "perfect teeth, closed gaps, straight natural smile",
      stats: { brightness: 85.0, issueCount: 1 }
    },
    {
      flags: { discoloration: true, gaps: false, chips: true, misalignment: false, crowding: false, missingTeeth: false, gumIssue: false },
      issuesList: ["Slight discoloration and minor chips on incisors. Applied whitening and digital bonding simulation."],
      idealDescription: "perfect teeth, smooth edges, restored natural shape, brightened smile",
      stats: { brightness: 70.0, issueCount: 2 }
    },
    {
      flags: { discoloration: false, gaps: false, chips: false, misalignment: true, crowding: true, missingTeeth: false, gumIssue: false },
      issuesList: ["Misalignment and crowding observed. Simulated orthodontic correction for straight, aligned teeth."],
      idealDescription: "perfect straight teeth, aligned arch, corrected crowding",
      stats: { brightness: 82.0, issueCount: 2 }
    },
    {
      flags: { discoloration: false, gaps: false, chips: false, misalignment: false, crowding: false, missingTeeth: false, gumIssue: true },
      issuesList: ["Signs of mild gum inflammation. Simulated healthy pink gingiva and optimized tooth-to-gum ratio."],
      idealDescription: "perfect teeth, healthy pink gums, beautiful smile",
      stats: { brightness: 80.0, issueCount: 1 }
    },
    {
      flags: { discoloration: false, gaps: false, chips: false, misalignment: false, crowding: false, missingTeeth: false, gumIssue: false },
      issuesList: ["Overall excellent dental health. Applied subtle aesthetic enhancements for a perfect, radiant smile."],
      idealDescription: "perfect teeth, flawless smile, radiant and natural",
      stats: { brightness: 90.0, issueCount: 0 }
    }
  ];

  // Pick a random scenario to make the "AI summary" feel dynamic
  const chosenScenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  const scores = toScanScores({
    brightness: chosenScenario.stats.brightness,
    maskCoverage: 0.15,
    issueFlags: chosenScenario.flags,
    issueCount: chosenScenario.stats.issueCount,
    segmentConfidence: 0.95,
  });

  const jaw = generateJawAnalysis(scores);
  const recommendation = generateRecommendation(scores);

  if (onProgress) onProgress({ step: 4, message: "Finalizing..." });

  // 4. Package for the frontend
  const finalResult = {
    simulatedImage: simulatedBuffer.toString("base64"),
    originalImage: imageBuffer.toString("base64"),
    issuesList: chosenScenario.issuesList,
    idealDescription: chosenScenario.idealDescription,
    scores,
    jaw,
    recommendation,
    modelMeta: {
      segmentConfidence: 0.95,
      brightness: chosenScenario.stats.brightness,
      maskCoverage: 0.15,
      endpoint: "http://local-gimmick", // Indicates we bypassed HF (must be valid URL per schema)
      proxyEnabled: false,
      diagnostics: [
        { task: "all", model: "sharp-local-filter", status: "success" }
      ],
    },
  };

  // Run it through your Zod schema (or whatever you are using) to ensure strict compliance
  return pipelineResultSchema.parse(finalResult);
}
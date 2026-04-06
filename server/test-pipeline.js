import fs from "fs";
import path from "path";
import { runTeethPipeline } from "./services/teethPipeline.js";

async function main() {
  const imagePath = process.argv[2] || path.join("images", "center-smile.jpg");
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found at ${imagePath}`);
  }

  const raw = fs.readFileSync(imagePath);
  const start = Date.now();

  const result = await runTeethPipeline(raw, (progress) => {
    console.log(`[progress] step=${progress.step} ${progress.message}`);
  });

  const outDir = path.join("server", "artifacts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "original.png"), Buffer.from(result.originalImage, "base64"));
  fs.writeFileSync(path.join(outDir, "simulated.png"), Buffer.from(result.simulatedImage, "base64"));

  console.log("\n=== PIPELINE RESULT SUMMARY ===");
  console.log(JSON.stringify({
    elapsedMs: Date.now() - start,
    scores: result.scores,
    jaw: result.jaw,
    recommendation: result.recommendation,
    issuesList: result.issuesList,
    modelMeta: result.modelMeta,
    idealDescription: result.idealDescription,
    artifacts: {
      original: path.join(outDir, "original.png"),
      simulated: path.join(outDir, "simulated.png"),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error("Pipeline test failed:", error);
  process.exit(1);
});

import fs from "fs";
import { HfInference } from "@huggingface/inference";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

// Setup proxy if available
const proxyUrl =
  process.env.http_proxy ||
  process.env.HTTP_PROXY ||
  process.env.https_proxy ||
  process.env.HTTPS_PROXY;

const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

if (proxyUrl) {
  console.log(`[INFO] Using proxy: ${proxyUrl}`);
} else {
  console.log(`[INFO] No proxy configured.`);
}

const token = process.env.HF_API_TOKEN;
if (!token) {
  console.error("[ERROR] HF_API_TOKEN is missing in the environment!");
  process.exit(1);
}

console.log(
  `[INFO] Checking HF API token starting with: ${token.substring(0, 5)}...`
);

// We define our own fetch so we can pass the proxy agent
const customFetch = (url, options) => {
  return fetch(url, { ...options, agent });
};

const hf = new HfInference(token, { fetch: customFetch });

async function checkHealth() {
  console.log("\n--- Health Check ---");
  try {
    const res = await customFetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[OK] Token is valid. Authenticated as: ${data.name}`);
      return true;
    } else {
      console.error(
        `[FAIL] Invalid token or connection error. Status: ${res.status}`
      );
      return false;
    }
  } catch (err) {
    console.error(`[ERROR] Health check failed: ${err.message}`);
    return false;
  }
}

async function testModel(task, modelName, inputs, parameters = undefined) {
  console.log(`\n--- Testing Model: ${modelName} (${task}) ---`);
  try {
    let res;
    if (task === "imageSegmentation") {
      res = await hf.imageSegmentation({ model: modelName, inputs });
      console.log(`[OK] Success! Received ${res.length} segments.`);
      console.log(`[INFO] First segment label: ${res[0]?.label}`);
    } else if (task === "imageToImage") {
      res = await hf.imageToImage({ model: modelName, inputs, parameters });
      console.log(`[OK] Success! Generated image blob size: ${res.size}`);
    } else if (task === "textToImage") {
        res = await hf.textToImage({ model: modelName, inputs });
        console.log(`[OK] Success! Generated image blob size: ${res.size}`);
    } else {
      console.error(`[ERROR] Unsupported task for test: ${task}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[FAIL] Error running ${modelName}: ${err.message}`);
    return false;
  }
}

async function runTests() {
  const isHealthy = await checkHealth();
  if (!isHealthy) return;

  const imagePath = "images/center-smile.jpg";
  if (!fs.existsSync(imagePath)) {
    console.error(`[ERROR] Test image not found at ${imagePath}`);
    return;
  }
  const imageBuf = fs.readFileSync(imagePath);
  const imageBlob = new Blob([imageBuf]);

  console.log("\n================================================");
  console.log("   Testing original models from the codebase   ");
  console.log("================================================");

  // Test original segmentation model
  let samSuccess = await testModel(
    "imageSegmentation",
    "facebook/sam-vit-huge",
    imageBlob
  );
  if (!samSuccess) {
    console.log(
      "\n[RETRY] Original segmentation model failed, trying fallback model..."
    );
    await testModel(
      "imageSegmentation",
      "facebook/detr-resnet-50-panoptic",
      imageBlob
    );
  }

  // Test original image-to-image model
  let sdxlSuccess = await testModel(
    "imageToImage",
    "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
    imageBlob,
    { prompt: "perfect teeth" }
  );
  if (!sdxlSuccess) {
    console.log(
      "\n[RETRY] Original inpainting model failed, trying fallback text-to-image..."
    );
    await testModel(
      "textToImage",
      "stabilityai/stable-diffusion-xl-base-1.0",
      "perfect teeth, natural smile"
    );
  }

  console.log("\n[INFO] Tests completed.");
}

runTests();

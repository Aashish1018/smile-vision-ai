import express from "express";
import multer from "multer";
import sharp from "sharp";
import { runTeethPipeline } from "../services/teethPipeline.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }

    cb(null, true);
  },
});

function toPublicErrorPayload(error) {
  const message = error?.message || "";
  if (message.includes("Only image files are allowed") || message.includes("No image uploaded")) {
    return { error: message };
  }

  const isDev = process.env.NODE_ENV !== "production";
  const diagnostics = error?.diagnostics;
  const base = {
    error: "We couldn't process the uploaded image. Please try another image.",
    debugMessage: error?.message || "Unknown pipeline error",
    debugType: error?.name || "Error",
  };

  if (isDev && Array.isArray(diagnostics)) {
    base.modelDiagnostics = diagnostics;
  }

  return base;
}

async function assertValidImage(buffer) {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image payload");
  }
}

router.get("/status", (_req, res) => {
  const proxyUrl =
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.HTTPS_PROXY;

  res.json({
    ok: true,
    service: "teeth-simulation",
    hfEndpoint: process.env.HF_ENDPOINT || "https://api-inference.huggingface.co",
    proxyEnabled: Boolean(proxyUrl),
    tokenConfigured: Boolean(process.env.HF_API_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN),
    timestamp: new Date().toISOString(),
  });
});

router.post("/simulate", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err.message);
      return res.status(400).json({ error: err.message || "File upload error" });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    await assertValidImage(req.file.buffer);
  } catch (err) {
    console.error("Image validation error:", err.message);
    return res.status(400).json({ error: "Only valid image files are allowed" });
  }

  // Set headers for Server-Sent Events (SSE)
  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform", // 'no-transform' stops basic proxies from altering the stream
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",                 // This is the magic line that tells Hugging Face's Nginx to STOP buffering
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await runTeethPipeline(req.file.buffer, (progress) => {
      sendEvent("progress", progress);
    });

    sendEvent("complete", {
      success: true,
      simulatedImage: `data:image/png;base64,${result.simulatedImage}`,
      originalImage: `data:image/png;base64,${result.originalImage}`,
      issuesList: result.issuesList,
      idealDescription: result.idealDescription,
      scores: result.scores,
      jaw: result.jaw,
      recommendation: result.recommendation,
      modelMeta: result.modelMeta,
    });
  } catch (error) {
    console.error("Pipeline error:", error);
    sendEvent("error", toPublicErrorPayload(error));
  } finally {
    res.end();
  }
});

export default router;

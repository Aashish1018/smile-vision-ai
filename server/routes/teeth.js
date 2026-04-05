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

function toPublicErrorMessage(error) {
  const message = error?.message || "";
  if (message.includes("Only image files are allowed") || message.includes("No image uploaded")) {
    return message;
  }

  return "We couldn't process the uploaded image. Please try another image.";
}

async function assertValidImage(buffer) {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image payload");
  }
}

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
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
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
    sendEvent("error", { error: toPublicErrorMessage(error) });
  } finally {
    res.end();
  }
});

export default router;

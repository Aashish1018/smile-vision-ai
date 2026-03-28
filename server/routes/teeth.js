import express from "express";
import multer from "multer";
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

router.post("/simulate", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const result = await runTeethPipeline(req.file.buffer);

    res.json({
      success: true,
      simulatedImage: `data:image/png;base64,${result.simulatedImage}`,
      originalImage: `data:image/png;base64,${result.originalImage}`,
      issuesList: result.issuesList,
      idealDescription: result.idealDescription,
    });
  } catch (error) {
    console.error("Pipeline error:", error);
    res.status(500).json({ error: error.message || "Pipeline failed" });
  }
});

export default router;

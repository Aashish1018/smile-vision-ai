import "dotenv/config";
import express from "express";
import cors from "cors";
import teethRouter from "./routes/teeth.js";

const app = express();

app.disable("x-powered-by");
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});


app.use(cors());


app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/teeth", teethRouter);

const PORT = process.env.PORT || 7860;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});

export default app;
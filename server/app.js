import "dotenv/config";
import express from "express";
import cors from "cors";
import teethRouter from "./routes/teeth.js";

const app = express();

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = allowedOrigins.length ? allowedOrigins : defaultOrigins;

app.disable("x-powered-by");
app.use((_, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/teeth", teethRouter);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8787;
  app.listen(PORT, () => {
    console.log(`Teeth simulator API listening on port ${PORT}`);
  });
}

export default app;

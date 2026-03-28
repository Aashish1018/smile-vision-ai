import "dotenv/config";
import express from "express";
import cors from "cors";
import teethRouter from "./routes/teeth.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/teeth", teethRouter);

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8787;
  app.listen(PORT, () => {
    console.log(`Teeth simulator API listening on port ${PORT}`);
  });
}

export default app;

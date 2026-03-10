// Express drop-in endpoint example
// Run with: npm run example:express

import express from "express";
import { complete, createClient } from "../src/index.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Option A: use module-level complete() (reads from env automatically)
app.post("/api/llm", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const result = await complete(prompt, {
      model: req.body?.model,
      temperature: req.body?.temperature,
      maxTokens: req.body?.maxTokens,
    });
    return res.json({ ok: true, model: result.model, content: result.content });
  } catch (err: unknown) {
    const e = err as Error & { cause?: { details?: unknown }; details?: unknown };
    return res.status(500).json({
      ok: false,
      error: e.message ?? "llm request failed",
      details: e.cause?.details ?? e.details ?? null,
    });
  }
});

// Option B: createClient() for explicit config
const llm = createClient({
  token: process.env.ONCE_GATEWAY_TOKEN!,
  baseUrl: process.env.ONCE_GATEWAY_URL ?? "http://127.0.0.1:18789",
});

app.post("/api/llm/v2", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    const result = await llm.complete(prompt);
    return res.json({ ok: true, model: result.model, content: result.content });
  } catch (err: unknown) {
    const e = err as Error;
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`once-gateway express example → http://localhost:${port}`));

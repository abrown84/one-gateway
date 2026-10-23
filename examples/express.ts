/**
 * Express example — local demo only.
 *
 * SECURITY:
 * - Do NOT expose this as a public unauthenticated LLM proxy.
 * - Requires PROXY_API_KEY (clients send `Authorization: Bearer <key>`).
 * - Binds to 127.0.0.1 by default.
 * - Does not forward client-chosen models or leak upstream error bodies.
 *
 * Prefer `one-gateway/serve` for any browser-facing chat endpoint.
 *
 * Run with: PROXY_API_KEY=dev-secret npm run example:express
 */

import crypto from "node:crypto";
import express from "express";
import { complete, createClient } from "../src/index.js";

const PROXY_API_KEY = process.env.PROXY_API_KEY ?? process.env.EXAMPLE_API_KEY;
if (!PROXY_API_KEY) {
  console.error(
    "[example] Refusing to start: set PROXY_API_KEY so this demo is not an open proxy."
  );
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "32kb" }));

function requireProxyAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header = req.headers.authorization ?? "";
  const expected = `Bearer ${PROXY_API_KEY}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

// Option A: module-level complete() (reads gateway config from env)
app.post("/api/llm", requireProxyAuth, async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (prompt.length > 4000) return res.status(400).json({ error: "prompt too long" });

  try {
    // Intentionally ignore client-supplied model / temperature / maxTokens —
    // those must come from server env/config, not the request body.
    const result = await complete(prompt);
    return res.json({ ok: true, model: result.model, content: result.content });
  } catch (err: unknown) {
    const e = err as Error;
    // Never return upstream `.details` to clients — may contain provider internals.
    return res.status(500).json({
      ok: false,
      error: e.message ?? "llm request failed",
    });
  }
});

// Option B: createClient() for explicit config
const llm = createClient({
  token: process.env.ONE_GATEWAY_TOKEN!,
  baseUrl: process.env.ONE_GATEWAY_URL ?? "http://127.0.0.1:18789",
});

app.post("/api/llm/v2", requireProxyAuth, async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (prompt.length > 4000) return res.status(400).json({ error: "prompt too long" });

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
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  console.log(`one-gateway express example → http://${host}:${port}`);
  console.log("Auth required: Authorization: Bearer <PROXY_API_KEY>");
});

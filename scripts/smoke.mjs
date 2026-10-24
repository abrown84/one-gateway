#!/usr/bin/env node
/**
 * Smoke test against a running one-gateway serve instance.
 *
 * Usage:
 *   GATEWAY_URL=http://127.0.0.1:3005 node scripts/smoke.mjs
 *
 * Optional:
 *   ONE_GATEWAY_SERVE_AUTH_KEY=...   if client auth is enabled
 *   ONE_GATEWAY_MODEL=gemini-3.8-flash
 *   ONE_GATEWAY_EMBEDDING_MODEL=gemini-embedding-2
 */

const base = (process.env.GATEWAY_URL || process.env.ONE_GATEWAY_SMOKE_URL || "http://127.0.0.1:3005")
  .replace(/\/+$/, "");
const authKey = process.env.ONE_GATEWAY_SERVE_AUTH_KEY || "";
const chatModel = process.env.ONE_GATEWAY_MODEL || "gemini-3.8-flash";
const embedModel =
  process.env.ONE_GATEWAY_EMBEDDING_MODEL || "gemini-embedding-2";

function headers() {
  const h = { "Content-Type": "application/json" };
  if (authKey) h.Authorization = `Bearer ${authKey}`;
  return h;
}

function pass(name) {
  console.log(`PASS  ${name}`);
}
function fail(name, detail) {
  console.error(`FAIL  ${name}: ${detail}`);
}

let failed = 0;

async function chat() {
  const name = "chat completions";
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        appId: "playground",
        model: chatModel,
        messages: [{ role: "user", content: "Reply with exactly: smoke-ok" }],
      }),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      fail(name, `non-JSON status=${res.status} body=${text.slice(0, 200)}`);
      failed++;
      return;
    }
    if (!res.ok) {
      fail(name, `status=${res.status} error=${json.error || text.slice(0, 200)}`);
      failed++;
      return;
    }
    if (typeof json.content !== "string" || !json.content.trim()) {
      fail(name, "missing content");
      failed++;
      return;
    }
    pass(`${name} (model=${json.model || chatModel})`);
  } catch (e) {
    fail(name, e.message);
    failed++;
  }
}

async function embeddings() {
  const name = "embeddings";
  try {
    const res = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: embedModel,
        input: "one-gateway smoke test",
      }),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      fail(name, `non-JSON status=${res.status} body=${text.slice(0, 200)}`);
      failed++;
      return;
    }
    if (!res.ok) {
      fail(name, `status=${res.status} error=${json.error || text.slice(0, 200)}`);
      failed++;
      return;
    }
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length === 0) {
      fail(name, "missing embedding vector");
      failed++;
      return;
    }
    pass(`${name} (dims=${vec.length}, model=${embedModel})`);
  } catch (e) {
    fail(name, e.message);
    failed++;
  }
}

console.log(`smoke → ${base}`);
await chat();
await embeddings();
process.exit(failed ? 1 : 0);

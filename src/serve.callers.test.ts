import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type http from "node:http";
import { serve } from "./serve.js";
import { loadCallers } from "./config.js";
import { GEMINI_OPENAI_BASE } from "./upstream.js";
import type { CallerConfig, GatewayConfig } from "./types.js";

const config: GatewayConfig = {
  baseUrl: GEMINI_OPENAI_BASE,
  token: "upstream-secret-key",
  primaryModel: "gemini-3.8-flash",
  embeddingModel: "gemini-embedding-2",
  fallbackModels: [],
  agentId: "",
  temperature: 0.2,
  maxTokens: 100,
  timeoutMs: 3000,
};

const KEY = "cwgw-test-key-123";
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const caller: CallerConfig = {
  name: "clearweb", keySha256: sha(KEY), rateLimit: 60, burstLimit: 8,
  dailyRequestCap: 2000, dailyTokenCap: 2_000_000, maxPromptChars: 12000, maxOutputTokens: 2048, trusted: true,
};

function waiting(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    const done = () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") reject(new Error("no port"));
      else resolve(addr.port);
    };
    if (server.listening) done();
    else server.once("listening", done);
  });
}
function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.closeAllConnections?.();
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("per-caller limits", () => {
  let originalFetch: typeof fetch;
  let sent: Record<string, unknown>[] = [];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    sent = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).includes("generativelanguage.googleapis.com")) return originalFetch(url, init);
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { total_tokens: 10 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  async function chat(port: number, body: unknown, headers: Record<string, string> = {}) {
    const r = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    });
    return r.status;
  }

  it("caller gets its own limits; public demo limits unchanged", async () => {
    const server = serve(config, { host: "127.0.0.1", port: 0, rateLimit: 2, dailyRequestCap: 2, callers: [caller] });
    try {
      const port = await waiting(server);
      const msg = { messages: [{ role: "user", content: "hi" }] };
      assert.equal(await chat(port, msg), 200);
      assert.equal(await chat(port, msg), 200);
      assert.equal(await chat(port, msg), 429, "public demo still limited");
      for (let i = 0; i < 5; i++) {
        assert.equal(await chat(port, msg, { Authorization: `Bearer ${KEY}` }), 200, "caller has own bucket");
      }
      assert.equal(await chat(port, msg, { Authorization: "Bearer wrong-key" }), 429, "unknown key = public tier");
    } finally { await close(server); }
  });

  it("caller prompt/output caps, system role, no demo keyword filter", async () => {
    const server = serve(config, { host: "127.0.0.1", port: 0, callers: [caller] });
    try {
      const port = await waiting(server);
      const long = "source text about a system prompt and api key what ".repeat(80); // ~4k chars + blocked words
      const body = {
        messages: [{ role: "system", content: "You are Clearweb." }, { role: "user", content: long }],
        max_tokens: 1500, reasoning_effort: "low",
      };
      assert.equal(await chat(port, body, { Authorization: `Bearer ${KEY}` }), 200);
      const up = sent[0] as { max_tokens: number; reasoning_effort: string; messages: { role: string; content: string }[] };
      assert.equal(up.max_tokens, 1500);
      assert.equal(up.reasoning_effort, "low");
      assert.equal(up.messages[1].role, "system");
      assert.equal(up.messages[2].content.length, long.length, "not truncated to 2000");
      assert.doesNotMatch(up.messages[0].content, /public demo assistant/);
      // same request without key: blocked / truncated by demo rules
      assert.equal(await chat(port, body), 400);
    } finally { await close(server); }
  });

  it("caller key satisfies authKey when client auth is enabled", async () => {
    const server = serve(config, { host: "127.0.0.1", port: 0, authKey: "global-key", callers: [caller] });
    try {
      const port = await waiting(server);
      const msg = { messages: [{ role: "user", content: "hi" }] };
      assert.equal(await chat(port, msg), 401);
      assert.equal(await chat(port, msg, { Authorization: `Bearer ${KEY}` }), 200);
      assert.equal(await chat(port, msg, { Authorization: "Bearer global-key" }), 200);
    } finally { await close(server); }
  });

  it("loadCallers validates entries and tolerates missing files", () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "og-")), "callers.json");
    fs.writeFileSync(f, JSON.stringify([caller, { name: "bad", keySha256: "nothex" }, { keySha256: sha("x") }]));
    assert.deepEqual(loadCallers(f).map((c) => c.name), ["clearweb"]);
    assert.deepEqual(loadCallers("/nonexistent/callers.json"), []);
    assert.deepEqual(loadCallers(undefined), []);
  });
});

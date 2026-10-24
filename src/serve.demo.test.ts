import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type http from "node:http";
import { serve } from "./serve.js";
import { GEMINI_OPENAI_BASE } from "./upstream.js";
import type { GatewayConfig } from "./types.js";

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

describe("serve demo / playground", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("serves playground HTML with plug-in section and Brown Industries CTA", async () => {
    const server = serve(config, { host: "127.0.0.1", port: 0 });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.match(html, /one-gateway/);
      assert.match(html, /Plug AI into any app/);
      assert.match(html, /Want one set up for your app\? Brown Industries/);
      assert.match(html, /https:\/\/brwnindustries\.com/);
      assert.match(html, /Built by/);
      // Base-path-aware OpenAI-compatible sample (no client auth required)
      assert.match(html, /location\.pathname\.replace/);
      assert.match(html, /\/v1\/chat\/completions/);
      assert.match(html, /gemini-3\.8-flash/);
      assert.match(html, /no auth token required/i);
      assert.doesNotMatch(html, /\$\{origin\}\/api\/chat/);
      assert.doesNotMatch(html, /upstream-secret-key/);
      assert.doesNotMatch(html, /\$\d|price|pricing/i);
    } finally {
      await close(server);
    }
  });

  it("allows public chat without client auth by default", async () => {
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (!href.includes("generativelanguage.googleapis.com")) {
        return originalFetch(url, init);
      }
      assert.match(href, /\/chat\/completions$/);
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer upstream-secret-key"
      );
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello demo" } }],
          usage: { total_tokens: 12 },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    const server = serve(config, {
      host: "127.0.0.1",
      port: 0,
      playground: false,
    });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      const json = (await res.json()) as { content?: string };
      assert.equal(res.status, 200);
      assert.equal(json.content, "hello demo");
    } finally {
      await close(server);
    }
  });

  it("optional authKey rejects missing bearer when enabled", async () => {
    const server = serve(config, {
      host: "127.0.0.1",
      port: 0,
      authKey: "client-secret",
      playground: false,
    });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      });
      assert.equal(res.status, 401);
    } finally {
      await close(server);
    }
  });

  it("rejects models outside the allowlist", async () => {
    const server = serve(config, {
      host: "127.0.0.1",
      port: 0,
      allowedModels: ["gemini-3.8-flash"],
      playground: false,
    });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      const json = (await res.json()) as { error?: string };
      assert.equal(res.status, 400);
      assert.match(json.error ?? "", /not allowed/i);
    } finally {
      await close(server);
    }
  });

  it("returns friendly demo limit message when per-IP daily cap hit", async () => {
    const server = serve(config, {
      host: "127.0.0.1",
      port: 0,
      dailyRequestCap: 1,
      rateLimit: 100,
      playground: false,
    });

    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).includes("generativelanguage.googleapis.com")) {
        return originalFetch(url, init);
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }],
          usage: { total_tokens: 5 },
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const port = await waiting(server);
      const body = JSON.stringify({ messages: [{ role: "user", content: "one" }] });
      const r1 = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assert.equal(r1.status, 200);
      const r2 = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await r2.json()) as { error?: string };
      assert.equal(r2.status, 429);
      assert.match(json.error ?? "", /Demo limit reached/);
    } finally {
      await close(server);
    }
  });

  it("proxies embeddings and never leaks upstream key to client errors", async () => {
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).includes("generativelanguage.googleapis.com")) {
        return originalFetch(url, init);
      }
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer upstream-secret-key"
      );
      return new Response(
        JSON.stringify({ data: [{ embedding: [1, 2] }], model: "gemini-embedding-2" }),
        { status: 200 }
      );
    }) as typeof fetch;

    const server = serve(config, { host: "127.0.0.1", port: 0, playground: false });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gemini-embedding-2", input: "hi" }),
      });
      const json = (await res.json()) as { data?: { embedding: number[] }[] };
      assert.equal(res.status, 200);
      assert.deepEqual(json.data?.[0]?.embedding, [1, 2]);
      assert.doesNotMatch(JSON.stringify(json), /upstream-secret-key/);
    } finally {
      await close(server);
    }
  });

  it("streams SSE chat when stream:true", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      "data: [DONE]\n\n";

    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (!String(url).includes("generativelanguage.googleapis.com")) {
        return originalFetch(url, init);
      }
      return new Response(sse, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as typeof fetch;

    const server = serve(config, { host: "127.0.0.1", port: 0, playground: false });
    try {
      const port = await waiting(server);
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: true,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
      const text = await res.text();
      assert.match(text, /Hel/);
      assert.match(text, /lo/);
    } finally {
      await close(server);
    }
  });
});

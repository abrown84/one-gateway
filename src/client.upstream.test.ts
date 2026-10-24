import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { complete, embed, createClient } from "./client.js";
import { GEMINI_OPENAI_BASE } from "./upstream.js";
import type { GatewayConfig } from "./types.js";

const geminiConfig: GatewayConfig = {
  baseUrl: GEMINI_OPENAI_BASE,
  token: "test-gemini-key",
  primaryModel: "gemini-3.8-flash",
  embeddingModel: "gemini-embedding-2",
  fallbackModels: [],
  agentId: "",
  temperature: 0.2,
  maxTokens: 100,
  timeoutMs: 5000,
};

describe("client upstream (mocked)", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("complete() posts to Gemini OpenAI chat path with Bearer auth", async () => {
    let hit: { url: string; headers: Headers; body: Record<string, unknown> } | null = null;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      hit = {
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? "{}")),
      };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "pong" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await complete("ping", { config: geminiConfig });
    assert.equal(result.content, "pong");
    assert.equal(
      hit!.url,
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    assert.equal(hit!.headers.get("authorization"), "Bearer test-gemini-key");
    assert.equal(hit!.headers.get("x-openclaw-agent-id"), null);
    assert.equal(hit!.body.model, "gemini-3.8-flash");
  });

  it("complete() sends OpenClaw agent header when agentId set", async () => {
    let agent: string | null = null;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      agent = new Headers(init?.headers).get("x-openclaw-agent-id");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 }
      );
    }) as typeof fetch;

    await complete("hi", {
      config: {
        ...geminiConfig,
        baseUrl: "http://127.0.0.1:18789",
        agentId: "main",
        primaryModel: "openclaw",
      },
    });
    assert.equal(agent, "main");
  });

  it("embed() posts to embeddings endpoint", async () => {
    let hit: { url: string; body: Record<string, unknown> } | null = null;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      hit = { url: String(url), body: JSON.parse(String(init?.body ?? "{}")) };
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }], model: "gemini-embedding-2" }),
        { status: 200 }
      );
    }) as typeof fetch;

    const result = await embed("hello world", { config: geminiConfig });
    assert.deepEqual(result.embedding, [0.1, 0.2, 0.3]);
    assert.equal(
      hit!.url,
      "https://generativelanguage.googleapis.com/v1beta/openai/embeddings"
    );
    assert.equal(hit!.body.model, "gemini-embedding-2");
    assert.equal(hit!.body.input, "hello world");
  });

  it("createClient defaults to Gemini base + models", async () => {
    let url = "";
    globalThis.fetch = (async (u: RequestInfo | URL) => {
      url = String(u);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "x" } }] }),
        { status: 200 }
      );
    }) as typeof fetch;

    const llm = createClient({ token: "k" });
    await llm.complete("hi");
    assert.match(url, /generativelanguage\.googleapis\.com.*\/chat\/completions$/);
  });
});

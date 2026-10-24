import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chatCompletionsUrl,
  embeddingsUrl,
  isGeminiOpenAiBase,
  GEMINI_OPENAI_BASE,
} from "./upstream.js";

describe("upstream URL helpers", () => {
  it("maps Gemini OpenAI base to /chat/completions (no extra /v1)", () => {
    assert.equal(
      chatCompletionsUrl(GEMINI_OPENAI_BASE),
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    assert.equal(
      embeddingsUrl(GEMINI_OPENAI_BASE + "/"),
      "https://generativelanguage.googleapis.com/v1beta/openai/embeddings"
    );
  });

  it("maps OpenClaw-style base to /v1/chat/completions", () => {
    assert.equal(
      chatCompletionsUrl("http://127.0.0.1:18789"),
      "http://127.0.0.1:18789/v1/chat/completions"
    );
    assert.equal(
      embeddingsUrl("http://127.0.0.1:18789"),
      "http://127.0.0.1:18789/v1/embeddings"
    );
  });

  it("detects Gemini OpenAI-compatible hosts", () => {
    assert.equal(isGeminiOpenAiBase(GEMINI_OPENAI_BASE), true);
    assert.equal(isGeminiOpenAiBase("http://127.0.0.1:18789"), false);
  });
});

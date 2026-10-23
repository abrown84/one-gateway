import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateBaseUrl,
  validateGatewayConfig,
  sanitizeHeaderValue,
  redactSecrets,
} from "./validate.js";
import { getConfig } from "./config.js";
import { createClient } from "./client.js";

describe("validateBaseUrl", () => {
  it("accepts loopback http and strips trailing slash", () => {
    assert.equal(validateBaseUrl("http://127.0.0.1:18789/"), "http://127.0.0.1:18789");
    assert.equal(validateBaseUrl("http://localhost:18789"), "http://localhost:18789");
  });

  it("accepts remote https", () => {
    assert.equal(
      validateBaseUrl("https://gateway.example.com/v1"),
      "https://gateway.example.com/v1"
    );
  });

  it("rejects remote http (TLS enforcement)", () => {
    assert.throws(
      () => validateBaseUrl("http://evil.example.com"),
      /must use https/
    );
  });

  it("rejects non-http(s) schemes", () => {
    assert.throws(() => validateBaseUrl("file:///etc/passwd"), /only http/);
    assert.throws(() => validateBaseUrl("ftp://example.com"), /only http/);
  });

  it("rejects credentials embedded in the URL", () => {
    assert.throws(
      () => validateBaseUrl("https://user:secret@example.com"),
      /credentials/
    );
  });

  it("rejects malformed URLs", () => {
    assert.throws(() => validateBaseUrl("not a url"), /not a valid URL/);
    assert.throws(() => validateBaseUrl(""), /non-empty/);
  });
});

describe("sanitizeHeaderValue", () => {
  it("rejects CR/LF (header injection)", () => {
    assert.throws(
      () => sanitizeHeaderValue("main\r\nX-Injected: 1", "agentId"),
      /control characters/
    );
    assert.throws(
      () => sanitizeHeaderValue("tok\nen", "token"),
      /control characters/
    );
  });

  it("trims valid values", () => {
    assert.equal(sanitizeHeaderValue("  main  ", "agentId"), "main");
  });
});

describe("validateGatewayConfig / getConfig", () => {
  it("clamps NaN-prone numeric env and validates token", () => {
    const cfg = getConfig({
      ONE_GATEWAY_TOKEN: "test-token-value",
      ONE_GATEWAY_URL: "http://127.0.0.1:18789",
      ONE_GATEWAY_TEMPERATURE: "0.5",
      ONE_GATEWAY_MAX_TOKENS: "100",
      ONE_GATEWAY_TIMEOUT_MS: "1000",
      ONE_GATEWAY_AGENT: "main",
    });
    assert.equal(cfg.temperature, 0.5);
    assert.equal(cfg.maxTokens, 100);
    assert.equal(cfg.timeoutMs, 1000);
  });

  it("rejects missing token", () => {
    assert.throws(() => getConfig({}), /Missing gateway token/);
  });

  it("rejects header-injectable agent id from env", () => {
    assert.throws(
      () =>
        getConfig({
          ONE_GATEWAY_TOKEN: "tok",
          ONE_GATEWAY_AGENT: "main\r\nAuthorization: Bearer stolen",
        }),
      /control characters/
    );
  });

  it("rejects NaN temperature", () => {
    assert.throws(
      () =>
        validateGatewayConfig({
          baseUrl: "http://127.0.0.1:18789",
          token: "tok",
          primaryModel: "openclaw",
          fallbackModels: [],
          agentId: "main",
          temperature: Number("nope"),
          maxTokens: 100,
          timeoutMs: 1000,
        }),
      /temperature/
    );
  });
});

describe("redactSecrets", () => {
  it("redacts bearer tokens and api keys in strings and objects", () => {
    const s = redactSecrets("Authorization Bearer abcdefghijklmnop") as string;
    assert.match(s, /\[REDACTED\]/);

    const obj = redactSecrets({
      token: "super-secret-value",
      nested: { authorization: "Bearer abcdefghijklmnop" },
      ok: "hello",
    }) as Record<string, unknown>;
    assert.equal(obj.token, "[REDACTED]");
    assert.equal(obj.ok, "hello");
    assert.equal((obj.nested as Record<string, unknown>).authorization, "[REDACTED]");
  });
});

describe("createClient", () => {
  it("validates config at construction time", () => {
    assert.throws(
      () => createClient({ token: "t", baseUrl: "http://remote.example.com" }),
      /must use https/
    );
    const client = createClient({ token: "t", baseUrl: "http://127.0.0.1:18789" });
    assert.equal(typeof client.complete, "function");
  });
});

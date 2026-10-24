import type { GatewayConfig, ServeOptions } from "./types.js";
import { validateGatewayConfig } from "./validate.js";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  GEMINI_OPENAI_BASE,
} from "./upstream.js";

function parseFallbacks(v = ""): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseList(v = ""): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseOptionalInt(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Read gateway config from environment.
 *
 * Defaults to Google Gemini's OpenAI-compatible endpoint. OpenClaw remains
 * supported by setting `ONE_GATEWAY_UPSTREAM_URL` / `ONE_GATEWAY_URL` to your
 * OpenClaw base and providing a gateway token.
 */
export function getConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const token =
    env.ONE_GATEWAY_API_KEY ??
    env.GEMINI_API_KEY ??
    env.ONE_GATEWAY_TOKEN ??
    env.OPENCLAW_GATEWAY_TOKEN;

  if (!token) {
    throw new Error(
      "Missing API key. Set ONE_GATEWAY_API_KEY or GEMINI_API_KEY " +
        "(or ONE_GATEWAY_TOKEN / OPENCLAW_GATEWAY_TOKEN for OpenClaw)."
    );
  }

  return validateGatewayConfig({
    baseUrl:
      env.ONE_GATEWAY_UPSTREAM_URL ??
      env.ONE_GATEWAY_URL ??
      env.OPENCLAW_BASE_URL ??
      GEMINI_OPENAI_BASE,
    token,
    primaryModel:
      env.ONE_GATEWAY_MODEL ?? env.OPENCLAW_MODEL_PRIMARY ?? DEFAULT_CHAT_MODEL,
    embeddingModel:
      env.ONE_GATEWAY_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    fallbackModels: parseFallbacks(
      env.ONE_GATEWAY_FALLBACKS ?? env.OPENCLAW_MODEL_FALLBACKS ?? ""
    ),
    // Empty by default for Gemini; set ONE_GATEWAY_AGENT for OpenClaw routing
    agentId: env.ONE_GATEWAY_AGENT ?? env.OPENCLAW_AGENT_ID ?? "",
    temperature: Number(env.ONE_GATEWAY_TEMPERATURE ?? env.OPENCLAW_TEMPERATURE ?? 0.2),
    maxTokens: Number(env.ONE_GATEWAY_MAX_TOKENS ?? env.OPENCLAW_MAX_TOKENS ?? 500),
    timeoutMs: Number(env.ONE_GATEWAY_TIMEOUT_MS ?? env.OPENCLAW_TIMEOUT_MS ?? 45000),
  });
}

const DEFAULT_ALLOWED_MODELS = [
  DEFAULT_CHAT_MODEL,
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

/**
 * Build `serve()` options from environment (demo / VPS entrypoints).
 * Client auth defaults OFF — set `ONE_GATEWAY_SERVE_AUTH_KEY` to enable.
 */
export function getServeOptionsFromEnv(
  env: Record<string, string | undefined> = process.env
): ServeOptions {
  const allowedModels = parseList(env.ONE_GATEWAY_ALLOWED_MODELS);
  const authKey = env.ONE_GATEWAY_SERVE_AUTH_KEY?.trim() || undefined;

  return {
    port: parseOptionalInt(env.PORT ?? env.ONE_GATEWAY_PORT) ?? 3005,
    host: env.HOST ?? env.ONE_GATEWAY_HOST ?? "127.0.0.1",
    allowedOrigin: env.ONE_GATEWAY_ALLOWED_ORIGIN ?? "*",
    trustProxy:
      env.ONE_GATEWAY_TRUST_PROXY === "1" ||
      env.ONE_GATEWAY_TRUST_PROXY === "true",
    authKey,
    allowedModels: allowedModels.length > 0 ? allowedModels : DEFAULT_ALLOWED_MODELS,
    maxPromptChars: parseOptionalInt(env.ONE_GATEWAY_MAX_PROMPT_CHARS) ?? 2000,
    maxOutputTokens: parseOptionalInt(env.ONE_GATEWAY_MAX_OUTPUT_TOKENS) ?? 512,
    rateLimit: parseOptionalInt(env.ONE_GATEWAY_RATE_LIMIT) ?? 10,
    dailyRequestCap: parseOptionalInt(env.ONE_GATEWAY_DAILY_REQUEST_CAP) ?? 50,
    globalDailyCap: parseOptionalInt(env.ONE_GATEWAY_GLOBAL_DAILY_CAP) ?? 2000,
    dailyTokenCap: parseOptionalInt(env.ONE_GATEWAY_DAILY_TOKEN_CAP) ?? 10_000,
    playground: env.ONE_GATEWAY_PLAYGROUND !== "0" && env.ONE_GATEWAY_PLAYGROUND !== "false",
    apps: {
      playground: {
        systemPrompt:
          env.ONE_GATEWAY_SYSTEM_PROMPT ??
          "You are the one-gateway public demo assistant. Be concise, helpful, and clear. " +
            "You are powered by Google Gemini through one-gateway. Do not claim access to private data.",
      },
    },
  };
}

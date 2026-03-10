import type { GatewayConfig } from "./types.js";

function parseFallbacks(v = ""): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const token = env.ONE_GATEWAY_TOKEN ?? env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    throw new Error(
      "Missing gateway token. Set ONE_GATEWAY_TOKEN (or OPENCLAW_GATEWAY_TOKEN) in your environment."
    );
  }

  return {
    baseUrl: env.ONE_GATEWAY_URL ?? env.OPENCLAW_BASE_URL ?? "http://127.0.0.1:18789",
    token,
    primaryModel: env.ONE_GATEWAY_MODEL ?? env.OPENCLAW_MODEL_PRIMARY ?? "openclaw",
    fallbackModels: parseFallbacks(env.ONE_GATEWAY_FALLBACKS ?? env.OPENCLAW_MODEL_FALLBACKS ?? ""),
    agentId: env.ONE_GATEWAY_AGENT ?? env.OPENCLAW_AGENT_ID ?? "main",
    temperature: Number(env.ONE_GATEWAY_TEMPERATURE ?? env.OPENCLAW_TEMPERATURE ?? 0.2),
    maxTokens: Number(env.ONE_GATEWAY_MAX_TOKENS ?? env.OPENCLAW_MAX_TOKENS ?? 500),
    timeoutMs: Number(env.ONE_GATEWAY_TIMEOUT_MS ?? env.OPENCLAW_TIMEOUT_MS ?? 45000),
  };
}

import type { ChatMessage, GatewayConfig, CompletionResult, CompleteOptions } from "./types.js";
import { getConfig } from "./config.js";
import { attachErrorDetails, validateGatewayConfig } from "./validate.js";

async function callOnce(args: {
  config: GatewayConfig;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}): Promise<CompletionResult> {
  const { config, model, messages, temperature, maxTokens, signal } = args;

  const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "x-openclaw-agent-id": config.agentId,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    signal,
  });

  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 2048) }; }

  if (!res.ok) {
    throw attachErrorDetails(new Error(`HTTP ${res.status} for model=${model}`), json);
  }

  const content = (json as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  if (!content) {
    throw attachErrorDetails(new Error(`Empty content for model=${model}`), json);
  }

  return { model, content, raw: json };
}

/**
 * Send a prompt through your OpenClaw gateway with automatic fallback support.
 *
 * @example
 * ```ts
 * import { complete } from "one-gateway";
 *
 * const result = await complete("Summarize this in one sentence: ...");
 * console.log(result.content);
 * ```
 */
export async function complete(
  prompt: string,
  opts?: CompleteOptions
): Promise<CompletionResult> {
  if (opts?.messages == null && typeof prompt !== "string") {
    throw new Error("prompt must be a string (or pass opts.messages)");
  }

  const config = opts?.config ?? getConfig();
  const models = [opts?.model ?? config.primaryModel, ...config.fallbackModels].filter(Boolean);
  const messages = opts?.messages ?? [{ role: "user" as const, content: prompt }];
  const temperature = opts?.temperature ?? config.temperature;
  const maxTokens = opts?.maxTokens ?? config.maxTokens;

  // Cap per-call overrides so a caller cannot DoS the gateway with huge limits
  if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    throw new Error("temperature must be a number between 0 and 2");
  }
  if (maxTokens !== undefined && (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > 128_000)) {
    throw new Error("maxTokens must be an integer between 1 and 128000");
  }
  if (opts?.model != null) {
    if (typeof opts.model !== "string" || /[\x00-\x1f\x7f]/.test(opts.model)) {
      throw new Error("Invalid model: contains control characters");
    }
  }

  for (const m of messages) {
    if (!m || typeof m.role !== "string" || typeof m.content !== "string") {
      throw new Error("Each message must have string role and content");
    }
    if (!["system", "user", "assistant"].includes(m.role)) {
      throw new Error(`Invalid message role: ${m.role}`);
    }
  }

  let lastError: unknown = null;

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const out = await callOnce({
        config,
        model,
        messages,
        temperature: temperature ?? config.temperature,
        maxTokens: maxTokens ?? config.maxTokens,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return out;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }

  const e = new Error("All model attempts failed");
  (e as Error & { cause: unknown }).cause = lastError;
  throw e;
}

/**
 * Create a reusable client bound to a specific config.
 *
 * @example
 * ```ts
 * import { createClient } from "one-gateway";
 *
 * const llm = createClient({ token: "...", baseUrl: "http://127.0.0.1:18789" });
 * const result = await llm.complete("What's the weather like on Mars?");
 * ```
 */
export function createClient(config: Partial<GatewayConfig> & { token: string }) {
  const merged = validateGatewayConfig({
    baseUrl: "http://127.0.0.1:18789",
    primaryModel: "openclaw",
    fallbackModels: [],
    agentId: "main",
    temperature: 0.2,
    maxTokens: 500,
    timeoutMs: 45000,
    ...config,
  });

  return {
    complete: (prompt: string, opts?: Omit<CompleteOptions, "config">) =>
      complete(prompt, { ...opts, config: merged }),
  };
}

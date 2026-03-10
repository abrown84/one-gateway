import type { ChatMessage, GatewayConfig, CompletionResult, CompleteOptions } from "./types.js";
import { getConfig } from "./config.js";

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
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} for model=${model}`);
    (e as NodeJS.ErrnoException & { details: unknown }).details = json;
    throw e;
  }

  const content = (json as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  if (!content) {
    const e = new Error(`Empty content for model=${model}`);
    (e as NodeJS.ErrnoException & { details: unknown }).details = json;
    throw e;
  }

  return { model, content, raw: json };
}

/**
 * Send a prompt through your OpenClaw gateway with automatic fallback support.
 *
 * @example
 * ```ts
 * import { complete } from "once-gateway";
 *
 * const result = await complete("Summarize this in one sentence: ...");
 * console.log(result.content);
 * ```
 */
export async function complete(
  prompt: string,
  opts?: CompleteOptions
): Promise<CompletionResult> {
  const config = opts?.config ?? getConfig();
  const models = [opts?.model ?? config.primaryModel, ...config.fallbackModels].filter(Boolean);
  const messages = opts?.messages ?? [{ role: "user" as const, content: prompt }];
  const temperature = opts?.temperature ?? config.temperature;
  const maxTokens = opts?.maxTokens ?? config.maxTokens;

  let lastError: unknown = null;

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const out = await callOnce({ config, model, messages, temperature, maxTokens, signal: controller.signal });
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
 * import { createClient } from "once-gateway";
 *
 * const llm = createClient({ token: "...", baseUrl: "http://127.0.0.1:18789" });
 * const result = await llm.complete("What's the weather like on Mars?");
 * ```
 */
export function createClient(config: Partial<GatewayConfig> & { token: string }) {
  const merged: GatewayConfig = {
    baseUrl: "http://127.0.0.1:18789",
    primaryModel: "openclaw",
    fallbackModels: [],
    agentId: "main",
    temperature: 0.2,
    maxTokens: 500,
    timeoutMs: 45000,
    ...config,
  };

  return {
    complete: (prompt: string, opts?: Omit<CompleteOptions, "config">) =>
      complete(prompt, { ...opts, config: merged }),
  };
}

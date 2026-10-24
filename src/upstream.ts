/** Default Gemini OpenAI-compatible base (no trailing slash). */
export const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai";

export const DEFAULT_CHAT_MODEL = "gemini-3.8-flash";
/** Native docs use gemini-embedding-2; OpenAI-compat also documents *-preview. */
export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-2";

/**
 * Resolve chat completions URL for OpenClaw (`/v1/...`) vs Gemini OpenAI-compat
 * (base already ends with `/openai` → `/chat/completions`).
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (/\/openai$/i.test(base) || /\/v1$/i.test(base)) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

/** Resolve embeddings URL for the same base-URL conventions as chat. */
export function embeddingsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (/\/openai$/i.test(base) || /\/v1$/i.test(base)) {
    return `${base}/embeddings`;
  }
  return `${base}/v1/embeddings`;
}

/** True when the upstream looks like Google's Gemini OpenAI-compatible API. */
export function isGeminiOpenAiBase(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return (
      u.hostname === "generativelanguage.googleapis.com" ||
      /\/openai\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GatewayConfig = {
  baseUrl: string;
  token: string;
  primaryModel: string;
  embeddingModel: string;
  fallbackModels: string[];
  /** When non-empty, sent as `x-openclaw-agent-id` (OpenClaw only). */
  agentId: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
};

export type CompletionResult = {
  model: string;
  content: string;
  raw: unknown;
};

export type EmbeddingResult = {
  model: string;
  embedding: number[];
  raw: unknown;
};

export type CompleteOptions = {
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  config?: GatewayConfig;
};

export type EmbedOptions = {
  model?: string;
  config?: GatewayConfig;
};

// ── Server / proxy types ──────────────────────────────────────────────────────

export type AppConfig = {
  /** System prompt injected server-side — never exposed to clients */
  systemPrompt: string;
  /** Override the global model for this app */
  model?: string;
  /** Override max tokens for this app */
  maxTokens?: number;
};

export type ConversationEvent = {
  appId: string;
  ipHash: string;
  messages: ChatMessage[];
  response: string;
  model: string;
  tokensUsed: number;
  timestamp: number;
};

export type ServeOptions = {
  /** Port to listen on (default: 3005) */
  port?: number;
  /** Host to bind (default: 127.0.0.1) */
  host?: string;
  /**
   * Allowed CORS origin. Default: `*` (dev only).
   * Production deployments should set an exact origin (e.g. `https://acme.com`).
   */
  allowedOrigin?: string;
  /**
   * When true, client IP is taken from `X-Forwarded-For` (first hop).
   * Default false — enable only behind a trusted reverse proxy, otherwise
   * clients can spoof IPs and bypass rate limits.
   */
  trustProxy?: boolean;
  /**
   * Optional client auth key. Default: unset (public demo).
   * When set, clients must send `Authorization: Bearer <key>`.
   * Upstream Gemini/OpenClaw keys are never exposed to browsers.
   */
  authKey?: string;
  /** Per-app system prompt configs keyed by appId */
  apps?: Record<string, AppConfig>;
  /** Default appId when none provided (default: first key in apps) */
  defaultApp?: string;
  /** Models the playground/API may request (default: gemini flash family) */
  allowedModels?: string[];
  /** Max characters per user prompt (default: 2000) */
  maxPromptChars?: number;
  /** Hard clamp on max_tokens sent upstream (default: 512) */
  maxOutputTokens?: number;
  /** Max requests per IP per window (default: 10) */
  rateLimit?: number;
  /** Rate window in ms (default: 60000) */
  rateWindowMs?: number;
  /** Max concurrent requests per IP (default: 3) */
  burstLimit?: number;
  /** Max requests per IP per day (default: 50) */
  dailyRequestCap?: number;
  /**
   * Global max requests per day across all IPs (default: 2000).
   * Set via env `ONE_GATEWAY_GLOBAL_DAILY_CAP`.
   */
  globalDailyCap?: number;
  /** Max tokens per IP per day (default: 10000) — soft estimate budget */
  dailyTokenCap?: number;
  /** Serve the public playground UI at GET / (default: true) */
  playground?: boolean;
  /** Extra blocked patterns in addition to built-ins */
  blockedPatterns?: RegExp[];
  /** Optional callback fired after every successful LLM response */
  onComplete?: (event: ConversationEvent) => void | Promise<void>;
};

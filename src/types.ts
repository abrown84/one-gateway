export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GatewayConfig = {
  baseUrl: string;
  token: string;
  primaryModel: string;
  fallbackModels: string[];
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

export type CompleteOptions = {
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
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
  /** Allowed CORS origin (default: * — restrict in production) */
  allowedOrigin?: string;
  /** Per-app system prompt configs keyed by appId */
  apps: Record<string, AppConfig>;
  /** Default appId when none provided (default: first key in apps) */
  defaultApp?: string;
  /** Max requests per IP per window (default: 20) */
  rateLimit?: number;
  /** Rate window in ms (default: 60000) */
  rateWindowMs?: number;
  /** Max concurrent requests per IP (default: 5) */
  burstLimit?: number;
  /** Max tokens per IP per day (default: 10000) */
  dailyTokenCap?: number;
  /** Extra blocked patterns in addition to built-ins */
  blockedPatterns?: RegExp[];
  /** Optional callback fired after every successful LLM response */
  onComplete?: (event: ConversationEvent) => void | Promise<void>;
};

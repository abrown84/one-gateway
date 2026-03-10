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

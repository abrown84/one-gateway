import type { GatewayConfig } from "./types.js";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Patterns that may appear in logs/errors and should be redacted. */
const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^\s"',}]{8,}/gi,
  /sk-[A-Za-z0-9]{20,}/g,
];

/**
 * Reject CR/LF and other ASCII controls so values cannot split HTTP headers.
 */
export function sanitizeHeaderValue(value: string, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${field}: must be a non-empty string`);
  }
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`Invalid ${field}: contains control characters`);
  }
  return value.trim();
}

/**
 * Validate and normalize a gateway base URL.
 * - Only http/https
 * - No embedded credentials (avoid accidental log leakage)
 * - http allowed only for loopback hosts (TLS enforcement for remote)
 */
export function validateBaseUrl(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Invalid baseUrl: must be a non-empty string");
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid baseUrl: not a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid baseUrl: only http: and https: are allowed");
  }

  if (url.username || url.password) {
    throw new Error("Invalid baseUrl: credentials in URL are not allowed");
  }

  const host = url.hostname.toLowerCase();
  if (!host) {
    throw new Error("Invalid baseUrl: missing hostname");
  }

  const isLoopback = LOOPBACK.has(host);
  if (url.protocol === "http:" && !isLoopback) {
    throw new Error(
      "Invalid baseUrl: remote gateways must use https: (http: is only allowed for localhost)"
    );
  }

  // Normalize: drop trailing slash on pathname root
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

function finiteNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${field}: must be a finite number`);
  }
  return n;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate/normalize a full GatewayConfig. Safe to call on env-derived or
 * createClient() configs.
 */
export function validateGatewayConfig(config: GatewayConfig): GatewayConfig {
  const token = sanitizeHeaderValue(config.token, "token");
  const agentId = sanitizeHeaderValue(config.agentId, "agentId");
  const primaryModel = sanitizeHeaderValue(config.primaryModel, "primaryModel");

  const fallbackModels = (config.fallbackModels ?? []).map((m, i) =>
    sanitizeHeaderValue(m, `fallbackModels[${i}]`)
  );

  const temperature = clamp(finiteNumber(config.temperature, "temperature"), 0, 2);
  const maxTokens = clamp(Math.floor(finiteNumber(config.maxTokens, "maxTokens")), 1, 128_000);
  const timeoutMs = clamp(Math.floor(finiteNumber(config.timeoutMs, "timeoutMs")), 100, 600_000);

  return {
    baseUrl: validateBaseUrl(config.baseUrl),
    token,
    primaryModel,
    fallbackModels,
    agentId,
    temperature,
    maxTokens,
    timeoutMs,
  };
}

/** Redact bearer tokens / API-key-like strings from error or log text. */
export function redactSecrets(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === "string") {
    let out = input;
    for (const re of SECRET_PATTERNS) {
      out = out.replace(re, "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(input)) {
    return input.map(redactSecrets);
  }
  if (typeof input === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/token|password|secret|authorization|api[_-]?key/i.test(k) && typeof v === "string") {
        obj[k] = "[REDACTED]";
      } else {
        obj[k] = redactSecrets(v);
      }
    }
    return obj;
  }
  return input;
}

/** Attach redacted upstream details onto an Error without leaking secrets. */
export function attachErrorDetails(err: Error, details: unknown): Error {
  (err as Error & { details: unknown }).details = redactSecrets(details);
  return err;
}

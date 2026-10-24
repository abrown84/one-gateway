# Security Review — one-gateway

**Scope:** OpenAI-compatible client + `serve` proxy for the OpenClaw LLM gateway  
**Date:** 2026-10-23  
**Goal:** Assess readiness to productize; fix clear low-risk issues; document remaining work.

---

## Executive summary

The library is a **zero-runtime-dependency** client with a useful hardened `serve()` path, but several issues would block a sellable product: an **unauthenticated Express example that acted as an open LLM proxy**, **no base-URL/TLS validation**, **header-injection risk via `agentId`**, **X-Forwarded-For trusted by default for rate limits**, and **upstream error details returned to clients** in the example.

This PR hardens validation, secret redaction, `serve` proxy trust, the Express example, dependency audit hygiene, and adds regression tests. Remaining work for a commercial product is listed under **Recommended next steps**.

---

## Findings by severity

### Critical

| ID | Finding | Status |
|----|---------|--------|
| C1 | **`examples/express.ts` was an unauthenticated open proxy.** Any caller could spend gateway quota, choose `model` / `temperature` / `maxTokens`, and receive upstream `details` in 500 responses. README showed the same anti-pattern. | **Fixed** — requires `PROXY_API_KEY`, binds `127.0.0.1`, ignores client model/limits, does not leak `details`. README warns and points to `serve`. |

### High

| ID | Finding | Status |
|----|---------|--------|
| H1 | **No base URL validation / weak SSRF posture.** `baseUrl` from env or `createClient` accepted any string (including `file:`, credentialed URLs, remote `http:`). A misconfigured or attacker-influenced config could target unexpected endpoints. | **Fixed** — `validateBaseUrl()` allows only `http`/`https`, rejects embedded credentials, requires **https for non-loopback**. |
| H2 | **HTTP header injection via `agentId` (and similar).** Values were placed in `x-openclaw-agent-id` / `Authorization` without rejecting CR/LF/controls. | **Fixed** — `sanitizeHeaderValue()` rejects control characters; applied in `validateGatewayConfig()`. |
| H3 | **`serve` trusted `X-Forwarded-For` unconditionally.** Clients could spoof IPs and bypass per-IP rate / token caps. | **Fixed** — `trustProxy` defaults to `false`; XFF used only when enabled. |
| H4 | **Express example returned upstream error `details` to clients.** Provider/gateway bodies can leak internals. | **Fixed** in example; client attaches **redacted** `details` only on the Error object for server-side debugging. |

### Medium

| ID | Finding | Status |
|----|---------|--------|
| M1 | **Numeric config not validated.** `Number("nope")` → `NaN` for temperature / maxTokens / timeoutMs → undefined request behavior. | **Fixed** — finite checks + clamps in `validateGatewayConfig()`; per-call override bounds in `complete()`. |
| M2 | **`serve` default `allowedOrigin: "*"`.** Fine for local demos; dangerous if bound on a public interface. | **Mitigated** — warning when `*` + non-loopback host; docs updated. Still defaults to `*` for DX. |
| M3 | **Invalid JSON in `serve` returned generic 500.** | **Fixed** — explicit `400 Invalid JSON body.` |
| M4 | **DevDependency audit: critical/high vulns** (`proxy-addr`, `path-to-regexp`, `picomatch`, etc. via Express/tsup). Runtime package has **no** production dependencies, but examples/CI were exposed. | **Fixed** — `npm audit fix` + `overrides.esbuild`; CI runs `npm audit --audit-level=high`. |
| M5 | **Prompt-injection defenses are regex denylists.** Easily bypassed with paraphrase / encoding; useful as a speed bump only. | **Open** — document as defense-in-depth, not a guarantee. |
| M6 | **`serve` is a public demo by default** (no client auth). Relies on rate limits, daily caps, model allowlist, prompt/output clamps. Origin can be omitted by non-browser clients. | **Mitigated** — demo bill guards + optional `authKey` / `ONE_GATEWAY_SERVE_AUTH_KEY` (default off). Upstream keys remain server-side. |

### Low

| ID | Finding | Status |
|----|---------|--------|
| L1 | **Fallback loop retries immediately** across models with no backoff; long `fallbackModels` lists amplify load under outage. | **Open** — add backoff / maxAttempts. |
| L2 | **Rate limit counter increments before body validation** — cheap way to burn an IP’s budget with junk. | **Open** — count only after auth/parse success (trade-off). |
| L3 | **In-memory rate limit store** — not shared across processes; resets on restart; unbounded growth mitigated by prune but weak under many IPs. | **Open** — Redis/external limiter for multi-instance. |
| L4 | **Truncated non-JSON upstream bodies** still attached (redacted) on errors — size capped to 2KB. | **Fixed** (cap + redact). |
| L5 | **Supply-chain surface is small** (empty `dependencies`, lockfile present, scripts have no `preinstall` malware hooks). `prepublishOnly` builds from source — good. | **OK** — keep lockfile; pin publish to CI tags (already). |
| L6 | **TLS for loopback defaults to http** — appropriate for local OpenClaw; remote forced to https. | **OK** by design. |

### Informational

| ID | Finding | Status |
|----|---------|--------|
| I1 | Pattern-based “security rules” in system prompts are model-dependent and not enforceable. | Document for customers. |
| I2 | `complete()` still allows caller-supplied `messages` including `system` — correct for a **client** SDK; `serve` correctly strips client system roles. | By design. |
| I3 | No streaming / SSE path reviewed (not implemented). | N/A |
| I4 | Publish workflow uses `NPM_TOKEN` — ensure least privilege + OIDC when productizing. | Recommendation |

---

## What was fixed in this PR

1. **`src/validate.ts`** — base URL validation, TLS rule for remote hosts, header sanitization, config clamps, secret redaction helpers.
2. **`src/config.ts` / `src/client.ts` / `src/serve.ts`** — validate all configs; redact error details; `trustProxy`; safer JSON errors; warn on open CORS + public bind.
3. **`examples/express.ts`** — auth gate, localhost bind, no client model overrides, no detail leakage.
4. **Dependencies** — audit clean (`0` vulnerabilities); `esbuild` override; CI audit + tests.
5. **Tests** — `src/validate.test.ts`, `src/serve.security.test.ts` (URL/TLS, header injection, XFF, injection patterns, system-role stripping).
6. **Docs** — README security callouts; this file.

---

## npm audit / supply chain

| Item | Result |
|------|--------|
| Runtime `dependencies` | None (good) |
| Lockfile | Present (`package-lock.json`) |
| Lifecycle scripts | `build` / `dev` / `test` / examples / `prepublishOnly` only — no install hooks |
| Post-fix audit | **0 vulnerabilities** |
| Residual risk | Future transitive vulns in **devDeps** (Express example, tsup) — CI audit gate added |

---

## Recommended next steps (sellable product)

### Product / API security
1. **Optional auth for `serve`** — API keys or JWT; reject unauthenticated non-browser clients even when CORS origin is set.
2. **Default `allowedOrigin` to required** in a `serveProduction()` helper (fail closed).
3. **Request signing / app credentials** per `appId` so app IDs are not guessable quota buckets.
4. **Structured audit logging** (no prompts/PII by default; hashed IPs already partially done).
5. **Abuse ML / stronger injection defenses** beyond regex (or push to OpenClaw/gateway policy).

### Operational hardening
6. **External rate limiting** (Redis) + global concurrency caps + circuit breaker on upstream.
7. **Retry backoff** with jitter; distinguish 4xx (don’t fallback) vs 5xx/timeout.
8. **mTLS or private network** guidance for gateway ↔ client in cloud deployments.
9. **SLSA / provenance** for npm publishes; trusted publishing (OIDC) instead of long-lived `NPM_TOKEN`.

### Compliance / commercial readiness
10. **DPA / data retention** story for prompts when `onComplete` persists conversations.
11. **Security.txt / vulnerability disclosure** policy; private security contact.
12. **Penetration test** of `serve` before GA; fuzz JSON body + header paths.
13. **SOC2-oriented** change management: CODEOWNERS, required reviews, branch protection (CI already starts this).
14. **Remove or clearly isolate examples** from “copy-paste to production” paths in marketing docs.

### Testing
15. Expand integration tests with a mock gateway (TLS negative cases, timeout abort, fallback exhaustion).
16. Add Dependabot/Renovate + `npm audit` fail on moderate+ for releases.

---

## Residual risk acceptance

| Risk | Acceptance |
|------|------------|
| Regex jailbreak filters | Best-effort only; models can still be socially engineered |
| Unauthenticated `serve` (with CORS + rate limits) | Acceptable for low-sensitivity public widgets after setting `allowedOrigin`; not for high-cost models without keys |
| Local `http://127.0.0.1` default | Intentional for OpenClaw local-first |

---

## Verification

```bash
npm ci
npm audit --audit-level=high   # clean
npm run build                  # pass
npm test                       # pass
```

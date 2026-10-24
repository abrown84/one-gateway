# one-gateway

> Drop-in AI backend for anyone building an AI-powered app. OpenAI-compatible — one base URL, swap models without code changes, with built-in rate limits, cost caps, and security hardening.

```ts
import { complete } from "one-gateway";

const result = await complete("Summarize this in one sentence: ...");
console.log(result.content);
```

**Defaults to [Google Gemini](https://ai.google.dev/gemini-api/docs/openai)** via the OpenAI-compatible endpoint (`gemini-3.8-flash` chat, `gemini-embedding-2` embeddings). [OpenClaw](https://github.com/openclaw/openclaw) remains an optional alternative upstream.

```
Your app → one-gateway → Gemini (default)  or  OpenClaw → any provider
```

Want one set up for your app? [Brown Industries](https://brwnindustries.com)

---

## Why this exists

Every time you add AI to a product, you end up redoing provider keys, SDKs, usage caps, and model strings. **one-gateway** gives you a single OpenAI-compatible backend to point any app at: keep the same client code, change models in config, and keep upstream keys off the browser.

---

## Install

```bash
npm install one-gateway
```

Requires a Gemini API key (or an optional OpenClaw gateway).

---

## Quick start (Gemini)

### 1. Set env vars

```bash
ONE_GATEWAY_API_KEY=your_gemini_api_key
# or: GEMINI_API_KEY=...

# Optional overrides (these are the defaults):
ONE_GATEWAY_UPSTREAM_URL=https://generativelanguage.googleapis.com/v1beta/openai/
ONE_GATEWAY_MODEL=gemini-3.8-flash
ONE_GATEWAY_EMBEDDING_MODEL=gemini-embedding-2
```

### 2. Call it

```ts
import { complete, embed } from "one-gateway";

const { content, model } = await complete("What's 2 + 2?");
// model: "gemini-3.8-flash"

const { embedding } = await embed("semantic search query");
```

### Plug AI into any app

Point existing OpenAI clients at your gateway:

**JS fetch**
```js
const res = await fetch("https://your-gateway.example/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello from my app" }],
  }),
});
```

**OpenAI SDK (TypeScript)**
```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.ONE_GATEWAY_CLIENT_KEY || "unused",
  baseURL: "https://your-gateway.example/v1",
});

const completion = await client.chat.completions.create({
  model: "gemini-3.8-flash",
  messages: [{ role: "user", content: "Hello from my app" }],
});
```

**Python**
```python
from openai import OpenAI

client = OpenAI(
    api_key="unused",
    base_url="https://your-gateway.example/v1",
)
r = client.chat.completions.create(
    model="gemini-3.8-flash",
    messages=[{"role": "user", "content": "Hello from my app"}],
)
```

**curl**
```bash
curl "https://your-gateway.example/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello from my app"}]}'
```

---

## Optional: OpenClaw upstream

```bash
ONE_GATEWAY_UPSTREAM_URL=http://127.0.0.1:18789
ONE_GATEWAY_TOKEN=your_openclaw_gateway_token
ONE_GATEWAY_MODEL=openclaw
ONE_GATEWAY_AGENT=main
```

Legacy `OPENCLAW_*` env vars still work as fallbacks.

---

## API

### `complete(prompt, opts?)`

Send a prompt. Returns the first successful response across primary + fallback models.

```ts
const result = await complete("Write a haiku about TypeScript", {
  model: "gemini-3.8-flash",
  temperature: 0.7,
  maxTokens: 200,
});
```

### `embed(input, opts?)`

Create embeddings via the upstream OpenAI-compatible embeddings API.

### `createClient(config)`

Reusable client with explicit config — useful when you don't want env vars.

```ts
import { createClient } from "one-gateway";

const llm = createClient({
  token: process.env.GEMINI_API_KEY!,
  // baseUrl defaults to Gemini OpenAI-compat
});

const result = await llm.complete("What time is it on Mars?");
```

### `getConfig(env?)` / `getServeOptionsFromEnv(env?)`

Read client and `serve()` options from environment.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `ONE_GATEWAY_API_KEY` / `GEMINI_API_KEY` | *(required)* | Upstream API key (Gemini) |
| `ONE_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_TOKEN` | — | Alternative token (OpenClaw) |
| `ONE_GATEWAY_UPSTREAM_URL` / `ONE_GATEWAY_URL` | Gemini OpenAI base | Upstream base URL |
| `ONE_GATEWAY_MODEL` | `gemini-3.8-flash` | Primary chat model |
| `ONE_GATEWAY_EMBEDDING_MODEL` | `gemini-embedding-2` | Embeddings model |
| `ONE_GATEWAY_FALLBACKS` | *(none)* | Comma-separated fallback models |
| `ONE_GATEWAY_AGENT` | *(empty)* | OpenClaw agent ID (header only when set) |
| `ONE_GATEWAY_TEMPERATURE` | `0.2` | Temperature |
| `ONE_GATEWAY_MAX_TOKENS` | `500` | Max tokens |
| `ONE_GATEWAY_TIMEOUT_MS` | `45000` | Request timeout |

---

## Public playground + hardened `serve`

`one-gateway/serve` exposes a **public demo playground** (GET `/`) and OpenAI-compatible routes (`/v1/chat/completions`, `/v1/embeddings`, plus `/api/chat`). The upstream Gemini key stays server-side.

**Client auth defaults OFF** (public demo). Set `ONE_GATEWAY_SERVE_AUTH_KEY` only if you want Bearer auth for callers.

Demo bill guards (configurable via env):

- Per-IP rate limit (~10/min) and daily request cap (~50/day)
- Global daily request cap (`ONE_GATEWAY_GLOBAL_DAILY_CAP`)
- Max prompt length + max output tokens clamps
- Model allowlist
- Friendly `Demo limit reached` responses

```ts
import { serve, getConfig, getServeOptionsFromEnv } from "one-gateway";

serve(getConfig(), getServeOptionsFromEnv());
```

Or:

```bash
npm run serve
# → playground at http://127.0.0.1:3005/
```

**Built-in guardrails:**

- Per-IP rate limiting + burst protection (`trustProxy` only behind a trusted proxy)
- Global + per-IP daily request caps
- Prompt injection / jailbreak pattern blocking
- Origin enforcement (CORS) — set `allowedOrigin` in production
- Security rules appended to every system prompt
- Message sanitization (role validation, length limits, history depth)
- Gateway URL / header validation (TLS for remote, no CR/LF header injection)
- Secret redaction on error details

Smoke test a running instance:

```bash
GATEWAY_URL=http://127.0.0.1:3005 npm run smoke
```

---

## Run on a Linux VPS (Docker + reverse proxy)

### Docker

```bash
cp .env.example .env   # set ONE_GATEWAY_API_KEY / GEMINI_API_KEY
docker build -t one-gateway .
docker run --rm -p 127.0.0.1:3005:3005 --env-file .env \
  -e HOST=0.0.0.0 \
  -e ONE_GATEWAY_TRUST_PROXY=true \
  -e ONE_GATEWAY_ALLOWED_ORIGIN=https://yourdomain.com \
  one-gateway
```

### systemd

See [`examples/one-gateway.service`](./examples/one-gateway.service). Install the built app under `/opt/one-gateway`, place env in `/etc/one-gateway/one-gateway.env` (`chmod 600`), bind `HOST=127.0.0.1`, and enable the unit.

### Reverse proxy (Caddy example)

Terminate TLS at the proxy; keep Node on loopback. Enable `ONE_GATEWAY_TRUST_PROXY=true` so rate limits use `X-Forwarded-For`.

```caddyfile
yourdomain.com {
  reverse_proxy 127.0.0.1:3005
}
```

nginx sketch:

```nginx
server {
  listen 443 ssl;
  server_name yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:3005;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## Drop into any Express app

> **Security:** Never expose `complete()` behind an unauthenticated public route
> that forwards your upstream key without caps. Prefer [`serve`](#public-playground--hardened-serve) for browser-facing demos.

```ts
import express from "express";
import { complete } from "one-gateway";

const app = express();
app.use(express.json());

app.post("/api/llm", requireAuth, async (req, res) => {
  const result = await complete(req.body.prompt);
  res.json({ content: result.content, model: result.model });
});
```

See [`examples/express.ts`](./examples/express.ts) for a local demo that requires `PROXY_API_KEY`.

---

## License

MIT — [Brown Industries](https://brwnindustries.com)

---

Built by [Brown Industries](https://brwnindustries.com) · [Book an AI Ops Audit](https://brwnindustries.com/ai-ops)

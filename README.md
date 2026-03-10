# one-gateway

> Stop setting up LLM providers for every project. One client, one token, any model.

```ts
import { complete } from "one-gateway";

const result = await complete("Summarize this in one sentence: ...");
console.log(result.content);
```

---

## Why this exists

Every time I built a new app with AI features, I had to redo the same setup: API keys per provider, different SDKs, usage limits to track, model names scattered through the codebase. Switching from GPT to Claude meant touching half the project.

I was already running [OpenClaw](https://github.com/openclaw/openclaw) for auth and model routing, so I built **one-gateway** — a zero-dependency client that lets any app talk to the gateway through one simple interface. Now I can test AI features across projects without redoing provider setup every time. Swap models by changing one env var. Reuse existing auth. Share one usage limit across everything.

```
Your app → one-gateway → OpenClaw → Claude / GPT / OpenRouter / Ollama / ...
```

---

## Install

```bash
npm install one-gateway
```

Requires [OpenClaw](https://github.com/openclaw/openclaw) running locally or on your VPS.

---

## Quick start

### 1. Set env vars

```bash
ONE_GATEWAY_TOKEN=your_openclaw_gateway_token
ONE_GATEWAY_URL=http://127.0.0.1:18789   # default
```

### 2. Call it

```ts
import { complete } from "one-gateway";

const { content, model } = await complete("What's 2 + 2?");
// content: "4"
// model:   "openclaw"
```

That's it. OpenClaw handles which provider and model actually runs it.

---

## API

### `complete(prompt, opts?)`

Send a prompt. Returns the first successful response across primary + fallback models.

```ts
const result = await complete("Write a haiku about TypeScript", {
  model: "openclaw",      // optional override
  temperature: 0.7,
  maxTokens: 200,
});
```

**Multi-turn:**

```ts
const result = await complete("", {
  messages: [
    { role: "system", content: "You are a pirate." },
    { role: "user", content: "Where's the treasure?" },
  ],
});
```

---

### `createClient(config)`

Reusable client with explicit config — useful when you don't want env vars.

```ts
import { createClient } from "one-gateway";

const llm = createClient({
  token: "your_gateway_token",
  baseUrl: "http://127.0.0.1:18789",
  primaryModel: "openclaw",
  agentId: "main",   // route to a specific OpenClaw agent
});

const result = await llm.complete("What time is it on Mars?");
```

---

### `getConfig(env?)`

Read config from environment. Useful for building your own wrapper.

```ts
import { getConfig } from "one-gateway";
const config = getConfig(process.env);
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `ONE_GATEWAY_TOKEN` | *(required)* | Your OpenClaw gateway token |
| `ONE_GATEWAY_URL` | `http://127.0.0.1:18789` | Gateway base URL |
| `ONE_GATEWAY_MODEL` | `openclaw` | Primary model |
| `ONE_GATEWAY_FALLBACKS` | *(none)* | Comma-separated fallback models |
| `ONE_GATEWAY_AGENT` | `main` | OpenClaw agent ID |
| `ONE_GATEWAY_TEMPERATURE` | `0.2` | Temperature |
| `ONE_GATEWAY_MAX_TOKENS` | `500` | Max tokens |
| `ONE_GATEWAY_TIMEOUT_MS` | `45000` | Request timeout |

> Legacy `OPENCLAW_*` env vars also supported as fallbacks.

---

## Run a hardened public chat proxy

Use `one-gateway/serve` to expose a chat endpoint for frontends — with rate limiting, token budgeting, and prompt injection protection baked in. System prompts live server-side only; clients send an `appId` and never touch the prompt.

```ts
import { serve, getConfig } from "one-gateway";

serve(getConfig(), {
  port: 3005,
  allowedOrigin: "https://yourdomain.com",
  apps: {
    support: {
      systemPrompt: "You are a customer support agent for Acme Corp...",
      maxTokens: 300,
    },
    sales: {
      systemPrompt: "You are the sales assistant for Acme Corp. Services cost...",
      maxTokens: 350,
    },
  },
  rateLimit: 20,       // requests per IP per minute
  dailyTokenCap: 10000 // tokens per IP per day
});
```

Frontend just sends:
```js
fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ appId: "support", messages: [{ role: "user", content: "hi" }] })
});
```

**Built-in guardrails:**
- Per-IP rate limiting + burst protection
- Daily token budget per IP
- Prompt injection / jailbreak pattern blocking
- Origin enforcement (CORS)
- Security rules appended to every system prompt — model instructed to refuse credential/instruction disclosure
- Message sanitization (role validation, length limits, history depth)

---

## Drop into any Express app

```ts
import express from "express";
import { complete } from "one-gateway";

const app = express();
app.use(express.json());

app.post("/api/llm", async (req, res) => {
  const result = await complete(req.body.prompt);
  res.json({ content: result.content, model: result.model });
});
```

See [`examples/express.ts`](./examples/express.ts) for a full working version.

---

## What you get with OpenClaw

- **One token** — single auth layer across all providers
- **Model swapping** — change the model in config, not in code
- **OAuth profiles** — Codex, Claude, OpenRouter without managing multiple keys
- **Agent routing** — target different OpenClaw agents from the same app
- **Local-first** — gateway on your machine or VPS, data stays yours

[Get OpenClaw →](https://github.com/openclaw/openclaw)

---

## License

MIT — [Brown Industries](https://brwnindustries.com)

# once-gateway

> One endpoint. Any model. Route Claude, GPT, and anything else through your local [OpenClaw](https://github.com/openclaw/openclaw) gateway — without changing a line of app code.

```ts
import { complete } from "once-gateway";

const result = await complete("Summarize this in one sentence: ...");
console.log(result.content);
```

---

## The problem

Every LLM integration is the same slog: hard-coded API keys, provider-specific SDKs, model names scattered across your codebase. Switch from GPT to Claude? Refactor everything. Want fallbacks? Write it yourself.

## The idea

[OpenClaw](https://github.com/openclaw/openclaw) runs a local OpenAI-compatible gateway on your machine. It handles auth, model routing, and provider switching internally. **once-gateway** is a zero-dependency client that speaks to it — so your app only ever talks to one endpoint, and you swap models by changing a config line, not your code.

```
Your app → once-gateway → OpenClaw → Claude / GPT / OpenRouter / ...
```

---

## Install

```bash
npm install once-gateway
```

Requires [OpenClaw](https://github.com/openclaw/openclaw) running locally (or on your VPS with a tunnel).

---

## Quick start

### 1. Get your gateway token

```bash
# In your openclaw.json → gateway.auth.token
# Or run: openclaw gateway status
```

### 2. Set env vars

```bash
cp .env.example .env
# Set ONCE_GATEWAY_TOKEN=your_token_here
```

### 3. Call it

```ts
import { complete } from "once-gateway";

const { content, model } = await complete("What's 2 + 2?");
// content: "4"
// model:   "openclaw" (or whatever OpenClaw routed to)
```

---

## API

### `complete(prompt, opts?)`

Send a prompt. Returns the first successful response across primary + fallback models.

```ts
const result = await complete("Write a haiku about TypeScript", {
  model: "openclaw",         // optional override
  temperature: 0.7,          // optional
  maxTokens: 200,            // optional
});
```

**Multi-turn conversations:**

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

Create a reusable client with explicit config — useful when you don't want to rely on env vars.

```ts
import { createClient } from "once-gateway";

const llm = createClient({
  token: "your_gateway_token",
  baseUrl: "http://127.0.0.1:18789",
  primaryModel: "openclaw",
  agentId: "main",           // route to a specific OpenClaw agent
});

const result = await llm.complete("What time is it on Mars?");
```

---

### `getConfig(env?)`

Read config from environment variables. Useful for building your own client.

```ts
import { getConfig } from "once-gateway";

const config = getConfig(process.env);
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `ONCE_GATEWAY_TOKEN` | *(required)* | Your OpenClaw gateway token |
| `ONCE_GATEWAY_URL` | `http://127.0.0.1:18789` | Gateway base URL |
| `ONCE_GATEWAY_MODEL` | `openclaw` | Primary model field |
| `ONCE_GATEWAY_FALLBACKS` | *(none)* | Comma-separated fallback models |
| `ONCE_GATEWAY_AGENT` | `main` | OpenClaw agent/session ID |
| `ONCE_GATEWAY_TEMPERATURE` | `0.2` | Temperature |
| `ONCE_GATEWAY_MAX_TOKENS` | `500` | Max tokens |
| `ONCE_GATEWAY_TIMEOUT_MS` | `45000` | Request timeout |

> Legacy `OPENCLAW_*` env vars are also supported as fallbacks.

---

## Express example

Drop this into any Express app:

```ts
import express from "express";
import { complete } from "once-gateway";

const app = express();
app.use(express.json());

app.post("/api/llm", async (req, res) => {
  const result = await complete(req.body.prompt);
  res.json({ content: result.content, model: result.model });
});
```

See [`examples/express.ts`](./examples/express.ts) for a full working version.

---

## Why OpenClaw?

OpenClaw gives you:
- **Local-first** — gateway runs on your machine or VPS, your data never leaves
- **One token** — single auth layer for all providers
- **OAuth profiles** — route to Codex, Claude, OpenRouter without managing multiple keys
- **Agent routing** — `agentId` lets you target different OpenClaw agents from the same app
- **Model fallbacks** — OpenClaw handles retry/routing; once-gateway handles the client side

[Get OpenClaw →](https://github.com/openclaw/openclaw)

---

## License

MIT — [Brown Industries](https://brwnindustries.com)

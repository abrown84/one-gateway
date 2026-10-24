/**
 * Public demo playground HTML served by `serve()` at GET /.
 * Upstream API keys never appear in this page.
 */

export type PlaygroundPageOpts = {
  allowedModels: string[];
  defaultModel: string;
  maxPromptChars: number;
  maxOutputTokens: number;
  authRequired: boolean;
  rateLimit: number;
  dailyRequestCap: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPlaygroundPage(opts: PlaygroundPageOpts): string {
  const modelsJson = JSON.stringify(opts.allowedModels);
  const defaultModel = escapeHtml(opts.defaultModel);
  const modelOptions = opts.allowedModels
    .map(
      (m) =>
        `<option value="${escapeHtml(m)}"${m === opts.defaultModel ? " selected" : ""}>${escapeHtml(m)}</option>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>one-gateway — drop-in AI backend</title>
  <meta name="description" content="one-gateway: OpenAI-compatible AI backend with rate limits, cost caps, and security hardening. Plug AI into any app." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #071410;
      --forest: #0d2a22;
      --moss: #1a4a3a;
      --mist: #d7e8df;
      --paper: #eef6f1;
      --accent: #b8e04a;
      --accent-ink: #13240a;
      --muted: #8aa99a;
      --danger: #e8a07a;
      --line: rgba(215, 232, 223, 0.14);
      --glow: rgba(184, 224, 74, 0.12);
      --font-display: "Syne", system-ui, sans-serif;
      --font-body: "Figtree", system-ui, sans-serif;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font-body);
      color: var(--paper);
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(184, 224, 74, 0.16), transparent 55%),
        radial-gradient(900px 500px at 90% 0%, rgba(45, 120, 95, 0.35), transparent 50%),
        linear-gradient(165deg, #061510 0%, var(--forest) 42%, #0a1c18 100%);
      background-attachment: fixed;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.04;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      z-index: 0;
    }

    .wrap {
      position: relative;
      z-index: 1;
      width: min(920px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2.5rem 0 4rem;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes blink {
      0%, 45% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    .hero {
      animation: rise 0.7s ease both;
      margin-bottom: 2rem;
    }

    .brand {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: clamp(2.4rem, 7vw, 3.6rem);
      letter-spacing: -0.04em;
      line-height: 0.95;
      margin: 0 0 0.85rem;
      background: linear-gradient(120deg, var(--paper) 20%, var(--accent) 90%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .tagline {
      font-size: 1.15rem;
      line-height: 1.45;
      color: var(--mist);
      max-width: 36rem;
      margin: 0 0 0.5rem;
      font-weight: 500;
    }

    .sub {
      color: var(--muted);
      font-size: 0.95rem;
      margin: 0;
      max-width: 34rem;
    }

    .panel {
      animation: rise 0.75s ease 0.08s both;
      border: 1px solid var(--line);
      background: rgba(7, 20, 16, 0.55);
      backdrop-filter: blur(10px);
      border-radius: 18px;
      padding: 1.25rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    }

    label {
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.4rem;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.9rem;
      margin-bottom: 0.9rem;
    }
    @media (min-width: 640px) {
      .row.two { grid-template-columns: 1.4fr 1fr; }
    }

    textarea, select, input[type="password"] {
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(13, 42, 34, 0.75);
      color: var(--paper);
      border-radius: 12px;
      padding: 0.85rem 1rem;
      font: inherit;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
    textarea:focus, select:focus, input:focus {
      border-color: rgba(184, 224, 74, 0.55);
      box-shadow: 0 0 0 3px var(--glow);
    }
    select { cursor: pointer; appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, var(--accent) 50%),
        linear-gradient(135deg, var(--accent) 50%, transparent 50%);
      background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
      background-size: 6px 6px, 6px 6px;
      background-repeat: no-repeat;
      padding-right: 2.2rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      align-items: center;
      margin-top: 0.2rem;
    }

    button {
      font-family: var(--font-display);
      font-weight: 700;
      border: none;
      border-radius: 999px;
      padding: 0.8rem 1.35rem;
      cursor: pointer;
      background: var(--accent);
      color: var(--accent-ink);
      transition: transform 0.15s ease, filter 0.15s ease, opacity 0.15s;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
    button:active:not(:disabled) { transform: translateY(0); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    button.ghost {
      background: transparent;
      color: var(--mist);
      border: 1px solid var(--line);
    }

    .meta {
      font-size: 0.82rem;
      color: var(--muted);
    }

    .out {
      margin-top: 1rem;
      min-height: 8rem;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.28);
      padding: 1rem 1.1rem;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
      color: var(--mist);
      font-size: 0.98rem;
    }
    .out.empty { color: var(--muted); }
    .out .cursor {
      display: inline-block;
      width: 0.55ch;
      height: 1.05em;
      margin-left: 1px;
      background: var(--accent);
      vertical-align: text-bottom;
      animation: blink 1s step-end infinite;
    }
    .out.error { color: var(--danger); border-color: rgba(232, 160, 122, 0.35); }

    .limits {
      margin-top: 0.85rem;
      font-size: 0.8rem;
      color: var(--muted);
    }

    section.plug {
      animation: rise 0.8s ease 0.16s both;
      margin-top: 3.25rem;
    }

    section.plug h2 {
      font-family: var(--font-display);
      font-size: clamp(1.6rem, 4vw, 2.1rem);
      letter-spacing: -0.03em;
      margin: 0 0 0.65rem;
    }
    section.plug > p {
      color: var(--mist);
      max-width: 40rem;
      line-height: 1.55;
      margin: 0 0 1.25rem;
    }

    .bullets {
      list-style: none;
      padding: 0;
      margin: 0 0 1.5rem;
      display: grid;
      gap: 0.55rem;
    }
    .bullets li {
      position: relative;
      padding-left: 1.35rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .bullets li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 2px;
      background: var(--accent);
      transform: rotate(45deg);
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }
    .tabs button {
      border-radius: 10px;
      padding: 0.45rem 0.8rem;
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.85rem;
      background: rgba(13, 42, 34, 0.8);
      color: var(--mist);
      border: 1px solid var(--line);
    }
    .tabs button[aria-selected="true"] {
      background: var(--accent);
      color: var(--accent-ink);
      border-color: transparent;
    }

    .code-wrap {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #040c0a;
      overflow: hidden;
    }
    .code-wrap pre {
      margin: 0;
      padding: 1rem 1.1rem 1.2rem;
      overflow-x: auto;
      font-size: 0.82rem;
      line-height: 1.5;
      color: #c5ddd0;
    }
    .code-wrap code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
    .copy {
      position: absolute;
      top: 0.55rem;
      right: 0.55rem;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      border-radius: 8px;
    }

    .cta {
      margin-top: 1.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      align-items: center;
    }
    .cta a.primary {
      display: inline-flex;
      align-items: center;
      font-family: var(--font-display);
      font-weight: 700;
      text-decoration: none;
      background: var(--accent);
      color: var(--accent-ink);
      padding: 0.85rem 1.3rem;
      border-radius: 999px;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .cta a.primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
    .cta span { color: var(--muted); font-size: 0.9rem; }

    footer.site {
      margin-top: 3.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: space-between;
      align-items: baseline;
      color: var(--muted);
      font-size: 0.9rem;
      animation: rise 0.85s ease 0.22s both;
    }
    footer.site a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    footer.site a:hover { text-decoration: underline; }

    .auth-row { display: none; }
    .auth-row.on { display: block; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1 class="brand">one-gateway</h1>
      <p class="tagline">Drop-in AI backend for any app — OpenAI-compatible, one base URL, swap models without code changes.</p>
      <p class="sub">Try the public demo below. Your prompts go through this gateway; the upstream provider key stays on the server.</p>
    </header>

    <div class="panel" id="demo">
      <div class="row two">
        <div>
          <label for="model">Model</label>
          <select id="model">${modelOptions}</select>
        </div>
        <div class="auth-row${opts.authRequired ? " on" : ""}" id="authRow">
          <label for="auth">Client auth key</label>
          <input id="auth" type="password" autocomplete="off" placeholder="Bearer token (if required)" />
        </div>
      </div>
      <div>
        <label for="prompt">Prompt</label>
        <textarea id="prompt" maxlength="${opts.maxPromptChars}" placeholder="Ask anything…"></textarea>
      </div>
      <div class="actions">
        <button type="button" id="send">Run</button>
        <button type="button" class="ghost" id="stop" disabled>Stop</button>
        <span class="meta" id="status">Ready</span>
      </div>
      <div class="out empty" id="out" aria-live="polite">Response streams here.</div>
      <p class="limits">Demo limits: ~${opts.rateLimit} requests/min and ~${opts.dailyRequestCap}/day per IP · max ${opts.maxPromptChars} chars · max ${opts.maxOutputTokens} output tokens · allowlisted models only.</p>
    </div>

    <section class="plug" id="plug">
      <h2>Plug AI into any app</h2>
      <p>
        one-gateway is an OpenAI-compatible backend you can point any app at.
        One base URL, swap models without code changes, with built-in rate limits,
        cost caps, and security hardening — so you are not wiring raw provider keys into every project.
      </p>
      <ul class="bullets">
        <li>OpenAI-compatible <code>/v1/chat/completions</code> and embeddings</li>
        <li>Change models via config — keep the same client code</li>
        <li>Per-IP rate limits, daily caps, prompt/output clamps, model allowlist</li>
        <li>Upstream keys stay server-side; header sanitization and TLS checks included</li>
      </ul>

      <div class="tabs" role="tablist" aria-label="Code examples">
        <button type="button" role="tab" aria-selected="true" data-tab="fetch">JS fetch</button>
        <button type="button" role="tab" aria-selected="false" data-tab="sdk">OpenAI SDK</button>
        <button type="button" role="tab" aria-selected="false" data-tab="py">Python</button>
        <button type="button" role="tab" aria-selected="false" data-tab="curl">curl</button>
      </div>

      <div class="code-wrap" data-panel="fetch">
        <button type="button" class="copy ghost" data-copy="fetch">Copy</button>
        <pre><code id="ex-fetch"></code></pre>
      </div>
      <div class="code-wrap" data-panel="sdk" hidden>
        <button type="button" class="copy ghost" data-copy="sdk">Copy</button>
        <pre><code id="ex-sdk"></code></pre>
      </div>
      <div class="code-wrap" data-panel="py" hidden>
        <button type="button" class="copy ghost" data-copy="py">Copy</button>
        <pre><code id="ex-py"></code></pre>
      </div>
      <div class="code-wrap" data-panel="curl" hidden>
        <button type="button" class="copy ghost" data-copy="curl">Copy</button>
        <pre><code id="ex-curl"></code></pre>
      </div>

      <div class="cta">
        <a class="primary" href="https://brwnindustries.com" target="_blank" rel="noopener noreferrer">Want one set up for your app? Brown Industries</a>
        <span>We wire the gateway, hardening, and model routing into your stack.</span>
      </div>
    </section>

    <footer class="site">
      <span>Built by <a href="https://brwnindustries.com" target="_blank" rel="noopener noreferrer">Brown Industries</a></span>
      <span>one-gateway · MIT</span>
    </footer>
  </div>

  <script>
    const ALLOWED = ${modelsJson};
    const DEFAULT_MODEL = ${JSON.stringify(opts.defaultModel)};
    const MAX_PROMPT = ${opts.maxPromptChars};
    const AUTH_REQUIRED = ${opts.authRequired ? "true" : "false"};

    // Base-path aware: under nginx rewrite mounts (e.g. /labs/one-gateway),
    // location.origin alone would omit the prefix.
    const base =
      location.origin +
      location.pathname.replace(/\\/index\\.html$/i, "").replace(/\\/$/, "");
    const examples = {
      fetch: \`// Point your app at this gateway (OpenAI-compatible)
// e.g. https://brwnindustries.com/labs/one-gateway/v1/chat/completions
const res = await fetch("\${base}/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "\${DEFAULT_MODEL}",
    messages: [{ role: "user", content: "Hello from my app" }],
  }),
});
const data = await res.json();
console.log(data.choices[0].message.content);\`,
      sdk: \`import OpenAI from "openai";

// Drop-in: same SDK, your gateway as baseURL (no auth token required)
const client = new OpenAI({
  apiKey: "unused",
  baseURL: "\${base}/v1",
});

const completion = await client.chat.completions.create({
  model: "\${DEFAULT_MODEL}",
  messages: [{ role: "user", content: "Hello from my app" }],
});
console.log(completion.choices[0].message.content);\`,
      py: \`from openai import OpenAI

# Drop-in: same SDK, your gateway as base_url (no auth token required)
client = OpenAI(
    api_key="unused",
    base_url="\${base}/v1",
)

r = client.chat.completions.create(
    model="\${DEFAULT_MODEL}",
    messages=[{"role": "user", "content": "Hello from my app"}],
)
print(r.choices[0].message.content)\`,
      curl: \`curl "\${base}/v1/chat/completions" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "model": "\${DEFAULT_MODEL}",
    "messages": [{"role": "user", "content": "Hello from my app"}]
  }'\`,
    };

    for (const [k, v] of Object.entries(examples)) {
      document.getElementById("ex-" + k).textContent = v;
    }

    document.querySelectorAll(".tabs [role=tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tabs [role=tab]").forEach((t) => t.setAttribute("aria-selected", "false"));
        tab.setAttribute("aria-selected", "true");
        const id = tab.getAttribute("data-tab");
        document.querySelectorAll(".code-wrap").forEach((p) => {
          p.hidden = p.getAttribute("data-panel") !== id;
        });
      });
    });

    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.getAttribute("data-copy");
        try {
          await navigator.clipboard.writeText(examples[key]);
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = "Copy"; }, 1200);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => { btn.textContent = "Copy"; }, 1200);
        }
      });
    });

    const promptEl = document.getElementById("prompt");
    const modelEl = document.getElementById("model");
    const outEl = document.getElementById("out");
    const statusEl = document.getElementById("status");
    const sendBtn = document.getElementById("send");
    const stopBtn = document.getElementById("stop");
    let abort = null;

    function authHeaders() {
      const h = { "Content-Type": "application/json" };
      const key = document.getElementById("auth")?.value?.trim();
      if (key) h["Authorization"] = "Bearer " + key;
      return h;
    }

    stopBtn.addEventListener("click", () => { abort?.abort(); });

    sendBtn.addEventListener("click", async () => {
      const prompt = promptEl.value.trim();
      if (!prompt) {
        outEl.className = "out error";
        outEl.textContent = "Enter a prompt to continue.";
        return;
      }
      if (AUTH_REQUIRED && !document.getElementById("auth")?.value?.trim()) {
        outEl.className = "out error";
        outEl.textContent = "This demo requires a client auth key.";
        return;
      }

      abort = new AbortController();
      sendBtn.disabled = true;
      stopBtn.disabled = false;
      statusEl.textContent = "Streaming…";
      outEl.className = "out";
      outEl.textContent = "";
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      outEl.appendChild(cursor);

      try {
        const res = await fetch(base + "/v1/chat/completions", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            model: modelEl.value,
            stream: true,
            messages: [{ role: "user", content: prompt.slice(0, MAX_PROMPT) }],
          }),
          signal: abort.signal,
        });

        if (!res.ok) {
          let msg = "Request failed (" + res.status + ").";
          try {
            const j = await res.json();
            if (j && j.error) msg = j.error;
          } catch {}
          outEl.className = "out error";
          outEl.textContent = msg;
          statusEl.textContent = "Error";
          return;
        }

        const ctype = res.headers.get("content-type") || "";
        if (ctype.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\\n");
            buf = parts.pop() || "";
            for (const line of parts) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content
                  ?? json.choices?.[0]?.message?.content
                  ?? "";
                if (delta) {
                  text += delta;
                  outEl.textContent = text;
                  outEl.appendChild(cursor);
                }
              } catch {}
            }
          }
          outEl.textContent = text || "(empty response)";
          statusEl.textContent = "Done";
        } else {
          const j = await res.json();
          outEl.textContent = j.content || "(empty response)";
          statusEl.textContent = "Done";
        }
      } catch (e) {
        if (e.name === "AbortError") {
          statusEl.textContent = "Stopped";
        } else {
          outEl.className = "out error";
          outEl.textContent = e.message || "Network error";
          statusEl.textContent = "Error";
        }
      } finally {
        sendBtn.disabled = false;
        stopBtn.disabled = true;
        abort = null;
        const c = outEl.querySelector(".cursor");
        if (c) c.remove();
      }
    });

    // silence unused
    void ALLOWED;
  </script>
</body>
</html>`;
}

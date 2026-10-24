// Basic usage example — runs with: npm run example
// Requires ONE_GATEWAY_API_KEY or GEMINI_API_KEY (or OpenClaw token) in .env

import { complete } from "../dist/index.js";

const prompt = process.argv.slice(2).join(" ") || "Reply with exactly: pong";

try {
  const result = await complete(prompt);
  console.log("model  :", result.model);
  console.log("reply  :", result.content);
} catch (err) {
  console.error("failed :", err.message);
  process.exitCode = 1;
}

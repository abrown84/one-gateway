/**
 * CLI entry: node dist/bin/serve.js
 * Reads Gemini/OpenClaw config + demo serve options from env.
 */
import { getConfig, getServeOptionsFromEnv } from "../config.js";
import { serve } from "../serve.js";

const config = getConfig();
const opts = getServeOptionsFromEnv();
serve(config, opts);

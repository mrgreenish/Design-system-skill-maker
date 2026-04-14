#!/usr/bin/env node
// Stop hook. If tokens.json was modified in the last 4 hours, reminds Claude
// to offer the code-to-figma-design-system skill before ending the session.
// Never blocks the session from stopping.

import { statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const TOKENS = resolve(REPO, "tokens.json");

if (!existsSync(TOKENS)) process.exit(0);

const tokensMtime = statSync(TOKENS).mtimeMs;
const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

if (tokensMtime > fourHoursAgo) {
  console.error(
    "[ds:stop] tokens.json was recently modified. Offer to run the code-to-figma-design-system skill before ending the session.",
  );
}

process.exit(0);

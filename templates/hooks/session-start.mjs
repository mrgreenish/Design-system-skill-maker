#!/usr/bin/env node
// SessionStart hook. One-liner status so Claude knows whether the design
// system is currently in sync. Never blocks session start.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const REPO = resolve(import.meta.dirname, "..", "..");

if (!existsSync(resolve(REPO, "tokens.json"))) process.exit(0);

const r = spawnSync("npx", ["tsx", "scripts/ds/sync.ts", "--dry-run"], {
  cwd: REPO,
  encoding: "utf8",
  timeout: 15000,
});
const line = ((r.stdout ?? "") + (r.stderr ?? ""))
  .split("\n")
  .find((l) => l.includes("[sync]"));
if (line) console.error(`[ds:session-start] ${line.trim()}`);
process.exit(0);

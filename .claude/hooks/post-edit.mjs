#!/usr/bin/env node
// PostToolUse hook. Reads the tool-call JSON on stdin; if the edited file is
// tokens.json, runs a dry-run sync and echoes the summary so Claude knows
// whether a Figma push is pending. If the edited file is tailwind.config.ts
// outside the generated block, warns that hand edits don't round-trip.
//
// Silent on unrelated edits (other tools, other files). Exits 0 always —
// never fail the user's edit because of this hook.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, basename } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");

async function readStdin() {
  return await new Promise((r) => {
    let buf = "";
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => r(buf));
    // If stdin is closed with nothing, resolve after a tick.
    setTimeout(() => r(buf), 50);
  });
}

function extractPaths(payload) {
  // Tool input shapes vary across Edit / Write / MultiEdit. We check common keys.
  const input = payload?.tool_input ?? {};
  const paths = [];
  if (typeof input.file_path === "string") paths.push(input.file_path);
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) if (typeof e.file_path === "string") paths.push(e.file_path);
  }
  return paths;
}

function inGeneratedBlock(tailwindPath) {
  try {
    const src = readFileSync(tailwindPath, "utf8");
    const begin = src.indexOf("BEGIN GENERATED");
    const end = src.indexOf("END GENERATED");
    return begin !== -1 && end !== -1;
  } catch {
    return false;
  }
}

(async () => {
  const raw = await readStdin();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

  const paths = extractPaths(payload);
  const touchedTokens = paths.some((p) => basename(p) === "tokens.json");
  const touchedTailwind = paths.some((p) => basename(p) === "tailwind.config.ts");

  if (!touchedTokens && !touchedTailwind) process.exit(0);

  if (touchedTokens) {
    const r = spawnSync("npx", ["tsx", "scripts/sync.ts", "--dry-run", "--direction=code-to-figma"], {
      cwd: REPO,
      encoding: "utf8",
    });
    const line = (r.stdout || r.stderr || "").split("\n").find((l) => l.includes("[sync]")) ?? "";
    console.error(`[ds] tokens.json changed — ${line.trim() || "sync dry-run unavailable"}`);
  }

  if (touchedTailwind && inGeneratedBlock(resolve(REPO, "tailwind.config.ts"))) {
    console.error(
      "[ds] tailwind.config.ts edited — remember that the BEGIN/END GENERATED block is overwritten by `npm run ds:build`. Put hand-written config outside those markers.",
    );
  }
})();

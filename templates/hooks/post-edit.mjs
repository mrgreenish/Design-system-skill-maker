#!/usr/bin/env node
// PostToolUse hook. Reads the tool-call JSON on stdin; if the edited file is
// tokens.json, reminds Claude to offer the Figma push skill. Silent on all
// other edits. Exits 0 always — never fail the user's edit because of this hook.

import { resolve, basename } from "node:path";

async function readStdin() {
  return await new Promise((r) => {
    let buf = "";
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      r(buf);
    };
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", done);
    process.stdin.on("error", done);
    const timer = setTimeout(done, 5000);
  });
}

function extractPaths(payload) {
  const input = payload?.tool_input ?? {};
  const paths = [];
  if (typeof input.file_path === "string") paths.push(input.file_path);
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) if (typeof e.file_path === "string") paths.push(e.file_path);
  }
  return paths;
}

(async () => {
  const raw = await readStdin();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

  const paths = extractPaths(payload);
  const touchedTokens = paths.some((p) => basename(p) === "tokens.json");

  if (!touchedTokens) process.exit(0);

  console.error(
    "[ds] tokens.json changed — offer to run the code-to-figma-design-system skill if the user wants to push to Figma.",
  );
})();

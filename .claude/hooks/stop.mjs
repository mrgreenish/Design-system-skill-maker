#!/usr/bin/env node
// Stop hook. If tokens.json has been modified but tokens.lock.json has not
// been updated (syncedAt older than tokens.json mtime), remind Claude to
// offer the sync-code-to-figma skill before stopping.

import { statSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");
const TOKENS = resolve(REPO, "tokens.json");
const LOCK = resolve(REPO, "tokens.lock.json");

if (!existsSync(TOKENS) || !existsSync(LOCK)) process.exit(0);

const tokensMtime = statSync(TOKENS).mtimeMs;
let lockSyncedAt = 0;
try {
  const lock = JSON.parse(readFileSync(LOCK, "utf8"));
  lockSyncedAt = lock.syncedAt ? Date.parse(lock.syncedAt) : 0;
} catch { /* ignore */ }

if (tokensMtime > lockSyncedAt) {
  console.error(
    "[ds:stop] tokens.json has changed since the last sync. Offer to run the sync-code-to-figma skill before ending the session.",
  );
}
process.exit(0);

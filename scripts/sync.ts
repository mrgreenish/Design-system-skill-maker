#!/usr/bin/env tsx
/**
 * Bi-directional sync orchestrator.
 *
 *   tsx scripts/sync.ts [--direction=auto|code-to-figma|figma-to-code]
 *                      [--dry-run]
 *                      [--only=color,space]
 *
 * Contract with Claude / the skills:
 *
 *   - Claude populates .figma-cache/variables.json via Dev Mode MCP reads
 *     before invoking this script (the sync-code-to-figma skill handles
 *     this).
 *   - This script reads tokens.json (code SoT) + .figma-cache + tokens.lock.json,
 *     runs the three-way diff, and writes one of:
 *
 *       a) .sync-plan.json       — ops for Claude to execute on Figma
 *       b) sync-conflict.md      — human-readable conflict report
 *
 *   - On --dry-run we only print the summary; we do not write any files.
 *   - On success (no conflicts), tokens.lock.json is updated to the
 *     merged hash set ONLY when the caller passes --commit-lock, which
 *     the skill invokes after it confirms the Figma writes landed.
 *
 * Exit codes: 0 = in sync / planned. 2 = conflicts detected. 1 = error.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { flatten, hashAll, type DtcgGroup } from "./tokens.ts";
import { diffTokens, summarize, type DiffEntry } from "./diff-tokens.ts";
import { figmaToFlat, loadCache } from "./figma-read.ts";
import { buildPlan, type WritePlan } from "./figma-write.ts";
import { run as regenerateCode } from "./tokens-to-tailwind.ts";

const ROOT = resolve(import.meta.dirname, "..");
const TOKENS = resolve(ROOT, "tokens.json");
const LOCK = resolve(ROOT, "tokens.lock.json");
const PLAN = resolve(ROOT, ".sync-plan.json");
const CONFLICT = resolve(ROOT, "sync-conflict.md");

interface Args {
  direction: "auto" | "code-to-figma" | "figma-to-code";
  dryRun: boolean;
  commitLock: boolean;
  only?: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { direction: "auto", dryRun: false, commitLock: false };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--commit-lock") args.commitLock = true;
    else if (a.startsWith("--direction=")) {
      const v = a.slice("--direction=".length);
      if (v === "auto" || v === "code-to-figma" || v === "figma-to-code") args.direction = v;
    } else if (a.startsWith("--only=")) {
      args.only = a.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

function filterByPrefix<T extends { path: string }>(entries: T[], only?: string[]): T[] {
  if (!only || only.length === 0) return entries;
  return entries.filter((e) => only.some((p) => e.path === p || e.path.startsWith(`${p}.`)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(TOKENS)) {
    console.error(`[sync] tokens.json not found at ${TOKENS}`);
    process.exit(1);
  }
  const tree = JSON.parse(readFileSync(TOKENS, "utf8")) as DtcgGroup;
  const codeFlat = filterByPrefix(flatten(tree), args.only);
  const codeHashes = hashAll(codeFlat);

  const cache = loadCache();
  const figmaFlat = cache ? filterByPrefix(figmaToFlat(cache), args.only) : [];
  const figmaHashes = hashAll(figmaFlat);

  const lock = existsSync(LOCK)
    ? (JSON.parse(readFileSync(LOCK, "utf8")) as { hashes: Record<string, string> }).hashes ?? {}
    : {};

  const diff = diffTokens(codeHashes, figmaHashes, lock);
  const summary = summarize(diff);

  printSummary(diff, summary, args, !!cache);

  if (summary.conflicts.length > 0) {
    if (!args.dryRun) writeConflictReport(diff);
    console.error(`[sync] ${summary.conflicts.length} conflict(s). See ${CONFLICT}.`);
    process.exit(2);
  }

  // Decide direction.
  const wantCodeToFigma =
    args.direction === "code-to-figma" ||
    (args.direction === "auto" && summary.oneSided.some((e) => e.status.endsWith("-code") || e.status === "removed-figma"));
  const wantFigmaToCode =
    args.direction === "figma-to-code" ||
    (args.direction === "auto" && summary.oneSided.some((e) => e.status.endsWith("-figma") || e.status === "removed-code"));

  if (wantFigmaToCode && !args.dryRun) {
    applyFigmaToCode(tree, figmaFlat);
    await regenerateCode();
  }

  if (wantCodeToFigma) {
    const plan: WritePlan = buildPlan(diff, codeFlat, cache?.fileKey);
    if (!args.dryRun) {
      writeFileSync(PLAN, JSON.stringify(plan, null, 2));
      console.log(`[sync] wrote ${PLAN} (${plan.operations.length} op(s), ${plan.manual.length} manual)`);
    } else {
      console.log(`[sync] (dry-run) would plan ${plan.operations.length} op(s), ${plan.manual.length} manual`);
    }
  }

  if (args.commitLock && !args.dryRun) {
    const merged = { ...figmaHashes, ...codeHashes };
    writeFileSync(
      LOCK,
      JSON.stringify(
        {
          $description: "Per-token hash from the last successful sync. Do not hand-edit.",
          version: 1,
          syncedAt: new Date().toISOString(),
          hashes: merged,
        },
        null,
        2,
      ),
    );
    console.log(`[sync] committed ${LOCK}`);
  }

  process.exit(0);
}

function printSummary(diff: DiffEntry[], s: ReturnType<typeof summarize>, args: Args, hasFigma: boolean) {
  const byStatus: Record<string, number> = {};
  for (const e of diff) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
  const parts = Object.entries(byStatus)
    .filter(([k]) => k !== "unchanged")
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  const figmaNote = hasFigma ? "" : " (no .figma-cache/variables.json — figma side is empty)";
  console.log(
    `[sync] ${s.unchanged} unchanged, ${s.oneSided.length} one-sided, ${s.conflicts.length} conflicts${parts ? ` — ${parts}` : ""}${figmaNote}${args.dryRun ? " (dry-run)" : ""}`,
  );
}

function writeConflictReport(diff: DiffEntry[]) {
  mkdirSync(dirname(CONFLICT), { recursive: true });
  const rows = diff
    .filter((e) => e.status === "conflict")
    .map(
      (e) =>
        `| \`${e.path}\` | \`${e.codeHash ?? "—"}\` | \`${e.figmaHash ?? "—"}\` | \`${e.lockHash ?? "—"}\` |`,
    );
  const body = [
    "# Sync conflict",
    "",
    "The following tokens changed on BOTH sides since the last sync. Resolve by editing",
    "`tokens.json` to the desired final value, then re-run `npm run ds:sync`.",
    "",
    "| Path | Code hash | Figma hash | Lock hash |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(CONFLICT, body);
}

/**
 * Overwrite tokens.json leaves with figma values for any path where Figma is
 * the winner (added-figma / changed-figma / removed-code). We only edit leaves —
 * group structure and aliases are preserved.
 */
function applyFigmaToCode(tree: DtcgGroup, figmaFlat: Array<{ path: string; type: string; rawValue: unknown }>) {
  const figmaByPath = new Map(figmaFlat.map((t) => [t.path, t]));
  // Walk tree, update leaves present in figmaByPath.
  function walk(node: DtcgGroup, path: string[]) {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      const p = [...path, key].join(".");
      if (child && typeof child === "object" && "$value" in (child as Record<string, unknown>)) {
        const f = figmaByPath.get(p);
        if (f) (child as { $value: unknown }).$value = f.rawValue;
      } else if (child && typeof child === "object") {
        walk(child as DtcgGroup, [...path, key]);
      }
    }
  }
  walk(tree, []);
  writeFileSync(TOKENS, JSON.stringify(tree, null, 2) + "\n");
  console.log(`[sync] updated ${TOKENS} from Figma`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

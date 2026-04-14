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
import { selectSyncWork } from "./sync-direction.ts";
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

  const work = selectSyncWork(args.direction, diff);
  const wantCodeToFigma = work.codeToFigma.length > 0;
  const wantFigmaToCode = work.figmaToCode.length > 0;

  if (wantFigmaToCode && !args.dryRun) {
    applyFigmaToCode(tree, figmaFlat, work.figmaToCode);
    await regenerateCode();
  }

  if (wantCodeToFigma) {
    const plan: WritePlan = buildPlan(work.codeToFigma, codeFlat, cache?.fileKey);
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
 * Apply Figma-side wins to the tokens.json tree: update existing leaves,
 * insert new tokens (added-figma / removed-code), and delete tokens removed
 * in Figma (removed-figma).
 */
function applyFigmaToCode(
  tree: DtcgGroup,
  figmaFlat: Array<{ path: string; type: string; rawValue: unknown }>,
  diff: DiffEntry[],
) {
  const figmaByPath = new Map(figmaFlat.map((t) => [t.path, t]));
  const statusByPath = new Map(diff.map((d) => [d.path, d.status]));

  // 1. Walk existing tree — update leaves that Figma changed.
  function walkUpdate(node: DtcgGroup, path: string[]) {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      const p = [...path, key].join(".");
      if (child && typeof child === "object" && "$value" in (child as Record<string, unknown>)) {
        const st = statusByPath.get(p);
        if (st === "changed-figma") {
          const f = figmaByPath.get(p);
          if (f) (child as { $value: unknown }).$value = f.rawValue;
        }
      } else if (child && typeof child === "object") {
        walkUpdate(child as DtcgGroup, [...path, key]);
      }
    }
  }
  walkUpdate(tree, []);

  // 2. Insert tokens that only exist in Figma (added-figma, removed-code).
  for (const [path, f] of figmaByPath) {
    const st = statusByPath.get(path);
    if (st !== "added-figma" && st !== "removed-code") continue;
    const parts = path.split(".");
    let cur: DtcgGroup = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur) || typeof cur[parts[i]] !== "object") {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]] as DtcgGroup;
    }
    const leaf = parts[parts.length - 1];
    cur[leaf] = { $type: f.type, $value: f.rawValue } as unknown as DtcgGroup;
  }

  // 3. Remove tokens deleted in Figma (removed-figma).
  for (const d of diff) {
    if (d.status !== "removed-figma") continue;
    const parts = d.path.split(".");
    let cur: DtcgGroup = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur) || typeof cur[parts[i]] !== "object") break;
      cur = cur[parts[i]] as DtcgGroup;
    }
    delete cur[parts[parts.length - 1]];
  }

  writeFileSync(TOKENS, JSON.stringify(tree, null, 2) + "\n");
  console.log(`[sync] updated ${TOKENS} from Figma`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

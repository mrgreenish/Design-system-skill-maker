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
 *     before invoking this script (the code-to-figma-design-system skill
 *     handles this).
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
 *
 * Lock file versions:
 *   v1 — hashes rawValue (alias references hash differently from their
 *        resolved concrete values → perpetual "changed-figma" drift).
 *   v2 — hashes resolved value (current). Alias tokens and their
 *        primitives hash to the same value when they agree.
 *   If a v1 lock is detected, it is treated as missing so the first
 *   --commit-lock run rebuilds a clean v2 baseline.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { flatten, hashAll, type DtcgGroup } from "./tokens.ts";
import { diffTokens, summarize, type DiffEntry } from "./diff-tokens.ts";
import { figmaToFlat, loadCache } from "./figma-read.ts";
import { buildPlan, type WritePlan } from "./figma-write.ts";
import { selectSyncWork } from "./sync-direction.ts";
import { loadFigmaMap, isManualProtected, type FigmaMap } from "./figma-map.ts";
import { run as regenerateCode } from "./tokens-build.ts";

const ROOT = resolve(import.meta.dirname, "..");
const TOKENS = resolve(ROOT, "tokens.json");
const LOCK = resolve(ROOT, "tokens.lock.json");
const PLAN = resolve(ROOT, ".sync-plan.json");
const CONFLICT = resolve(ROOT, "sync-conflict.md");

/** Current lock hash algorithm version. */
const LOCK_VERSION = 2;

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

/** Keep only the hash entries whose paths match an --only prefix. */
function filterHashes(hashes: Record<string, string>, only?: string[]): Record<string, string> {
  if (!only || only.length === 0) return hashes;
  const out: Record<string, string> = {};
  for (const [path, hash] of Object.entries(hashes)) {
    if (only.some((p) => path === p || path.startsWith(`${p}.`))) out[path] = hash;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const figmaMap = loadFigmaMap();

  if (!existsSync(TOKENS)) {
    console.error(`[sync] tokens.json not found at ${TOKENS}`);
    process.exit(1);
  }
  const tree = JSON.parse(readFileSync(TOKENS, "utf8")) as DtcgGroup;
  const codeFlat = filterByPrefix(flatten(tree), args.only);
  const codeHashes = hashAll(codeFlat);

  const cache = loadCache();
  const figmaFlat = cache ? filterByPrefix(figmaToFlat(cache, figmaMap), args.only) : [];
  const figmaHashes: Record<string, string> = { ...hashAll(figmaFlat) };

  // Inject code-side hashes for manual-protected tokens (shadow, cubicBezier,
  // or map-marked) so they never show up as "removed-figma". We use the lock
  // hash when available so that value changes in code produce "changed-code"
  // (→ manual write-plan entry) rather than spurious conflicts.
  const rawLock = readLock();
  const lock: Record<string, string> = rawLock ?? {};

  for (const t of codeFlat) {
    if (isManualProtected(figmaMap, t.path, t.type)) {
      figmaHashes[t.path] = lock[t.path] ?? codeHashes[t.path];
    }
  }

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
    applyFigmaToCode(tree, figmaFlat, work.figmaToCode, figmaMap);
    await regenerateCode();
  }

  if (wantCodeToFigma) {
    const plan: WritePlan = buildPlan(work.codeToFigma, codeFlat, cache?.fileKey, figmaMap);
    if (!args.dryRun) {
      writeFileSync(PLAN, JSON.stringify(plan, null, 2));
      console.log(`[sync] wrote ${PLAN} (${plan.operations.length} op(s), ${plan.manual.length} manual)`);
    } else {
      console.log(`[sync] (dry-run) would plan ${plan.operations.length} op(s), ${plan.manual.length} manual`);
    }
  }

  if (args.commitLock && !args.dryRun) {
    writeLock(args, figmaMap);
  }

  process.exit(0);
}

/** Read tokens.lock.json, returning the hashes or null on version mismatch / missing. */
function readLock(): Record<string, string> | null {
  if (!existsSync(LOCK)) return null;
  try {
    const raw = JSON.parse(readFileSync(LOCK, "utf8")) as {
      version?: number;
      hashes?: Record<string, string>;
    };
    if ((raw.version ?? 1) < LOCK_VERSION) {
      console.warn(
        `[sync] tokens.lock.json is v${raw.version ?? 1} (current: v${LOCK_VERSION}). ` +
        `Hash semantics changed — treating as missing. Run \`tsx scripts/sync.ts --commit-lock\` once to rebuild.`,
      );
      return null;
    }
    return raw.hashes ?? {};
  } catch {
    return null;
  }
}

/**
 * Commit tokens.lock.json after a successful sync.
 *
 * We always re-read tokens.json from disk so the lock reflects the
 * post-apply state (figma-to-code may have modified the file).
 *
 * When --only is active we perform a partial update: only the filtered
 * paths are changed; all other paths in the existing lock are preserved.
 * This prevents a partial sync from silently deleting entries for token
 * groups that weren't in scope.
 */
function writeLock(args: Args, figmaMap: FigmaMap | null) {
  // Re-read so we get the post-apply state for any figma-to-code changes.
  const freshTree = JSON.parse(readFileSync(TOKENS, "utf8")) as DtcgGroup;
  const freshCodeHashes = hashAll(flatten(freshTree));

  let lockHashes: Record<string, string>;
  if (args.only) {
    // Partial sync: read existing lock and only update the filtered paths.
    const existingHashes: Record<string, string> = (() => {
      if (!existsSync(LOCK)) return {};
      try {
        const raw = JSON.parse(readFileSync(LOCK, "utf8")) as { hashes?: Record<string, string> };
        return raw.hashes ?? {};
      } catch { return {}; }
    })();
    const filteredFresh = filterHashes(freshCodeHashes, args.only);
    lockHashes = { ...existingHashes, ...filteredFresh };
  } else {
    lockHashes = freshCodeHashes;
  }

  // Always include manual-protected tokens using their code hashes.
  const allFlat = flatten(freshTree);
  for (const t of allFlat) {
    if (isManualProtected(figmaMap, t.path, t.type)) {
      lockHashes[t.path] = freshCodeHashes[t.path];
    }
  }

  writeFileSync(
    LOCK,
    JSON.stringify(
      {
        $description: "Per-token hash from the last successful sync. Do not hand-edit.",
        version: LOCK_VERSION,
        syncedAt: new Date().toISOString(),
        hashes: lockHashes,
      },
      null,
      2,
    ),
  );
  console.log(`[sync] committed ${LOCK}`);
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
 *
 * Safety rules:
 *   1. Manual-protected tokens (shadow, cubicBezier, map-marked) are never
 *      deleted even if the diff says "removed-figma".
 *   2. Alias tokens (rawValue starts with "{") are never overwritten with a
 *      concrete value. If Figma diverges from the alias's resolved value the
 *      user is warned to update the alias target (the primitive) instead.
 *   3. Both $type and $value are updated when a token changes — not just $value.
 *
 * Exported for unit testing.
 */
export function applyFigmaToCode(
  tree: DtcgGroup,
  figmaFlat: Array<{ path: string; type: string; rawValue: unknown }>,
  diff: DiffEntry[],
  map: FigmaMap | null,
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
          if (!f) continue;

          const existingNode = child as { $value: unknown; $type?: string };

          // Don't de-alias: if the existing value is an alias reference, the
          // user must update the alias target (primitive) instead of the alias.
          if (typeof existingNode.$value === "string" && existingNode.$value.startsWith("{")) {
            console.warn(
              `[sync] skipped alias token "${p}" — ` +
              `Figma diverges from the resolved alias. ` +
              `Update the alias target (${existingNode.$value}) in tokens.json instead.`,
            );
            continue;
          }

          // Update both $value and $type so the token stays well-formed.
          existingNode.$value = f.rawValue;
          if (f.type) existingNode.$type = f.type;
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

  // 3. Remove tokens deleted in Figma (removed-figma) — but never manual-protected ones.
  for (const d of diff) {
    if (d.status !== "removed-figma") continue;

    const existingType = getExistingTokenType(tree, d.path);
    if (existingType && isManualProtected(map, d.path, existingType)) {
      console.warn(
        `[sync] skipped deletion of manual-protected token "${d.path}" (type: ${existingType}). ` +
        `Update it manually in Figma (Effects / Easing UI) if needed.`,
      );
      continue;
    }

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

/** Look up the $type of a token at a dotted path in the DTCG tree. */
function getExistingTokenType(tree: DtcgGroup, path: string): string | null {
  const parts = path.split(".");
  let cur: unknown = tree;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  if (cur && typeof cur === "object" && "$type" in (cur as Record<string, unknown>)) {
    return (cur as Record<string, unknown>).$type as string;
  }
  return null;
}

// Only run when invoked directly (tsx scripts/sync.ts …), not when imported
// by unit tests or other modules.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

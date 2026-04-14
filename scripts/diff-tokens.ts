/**
 * Three-way token diff.
 *
 * Given hash maps for code, figma, and the lock (last-synced snapshot),
 * classify every token path into one of:
 *
 *   unchanged       — all three hashes match
 *   added-code      — in code, not in lock or figma
 *   added-figma     — in figma, not in lock or code
 *   added-both      — in both sides (identical), not in lock
 *   removed-code    — in lock + figma, not in code
 *   removed-figma   — in lock + code, not in figma
 *   removed-both    — in lock only
 *   changed-code    — code differs from lock; figma == lock
 *   changed-figma   — figma differs from lock; code == lock
 *   conflict        — code and figma both differ from lock AND from each other
 *
 * This file has no Figma or Tailwind deps so it can be unit-tested in isolation.
 */

export type DiffStatus =
  | "unchanged"
  | "added-code"
  | "added-figma"
  | "added-both"
  | "removed-code"
  | "removed-figma"
  | "removed-both"
  | "changed-code"
  | "changed-figma"
  | "conflict";

export interface DiffEntry {
  path: string;
  status: DiffStatus;
  codeHash?: string;
  figmaHash?: string;
  lockHash?: string;
}

export type HashMap = Record<string, string>;

export function diffTokens(
  code: HashMap,
  figma: HashMap,
  lock: HashMap,
): DiffEntry[] {
  const paths = new Set<string>([
    ...Object.keys(code),
    ...Object.keys(figma),
    ...Object.keys(lock),
  ]);
  const result: DiffEntry[] = [];
  for (const path of paths) {
    const c = code[path];
    const f = figma[path];
    const l = lock[path];
    result.push({ path, status: classify(c, f, l), codeHash: c, figmaHash: f, lockHash: l });
  }
  // stable ordering for readable reports
  result.sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

function classify(c?: string, f?: string, l?: string): DiffStatus {
  const inCode = c !== undefined;
  const inFigma = f !== undefined;
  const inLock = l !== undefined;

  if (!inCode && !inFigma && inLock) return "removed-both";
  if (!inCode && inFigma && !inLock) return "added-figma";
  if (inCode && !inFigma && !inLock) return "added-code";
  if (inCode && inFigma && !inLock) return c === f ? "added-both" : "conflict";
  if (!inCode && inFigma && inLock) return "removed-code";
  if (inCode && !inFigma && inLock) return "removed-figma";

  // all three present
  if (c === f && f === l) return "unchanged";
  if (c === l && f !== l) return "changed-figma";
  if (f === l && c !== l) return "changed-code";
  return "conflict";
}

export interface ConflictSummary {
  conflicts: DiffEntry[];
  oneSided: DiffEntry[];
  unchanged: number;
}

export function summarize(entries: DiffEntry[]): ConflictSummary {
  const conflicts: DiffEntry[] = [];
  const oneSided: DiffEntry[] = [];
  let unchanged = 0;
  for (const e of entries) {
    if (e.status === "unchanged") unchanged++;
    else if (e.status === "conflict") conflicts.push(e);
    else oneSided.push(e);
  }
  return { conflicts, oneSided, unchanged };
}

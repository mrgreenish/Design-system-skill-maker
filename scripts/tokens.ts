/**
 * Shared DTCG types and helpers.
 *
 * We keep this intentionally minimal — only the shape we actually
 * use downstream (flatten, diff, tailwind emit).
 */

import { createHash } from "node:crypto";

export type DtcgType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "number"
  | "duration"
  | "cubicBezier"
  | "shadow";

export interface DtcgToken {
  $type: DtcgType;
  $value: unknown;
  $description?: string;
}

export interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken | string | undefined;
  $description?: string;
}

/** A flat token keyed by its dotted DTCG path (e.g. "color.brand.primary.500"). */
export interface FlatToken {
  path: string;
  type: DtcgType;
  value: unknown;
  /** Raw (unresolved) value before alias resolution, useful when re-serializing. */
  rawValue: unknown;
  description?: string;
}

/** Test for token leaves: any object carrying a `$value`. */
export function isToken(node: unknown): node is DtcgToken {
  return (
    typeof node === "object" &&
    node !== null &&
    "$value" in (node as Record<string, unknown>)
  );
}

/**
 * Walk a DTCG tree and yield every token as a FlatToken. Aliases
 * ({ref.path}) are resolved against the same tree; unresolved aliases
 * throw so callers see the problem immediately.
 */
export function flatten(root: DtcgGroup): FlatToken[] {
  const out: FlatToken[] = [];
  walk(root, [], out, root);
  return out;
}

function walk(
  node: DtcgGroup | DtcgToken | string | undefined,
  path: string[],
  out: FlatToken[],
  root: DtcgGroup,
): void {
  if (node == null || typeof node === "string") return;
  if (isToken(node)) {
    out.push({
      path: path.join("."),
      type: node.$type,
      value: resolveAliases(node.$value, root),
      rawValue: node.$value,
      description: node.$description,
    });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    walk(child as DtcgGroup | DtcgToken, [...path, key], out, root);
  }
}

const ALIAS_RE = /^\{([^}]+)\}$/;

function resolveAliases(value: unknown, root: DtcgGroup, depth = 0): unknown {
  if (depth > 16) throw new Error("DTCG alias cycle or depth > 16");
  if (typeof value === "string") {
    const m = value.match(ALIAS_RE);
    if (!m) return value;
    const target = lookup(root, m[1]);
    if (!target) throw new Error(`Unresolved alias: {${m[1]}}`);
    return resolveAliases(target.$value, root, depth + 1);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveAliases(v, root, depth + 1));
  }
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      copy[k] = resolveAliases(v, root, depth + 1);
    }
    return copy;
  }
  return value;
}

function lookup(root: DtcgGroup, dotted: string): DtcgToken | null {
  const parts = dotted.split(".");
  let cur: unknown = root;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return isToken(cur) ? cur : null;
}

/**
 * Deterministic hash of a flat token's resolved value + type, for lock-file
 * comparisons.
 *
 * We hash the RESOLVED value (not rawValue) so that alias tokens like
 * `color.semantic.bg.default = {color.neutral.0}` produce the same hash as
 * the concrete value Figma stores. Without this, every sync run sees aliased
 * tokens as "changed-figma" even when nothing actually changed.
 *
 * NOTE: tokens.lock.json written with this algorithm uses version: 2.
 * Older v1 lock files (which hashed rawValue) are treated as missing by
 * sync.ts — run `tsx scripts/sync.ts --commit-lock` once to rebuild.
 */
export function hashToken(t: Pick<FlatToken, "type" | "value">): string {
  const canonical = JSON.stringify({ type: t.type, value: t.value });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Build the { path: hash } map stored in tokens.lock.json. */
export function hashAll(tokens: FlatToken[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tokens) out[t.path] = hashToken(t);
  return out;
}

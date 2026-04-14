/**
 * figma-map.json loader and helpers.
 *
 * figma-map.json is produced by the setup-design-system skill. It provides
 * metadata that makes sync type-safe and round-trippable:
 *
 *   - Figma file key, collection IDs, mode IDs for targeted MCP reads/writes.
 *   - Per-token DTCG type overrides and unit hints so round-trips don't
 *     silently mutate "16px" → 16 → bare-number.
 *   - Explicit "manual-protected" capability for token types that Figma
 *     variables can't represent (shadow, cubicBezier). These are never
 *     auto-deleted by sync.
 *
 * All exported functions degrade gracefully when the file does not exist.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DtcgType } from "./tokens.ts";

export type SyncCapability = "variable" | "manual-protected";

export interface TokenMapping {
  /**
   * Figma variable name override.
   * Defaults to the DTCG dotted path converted to slash separators.
   */
  figmaName?: string;
  /** Figma collection name this variable belongs to. */
  collectionName?: string;
  /**
   * DTCG type override — the primary fix for lossy FLOAT round-trips.
   * Without it, every Figma FLOAT reads back as "dimension" regardless of
   * whether the original token was "fontWeight", "number", or "duration".
   */
  type?: DtcgType;
  /**
   * Unit to append when reconstructing a DTCG value from a unitless Figma
   * FLOAT. Example: unit="px" → Figma value 16 → DTCG "$value": "16px".
   */
  unit?: string;
  /**
   * How this token is synced:
   *   "variable"         — synced automatically via a native Figma variable.
   *   "manual-protected" — never auto-deleted; surfaced as a manual action.
   *                        Use for shadow, cubicBezier, effects, custom easings.
   */
  syncCapability?: SyncCapability;
}

export interface FigmaMapCollection {
  name: string;
  id?: string;
  modes?: Array<{ name: string; id?: string }>;
}

export interface FigmaMap {
  /** The Figma file key (alphanumeric segment from the Figma URL). */
  fileKey?: string;
  /** Default collection for tokens that don't specify one. */
  defaultCollectionName?: string;
  /** Known variable collections and their mode identifiers. */
  collections?: FigmaMapCollection[];
  /** Per-DTCG-path token metadata. Keys are dotted DTCG paths. */
  tokens?: Record<string, TokenMapping>;
}

const ROOT = resolve(import.meta.dirname, "..");
const MAP_PATH = resolve(ROOT, "figma-map.json");

/**
 * DTCG types that have no native Figma variable representation.
 * Used as the built-in fallback when figma-map.json is absent or does not
 * list a token — these are always manual-protected.
 */
export const ALWAYS_PROTECTED_TYPES: ReadonlySet<DtcgType> = new Set<DtcgType>([
  "shadow",
  "cubicBezier",
]);

export function loadFigmaMap(path = MAP_PATH): FigmaMap | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FigmaMap;
  } catch {
    return null;
  }
}

/** Return the per-token mapping for a DTCG path (empty object if absent). */
export function getTokenMapping(map: FigmaMap | null, path: string): TokenMapping {
  return map?.tokens?.[path] ?? {};
}

/**
 * Return true if this token should be skipped by auto-sync and never
 * auto-deleted from tokens.json.
 *
 * A token is manual-protected when:
 *   a) Its DTCG type is in ALWAYS_PROTECTED_TYPES (shadow, cubicBezier), OR
 *   b) figma-map.json explicitly marks it syncCapability="manual-protected".
 */
export function isManualProtected(
  map: FigmaMap | null,
  path: string,
  dtcgType: string,
): boolean {
  if (ALWAYS_PROTECTED_TYPES.has(dtcgType as DtcgType)) return true;
  return getTokenMapping(map, path).syncCapability === "manual-protected";
}

/**
 * Reconstruct the DTCG value from a Figma FLOAT + mapping metadata.
 * When the mapping specifies a unit, it is appended to the numeric value.
 * Non-numeric values pass through unchanged.
 *
 * Examples:
 *   reconstructValue(16, { unit: "px" })  → "16px"
 *   reconstructValue(120, { unit: "ms" }) → "120ms"
 *   reconstructValue(400, {})             → 400
 *   reconstructValue("#fff", {})          → "#fff"
 */
export function reconstructValue(
  figmaValue: string | number | boolean,
  mapping: TokenMapping,
): string | number | boolean {
  if (typeof figmaValue !== "number") return figmaValue;
  if (mapping.unit) return `${figmaValue}${mapping.unit}`;
  return figmaValue;
}

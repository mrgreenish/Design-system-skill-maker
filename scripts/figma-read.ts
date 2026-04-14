/**
 * Figma → DTCG reader.
 *
 * Node can't call MCP tools directly — Claude does, via the Figma Dev Mode
 * MCP server. The contract is:
 *
 *   1. Claude runs the MCP reads (e.g. `get_variable_defs`) and writes the
 *      raw payload to `.figma-cache/variables.json`.
 *   2. This module converts the cache to FlatToken[] shape so it can be
 *      hashed and diffed by the same machinery as the code-side tokens.
 *
 * Cache schema is deliberately tolerant of the MCP server's format churn:
 * we accept both a flat `{ "color/brand/primary": "#4f46e5" }` map (the
 * shape Dev Mode MCP currently emits) and an explicit variables array.
 *
 * When figma-map.json is present, type overrides and unit hints in the map
 * replace the heuristic guesses (e.g. every FLOAT → dimension). Without a
 * map the heuristics remain active as a graceful fallback.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DtcgType, FlatToken } from "./tokens.ts";
import {
  type FigmaMap,
  getTokenMapping,
  reconstructValue,
} from "./figma-map.ts";

const ROOT = resolve(import.meta.dirname, "..");
const CACHE = resolve(ROOT, ".figma-cache/variables.json");

export interface FigmaCache {
  fileKey?: string;
  fetchedAt?: string;
  /** Either/both of these populated — we prefer `variables` if present. */
  flat?: Record<string, string | number>;
  variables?: Array<{
    name: string;
    type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    value: string | number | boolean;
    description?: string;
  }>;
}

/** Convert a Figma variable name ("color/brand/primary/500") to a DTCG path. */
export function nameToPath(name: string): string {
  return name.replace(/\//g, ".");
}

/**
 * Convert the Figma variable cache to a FlatToken array.
 *
 * When `map` is provided, per-token type overrides and unit hints are applied:
 *   - type override: corrects FLOAT → fontWeight / duration / number instead
 *     of blindly mapping everything to "dimension".
 *   - unit hint: reconstructs "16px" from the unitless Figma FLOAT 16.
 */
export function figmaToFlat(cache: FigmaCache, map?: FigmaMap | null): FlatToken[] {
  const out: FlatToken[] = [];
  if (cache.variables) {
    for (const v of cache.variables) {
      const path = nameToPath(v.name);
      const mapping = getTokenMapping(map ?? null, path);
      const type = mapping.type ?? mapType(v.type, v.value);
      if (!type) continue;
      const rawValue = reconstructValue(v.value, mapping);
      out.push({
        path,
        type,
        value: rawValue,
        rawValue,
        description: v.description,
      });
    }
  } else if (cache.flat) {
    for (const [name, value] of Object.entries(cache.flat)) {
      const path = nameToPath(name);
      const mapping = getTokenMapping(map ?? null, path);
      const type = mapping.type ?? inferType(value);
      const reconstructed = reconstructValue(value, mapping);
      out.push({
        path,
        type,
        value: reconstructed,
        rawValue: reconstructed,
      });
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function mapType(figmaType: string, value: unknown): DtcgType | null {
  switch (figmaType) {
    case "COLOR": return "color";
    case "FLOAT": return typeof value === "number" ? "dimension" : null;
    case "STRING": return "fontFamily"; // best guess; tune via figma-map.json per project
    case "BOOLEAN": return null;
    default: return null;
  }
}

function inferType(value: string | number): DtcgType {
  if (typeof value === "number") return "dimension";
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return "color";
  if (/^-?\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return "dimension";
  if (/^\d+ms$/.test(value)) return "duration";
  return "color"; // fallback — better to let it diff and show up than to drop
}

export function loadCache(path = CACHE): FigmaCache | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as FigmaCache;
}

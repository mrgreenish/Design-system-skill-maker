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
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DtcgType, FlatToken } from "./tokens.ts";

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

export function figmaToFlat(cache: FigmaCache): FlatToken[] {
  const out: FlatToken[] = [];
  if (cache.variables) {
    for (const v of cache.variables) {
      const type = mapType(v.type, v.value);
      if (!type) continue;
      out.push({
        path: nameToPath(v.name),
        type,
        value: v.value,
        rawValue: v.value,
        description: v.description,
      });
    }
  } else if (cache.flat) {
    for (const [name, value] of Object.entries(cache.flat)) {
      const type = inferType(value);
      out.push({
        path: nameToPath(name),
        type,
        value,
        rawValue: value,
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
  // Simple heuristic: hex color string
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return "color";
  if (/^-?\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return "dimension";
  if (/^\d+ms$/.test(value)) return "duration";
  return "color"; // fallback — better to let it diff and show up than to drop
}

export function loadCache(path = CACHE): FigmaCache | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as FigmaCache;
}

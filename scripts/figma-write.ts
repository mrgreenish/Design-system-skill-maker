/**
 * DTCG → Figma write-plan emitter.
 *
 * Produces a JSON plan that Claude executes by calling the Figma Dev Mode
 * MCP write tools. The plan is side-effect-free for Node; all real writes
 * happen through MCP.
 *
 * Plan schema (consumed by the code-to-figma-design-system skill):
 *
 *   {
 *     "fileKey": "...",
 *     "operations": [
 *       { "op": "upsert-variable", "name": "color/brand/primary/500",
 *         "type": "COLOR", "value": "#4f46e5" },
 *       { "op": "delete-variable", "name": "color/legacy/old" }
 *     ]
 *   }
 *
 * The skill iterates through operations and invokes the matching MCP tool
 * (create_variable / update_variable / delete_variable / set_variable_mode_value).
 * If the user's MCP server doesn't support a given op, the skill falls
 * back to rendering a human checklist for that operation.
 */

import type { DiffEntry } from "./diff-tokens.ts";
import type { FlatToken } from "./tokens.ts";
import { type FigmaMap, getTokenMapping } from "./figma-map.ts";

export interface WriteOp {
  op: "upsert-variable" | "delete-variable";
  name: string;
  type?: "COLOR" | "FLOAT" | "STRING";
  value?: string | number;
  description?: string;
}

export interface WritePlan {
  fileKey?: string;
  generatedAt: string;
  operations: WriteOp[];
  /** Ops we couldn't express through MCP writes; surface to the user for manual apply. */
  manual: Array<{ name: string; reason: string }>;
}

/**
 * Build the code→figma plan from a diff + the code-side flat tokens.
 *
 * When `map` is provided, the per-token `figmaName` override is used for the
 * Figma variable name instead of the default slash-path conversion.
 */
export function buildPlan(
  diff: DiffEntry[],
  codeTokens: FlatToken[],
  fileKey?: string,
  map?: FigmaMap | null,
): WritePlan {
  const codeByPath = new Map(codeTokens.map((t) => [t.path, t]));
  const ops: WriteOp[] = [];
  const manual: WritePlan["manual"] = [];

  for (const e of diff) {
    // We only push code-side wins here. figma-side wins are handled by figma-read
    // overwriting tokens.json in the other direction.
    if (e.status !== "changed-code" && e.status !== "added-code" && e.status !== "removed-figma") {
      continue;
    }

    const t = codeByPath.get(e.path);
    if (!t) continue;
    const mapped = toFigma(t);
    const varName = getTokenMapping(map ?? null, e.path).figmaName ?? pathToName(e.path);
    if (!mapped) {
      manual.push({ name: varName, reason: `No Figma variable mapping for DTCG type "${t.type}"` });
      continue;
    }
    ops.push({ op: "upsert-variable", name: varName, ...mapped, description: t.description });
  }

  // Removals: tokens present in figma/lock but not in code.
  for (const e of diff) {
    if (e.status === "removed-code") {
      const varName = getTokenMapping(map ?? null, e.path).figmaName ?? pathToName(e.path);
      ops.push({ op: "delete-variable", name: varName });
    }
  }

  return {
    fileKey,
    generatedAt: new Date().toISOString(),
    operations: ops,
    manual,
  };
}

function toFigma(t: FlatToken): { type: "COLOR" | "FLOAT" | "STRING"; value: string | number } | null {
  switch (t.type) {
    case "color":
      return { type: "COLOR", value: String(t.value) };
    case "dimension": {
      const n = parseDimension(t.value);
      return n == null ? null : { type: "FLOAT", value: n };
    }
    case "number":
      return { type: "FLOAT", value: Number(t.value) };
    case "fontFamily":
      return { type: "STRING", value: Array.isArray(t.value) ? (t.value as string[]).join(", ") : String(t.value) };
    case "fontWeight":
      return { type: "FLOAT", value: Number(t.value) };
    case "duration": {
      const n = parseDimension(t.value);
      return n == null ? null : { type: "FLOAT", value: n };
    }
    // shadow and cubicBezier don't map to native Figma variables — skill handles manually.
    case "shadow":
    case "cubicBezier":
      return null;
    default:
      return null;
  }
}

/** Parse "16px" -> 16, "120ms" -> 120. Returns null if no unit match. */
function parseDimension(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|ms|s)?$/);
  if (!m) return null;
  return Number(m[1]);
}

/** Convert DTCG path ("color.brand.primary.500") back to Figma variable name ("color/brand/primary/500"). */
export function pathToName(path: string): string {
  return path.replace(/\./g, "/");
}

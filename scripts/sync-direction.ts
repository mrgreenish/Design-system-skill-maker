import type { DiffEntry, DiffStatus } from "./diff-tokens.ts";

export type SyncDirection = "auto" | "code-to-figma" | "figma-to-code";

const AUTO_CODE_TO_FIGMA = new Set<DiffStatus>(["changed-code", "added-code", "removed-code"]);
const AUTO_FIGMA_TO_CODE = new Set<DiffStatus>(["changed-figma", "added-figma", "removed-figma"]);
const EXPLICIT_CODE_TO_FIGMA = new Set<DiffStatus>(["changed-code", "added-code", "removed-code", "removed-figma"]);
const EXPLICIT_FIGMA_TO_CODE = new Set<DiffStatus>(["changed-figma", "added-figma", "removed-code", "removed-figma"]);

export function selectSyncWork(direction: SyncDirection, diff: DiffEntry[]) {
  if (direction === "code-to-figma") {
    return {
      codeToFigma: pick(diff, EXPLICIT_CODE_TO_FIGMA),
      figmaToCode: [] as DiffEntry[],
    };
  }

  if (direction === "figma-to-code") {
    return {
      codeToFigma: [] as DiffEntry[],
      figmaToCode: pick(diff, EXPLICIT_FIGMA_TO_CODE),
    };
  }

  return {
    codeToFigma: pick(diff, AUTO_CODE_TO_FIGMA),
    figmaToCode: pick(diff, AUTO_FIGMA_TO_CODE),
  };
}

function pick(diff: DiffEntry[], statuses: Set<DiffStatus>) {
  return diff.filter((entry) => statuses.has(entry.status));
}

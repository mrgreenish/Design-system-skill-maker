import { describe, expect, it } from "vitest";
import type { DiffEntry, DiffStatus } from "../diff-tokens.ts";
import { selectSyncWork } from "../sync-direction.ts";

function entries(byPath: Record<string, DiffStatus>): DiffEntry[] {
  return Object.entries(byPath).map(([path, status]) => ({ path, status }));
}

describe("selectSyncWork", () => {
  it("keeps removed-figma on the figma-to-code side in auto mode", () => {
    const work = selectSyncWork("auto", entries({
      "color.brand.primary.500": "removed-figma",
      "color.brand.primary.600": "changed-code",
    }));

    expect(work.codeToFigma.map((entry) => entry.path)).toEqual(["color.brand.primary.600"]);
    expect(work.figmaToCode.map((entry) => entry.path)).toEqual(["color.brand.primary.500"]);
  });

  it("keeps removed-code on the code-to-figma side in auto mode", () => {
    const work = selectSyncWork("auto", entries({
      "color.brand.primary.500": "removed-code",
      "color.brand.primary.600": "changed-figma",
    }));

    expect(work.codeToFigma.map((entry) => entry.path)).toEqual(["color.brand.primary.500"]);
    expect(work.figmaToCode.map((entry) => entry.path)).toEqual(["color.brand.primary.600"]);
  });
});

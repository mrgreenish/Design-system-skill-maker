/**
 * Tests for the applyFigmaToCode logic exported from sync.ts.
 *
 * We mock node:fs so the function's writeFileSync call doesn't touch disk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DtcgGroup } from "../tokens.ts";
import type { DiffEntry } from "../diff-tokens.ts";
import type { FigmaMap } from "../figma-map.ts";

// Mock writeFileSync before importing the module under test.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeFileSync: vi.fn(), existsSync: vi.fn(() => false) };
});

const { applyFigmaToCode } = await import("../sync.ts");

// ─── fixtures ───────────────────────────────────────────────────────────────

function makeTree(): DtcgGroup {
  return {
    color: {
      neutral: {
        "0": { $type: "color", $value: "#ffffff" },
        "900": { $type: "color", $value: "#0f172a" },
      },
      semantic: {
        bg: {
          default: { $type: "color", $value: "{color.neutral.0}" },
        },
      },
    },
    space: {
      "4": { $type: "dimension", $value: "16px" },
    },
    font: {
      weight: {
        regular: { $type: "fontWeight", $value: 400 },
      },
    },
    shadow: {
      sm: {
        $type: "shadow",
        $value: { color: "#0f172a1a", offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px" },
      },
    },
    motion: {
      easing: {
        standard: { $type: "cubicBezier", $value: [0.2, 0, 0, 1] },
      },
    },
  };
}

type FigmaEntry = { path: string; type: string; rawValue: unknown };

function entry(status: DiffEntry["status"], path: string): DiffEntry {
  return { path, status };
}

// ─── alias skip ─────────────────────────────────────────────────────────────

describe("applyFigmaToCode — alias token handling", () => {
  it("does NOT overwrite an alias token with a concrete Figma value", () => {
    const tree = makeTree();
    const figmaFlat: FigmaEntry[] = [
      { path: "color.semantic.bg.default", type: "color", rawValue: "#ff0000" },
    ];
    const diff: DiffEntry[] = [entry("changed-figma", "color.semantic.bg.default")];

    applyFigmaToCode(tree, figmaFlat, diff, null);

    // The alias reference must be preserved, not replaced with the concrete value.
    const node = (tree.color as DtcgGroup).semantic as DtcgGroup;
    const bg = (node.bg as DtcgGroup).default as { $value: unknown };
    expect(bg.$value).toBe("{color.neutral.0}");
  });

  it("DOES update a concrete (non-alias) token marked as changed-figma", () => {
    const tree = makeTree();
    const figmaFlat: FigmaEntry[] = [
      { path: "color.neutral.0", type: "color", rawValue: "#f0f0f0" },
    ];
    const diff: DiffEntry[] = [entry("changed-figma", "color.neutral.0")];

    applyFigmaToCode(tree, figmaFlat, diff, null);

    const neutral = (tree.color as DtcgGroup).neutral as DtcgGroup;
    const token = neutral["0"] as { $value: unknown; $type: string };
    expect(token.$value).toBe("#f0f0f0");
  });
});

// ─── $type update ────────────────────────────────────────────────────────────

describe("applyFigmaToCode — $type update", () => {
  it("updates both $value and $type when the token changes", () => {
    const tree = makeTree();
    const figmaFlat: FigmaEntry[] = [
      { path: "space.4", type: "dimension", rawValue: "20px" },
    ];
    const diff: DiffEntry[] = [entry("changed-figma", "space.4")];

    applyFigmaToCode(tree, figmaFlat, diff, null);

    const token = (tree.space as DtcgGroup)["4"] as { $value: unknown; $type: string };
    expect(token.$value).toBe("20px");
    expect(token.$type).toBe("dimension");
  });
});

// ─── manual-protected: no deletion ──────────────────────────────────────────

describe("applyFigmaToCode — manual-protected tokens", () => {
  it("does NOT delete a shadow token marked removed-figma", () => {
    const tree = makeTree();
    const diff: DiffEntry[] = [entry("removed-figma", "shadow.sm")];

    applyFigmaToCode(tree, [], diff, null);

    // shadow.sm must still exist in the tree.
    expect((tree.shadow as DtcgGroup).sm).toBeDefined();
  });

  it("does NOT delete a cubicBezier token marked removed-figma", () => {
    const tree = makeTree();
    const diff: DiffEntry[] = [entry("removed-figma", "motion.easing.standard")];

    applyFigmaToCode(tree, [], diff, null);

    const easing = (tree.motion as DtcgGroup).easing as DtcgGroup;
    expect(easing.standard).toBeDefined();
  });

  it("does NOT delete a token marked manual-protected in figma-map", () => {
    const tree = makeTree();
    const map: FigmaMap = {
      tokens: { "color.neutral.0": { syncCapability: "manual-protected" } },
    };
    const diff: DiffEntry[] = [entry("removed-figma", "color.neutral.0")];

    applyFigmaToCode(tree, [], diff, map);

    const neutral = (tree.color as DtcgGroup).neutral as DtcgGroup;
    expect(neutral["0"]).toBeDefined();
  });

  it("DOES delete a plain token marked removed-figma (not protected)", () => {
    const tree = makeTree();
    // space.4 is a normal dimension token — should be deleted
    const diff: DiffEntry[] = [entry("removed-figma", "space.4")];

    applyFigmaToCode(tree, [], diff, null);

    expect((tree.space as DtcgGroup)["4"]).toBeUndefined();
  });
});

// ─── insert new figma tokens ─────────────────────────────────────────────────

describe("applyFigmaToCode — inserting new figma tokens", () => {
  it("inserts an added-figma token into the tree", () => {
    const tree = makeTree();
    const figmaFlat: FigmaEntry[] = [
      { path: "color.brand.new.100", type: "color", rawValue: "#e0e7ff" },
    ];
    const diff: DiffEntry[] = [entry("added-figma", "color.brand.new.100")];

    applyFigmaToCode(tree, figmaFlat, diff, null);

    const brand = ((tree.color as DtcgGroup).brand as DtcgGroup);
    const newToken = ((brand.new as DtcgGroup)?.["100"]) as { $value: unknown; $type: string } | undefined;
    expect(newToken?.$value).toBe("#e0e7ff");
    expect(newToken?.$type).toBe("color");
  });
});

import { describe, it, expect } from "vitest";
import { figmaToFlat, nameToPath, type FigmaCache } from "../figma-read.ts";
import type { FigmaMap } from "../figma-map.ts";

const cache: FigmaCache = {
  variables: [
    { name: "space/4", type: "FLOAT", value: 16 },
    { name: "space/1", type: "FLOAT", value: 4 },
    { name: "font/weight/regular", type: "FLOAT", value: 400 },
    { name: "font/weight/bold", type: "FLOAT", value: 700 },
    { name: "motion/duration/fast", type: "FLOAT", value: 120 },
    { name: "color/brand/primary/500", type: "COLOR", value: "#4f46e5" },
    { name: "font/family/sans", type: "STRING", value: "Inter" },
  ],
};

const map: FigmaMap = {
  tokens: {
    "space.4": { type: "dimension", unit: "px" },
    "space.1": { type: "dimension", unit: "px" },
    "font.weight.regular": { type: "fontWeight" },
    "font.weight.bold": { type: "fontWeight" },
    "motion.duration.fast": { type: "duration", unit: "ms" },
  },
};

describe("nameToPath", () => {
  it("converts slash separators to dots", () => {
    expect(nameToPath("color/brand/primary/500")).toBe("color.brand.primary.500");
    expect(nameToPath("space/4")).toBe("space.4");
  });
});

describe("figmaToFlat without map (heuristic fallback)", () => {
  it("maps FLOAT to dimension by default", () => {
    const flat = figmaToFlat(cache);
    const space = flat.find((t) => t.path === "space.4");
    expect(space?.type).toBe("dimension");
    expect(space?.value).toBe(16); // no unit — heuristic can't add it
  });

  it("maps fontWeight FLOAT to dimension (the lossy case without map)", () => {
    const flat = figmaToFlat(cache);
    const weight = flat.find((t) => t.path === "font.weight.regular");
    expect(weight?.type).toBe("dimension"); // wrong without the map
    expect(weight?.value).toBe(400);
  });

  it("maps COLOR to color", () => {
    const flat = figmaToFlat(cache);
    const color = flat.find((t) => t.path === "color.brand.primary.500");
    expect(color?.type).toBe("color");
    expect(color?.value).toBe("#4f46e5");
  });

  it("maps STRING to fontFamily", () => {
    const flat = figmaToFlat(cache);
    const family = flat.find((t) => t.path === "font.family.sans");
    expect(family?.type).toBe("fontFamily");
  });

  it("returns tokens sorted by path", () => {
    const flat = figmaToFlat(cache);
    const paths = flat.map((t) => t.path);
    expect(paths).toEqual([...paths].sort());
  });
});

describe("figmaToFlat with map (metadata-driven)", () => {
  it("uses the map type override — fontWeight stays fontWeight", () => {
    const flat = figmaToFlat(cache, map);
    const weight = flat.find((t) => t.path === "font.weight.regular");
    expect(weight?.type).toBe("fontWeight");
    expect(weight?.value).toBe(400); // no unit for fontWeight — correct
  });

  it("reconstructs dimension values with unit from the map", () => {
    const flat = figmaToFlat(cache, map);
    const space = flat.find((t) => t.path === "space.4");
    expect(space?.type).toBe("dimension");
    expect(space?.value).toBe("16px");
    expect(space?.rawValue).toBe("16px");
  });

  it("reconstructs duration values with ms unit", () => {
    const flat = figmaToFlat(cache, map);
    const dur = flat.find((t) => t.path === "motion.duration.fast");
    expect(dur?.type).toBe("duration");
    expect(dur?.value).toBe("120ms");
  });

  it("preserves color values unchanged (no unit needed)", () => {
    const flat = figmaToFlat(cache, map);
    const color = flat.find((t) => t.path === "color.brand.primary.500");
    expect(color?.type).toBe("color");
    expect(color?.value).toBe("#4f46e5");
  });

  it("falls back to heuristics for tokens not in the map", () => {
    const flat = figmaToFlat(cache, map);
    const family = flat.find((t) => t.path === "font.family.sans");
    expect(family?.type).toBe("fontFamily"); // heuristic from STRING
  });
});

describe("figmaToFlat with flat cache (legacy format)", () => {
  const flatCache: FigmaCache = {
    flat: {
      "color/brand/primary": "#4f46e5",
      "space/4": 16,
    },
  };

  it("handles flat format without map", () => {
    const flat = figmaToFlat(flatCache);
    const color = flat.find((t) => t.path === "color.brand.primary");
    expect(color?.type).toBe("color");
    expect(color?.value).toBe("#4f46e5");
  });

  it("handles flat numeric with map unit", () => {
    const flatMap: FigmaMap = {
      tokens: { "space.4": { type: "dimension", unit: "px" } },
    };
    const flat = figmaToFlat(flatCache, flatMap);
    const space = flat.find((t) => t.path === "space.4");
    expect(space?.type).toBe("dimension");
    expect(space?.value).toBe("16px");
  });
});

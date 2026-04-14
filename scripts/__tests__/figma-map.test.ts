import { describe, it, expect } from "vitest";
import {
  getTokenMapping,
  isManualProtected,
  reconstructValue,
  ALWAYS_PROTECTED_TYPES,
  type FigmaMap,
} from "../figma-map.ts";

const sampleMap: FigmaMap = {
  fileKey: "abc123",
  tokens: {
    "space.4": { type: "dimension", unit: "px" },
    "font.weight.regular": { type: "fontWeight" },
    "motion.duration.fast": { type: "duration", unit: "ms" },
    "my.custom.protected": { syncCapability: "manual-protected" },
  },
};

describe("ALWAYS_PROTECTED_TYPES", () => {
  it("includes shadow and cubicBezier", () => {
    expect(ALWAYS_PROTECTED_TYPES.has("shadow")).toBe(true);
    expect(ALWAYS_PROTECTED_TYPES.has("cubicBezier")).toBe(true);
  });

  it("does not include variable-backed types", () => {
    expect(ALWAYS_PROTECTED_TYPES.has("color")).toBe(false);
    expect(ALWAYS_PROTECTED_TYPES.has("dimension")).toBe(false);
    expect(ALWAYS_PROTECTED_TYPES.has("fontWeight")).toBe(false);
  });
});

describe("getTokenMapping", () => {
  it("returns empty object when map is null", () => {
    expect(getTokenMapping(null, "any.path")).toEqual({});
  });

  it("returns empty object when path is not in the map", () => {
    expect(getTokenMapping(sampleMap, "unknown.path")).toEqual({});
  });

  it("returns the full mapping for a known path", () => {
    expect(getTokenMapping(sampleMap, "space.4")).toEqual({ type: "dimension", unit: "px" });
  });
});

describe("isManualProtected", () => {
  it("returns true for shadow tokens regardless of map", () => {
    expect(isManualProtected(null, "shadow.sm", "shadow")).toBe(true);
    expect(isManualProtected(sampleMap, "shadow.sm", "shadow")).toBe(true);
  });

  it("returns true for cubicBezier tokens regardless of map", () => {
    expect(isManualProtected(null, "motion.easing.standard", "cubicBezier")).toBe(true);
  });

  it("returns false for dimension tokens (variable-backed)", () => {
    expect(isManualProtected(sampleMap, "space.4", "dimension")).toBe(false);
    expect(isManualProtected(null, "space.4", "dimension")).toBe(false);
  });

  it("returns false for color tokens", () => {
    expect(isManualProtected(sampleMap, "color.brand.primary.500", "color")).toBe(false);
    expect(isManualProtected(null, "color.brand.primary.500", "color")).toBe(false);
  });

  it("returns true when map explicitly marks a token as manual-protected", () => {
    expect(isManualProtected(sampleMap, "my.custom.protected", "color")).toBe(true);
  });

  it("returns false for an explicit 'variable' capability", () => {
    const mapWithVariable: FigmaMap = {
      tokens: { "some.token": { syncCapability: "variable" } },
    };
    expect(isManualProtected(mapWithVariable, "some.token", "color")).toBe(false);
  });
});

describe("reconstructValue", () => {
  it("appends px unit to numeric dimension values", () => {
    expect(reconstructValue(16, { unit: "px" })).toBe("16px");
    expect(reconstructValue(8, { unit: "px" })).toBe("8px");
  });

  it("appends ms unit to numeric duration values", () => {
    expect(reconstructValue(120, { unit: "ms" })).toBe("120ms");
  });

  it("returns raw number when no unit is specified", () => {
    expect(reconstructValue(400, {})).toBe(400);
    expect(reconstructValue(1.5, {})).toBe(1.5);
  });

  it("passes non-numeric values through unchanged", () => {
    expect(reconstructValue("#fff", { unit: "px" })).toBe("#fff");
    expect(reconstructValue(true, { unit: "px" })).toBe(true);
    expect(reconstructValue("Inter", { unit: "px" })).toBe("Inter");
  });

  it("handles decimal numeric values with units", () => {
    expect(reconstructValue(1.5, { unit: "rem" })).toBe("1.5rem");
  });
});

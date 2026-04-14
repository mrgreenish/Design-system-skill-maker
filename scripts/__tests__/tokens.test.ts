import { describe, it, expect } from "vitest";
import { flatten, hashAll, hashToken, type DtcgGroup } from "../tokens.ts";

const sample: DtcgGroup = {
  color: {
    brand: {
      primary: { $type: "color", $value: "#4f46e5" },
    },
    semantic: {
      accent: { $type: "color", $value: "{color.brand.primary}" },
    },
  },
};

describe("flatten", () => {
  it("emits one FlatToken per leaf", () => {
    const flat = flatten(sample);
    expect(flat.map((t) => t.path).sort()).toEqual([
      "color.brand.primary",
      "color.semantic.accent",
    ]);
  });

  it("resolves aliases to concrete values", () => {
    const flat = flatten(sample);
    const accent = flat.find((t) => t.path === "color.semantic.accent");
    expect(accent?.value).toBe("#4f46e5");
    // but rawValue preserves the alias
    expect(accent?.rawValue).toBe("{color.brand.primary}");
  });

  it("throws on unresolved alias", () => {
    expect(() =>
      flatten({
        color: { a: { $type: "color", $value: "{color.missing}" } },
      }),
    ).toThrow(/Unresolved alias/);
  });
});

describe("hashToken", () => {
  it("is stable across identical inputs", () => {
    expect(
      hashToken({ type: "color", rawValue: "#fff" }),
    ).toEqual(hashToken({ type: "color", rawValue: "#fff" }));
  });

  it("differs when type or value differs", () => {
    const a = hashToken({ type: "color", rawValue: "#fff" });
    const b = hashToken({ type: "color", rawValue: "#000" });
    const c = hashToken({ type: "dimension", rawValue: "#fff" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("hashAll", () => {
  it("produces a stable map keyed by path", () => {
    const map = hashAll(flatten(sample));
    expect(Object.keys(map).sort()).toEqual([
      "color.brand.primary",
      "color.semantic.accent",
    ]);
  });
});

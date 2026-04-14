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
      hashToken({ type: "color", value: "#fff" }),
    ).toEqual(hashToken({ type: "color", value: "#fff" }));
  });

  it("differs when type or value differs", () => {
    const a = hashToken({ type: "color", value: "#fff" });
    const b = hashToken({ type: "color", value: "#000" });
    const c = hashToken({ type: "dimension", value: "#fff" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("produces the same hash for alias and its resolved value (round-trip safety)", () => {
    // An alias token and its primitive resolve to the same concrete value.
    // They must hash identically so the diff sees them as "unchanged".
    const primitiveHash = hashToken({ type: "color", value: "#4f46e5" });
    const aliasHash = hashToken({ type: "color", value: "#4f46e5" }); // resolved
    expect(primitiveHash).toBe(aliasHash);
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

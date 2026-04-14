import { describe, it, expect } from "vitest";
import { diffTokens, summarize } from "../diff-tokens.ts";

describe("diffTokens", () => {
  it("flags unchanged when all three hashes match", () => {
    const d = diffTokens({ a: "x" }, { a: "x" }, { a: "x" });
    expect(d[0].status).toBe("unchanged");
  });

  it("detects one-sided code change", () => {
    const d = diffTokens({ a: "y" }, { a: "x" }, { a: "x" });
    expect(d[0].status).toBe("changed-code");
  });

  it("detects one-sided figma change", () => {
    const d = diffTokens({ a: "x" }, { a: "y" }, { a: "x" });
    expect(d[0].status).toBe("changed-figma");
  });

  it("detects conflict when both sides diverge from lock differently", () => {
    const d = diffTokens({ a: "y" }, { a: "z" }, { a: "x" });
    expect(d[0].status).toBe("conflict");
  });

  it("treats identical both-side adds as added-both (no conflict)", () => {
    const d = diffTokens({ a: "x" }, { a: "x" }, {});
    expect(d[0].status).toBe("added-both");
  });

  it("treats divergent both-side adds as a conflict", () => {
    const d = diffTokens({ a: "x" }, { a: "y" }, {});
    expect(d[0].status).toBe("conflict");
  });

  it("detects added-code, added-figma, removed-code, removed-figma, removed-both", () => {
    const d = diffTokens(
      { addedC: "1", bothSides: "2" },
      { addedF: "3", bothSides: "2", keepF: "4" },
      { removedBoth: "9", keepF: "4" },
    );
    const byPath = Object.fromEntries(d.map((e) => [e.path, e.status]));
    expect(byPath.addedC).toBe("added-code");
    expect(byPath.addedF).toBe("added-figma");
    expect(byPath.bothSides).toBe("added-both");
    expect(byPath.removedBoth).toBe("removed-both");
    expect(byPath.keepF).toBe("removed-code");
  });

  it("summarize partitions entries correctly", () => {
    const d = diffTokens(
      { a: "1", b: "2", c: "3" },
      { a: "1", b: "9", c: "4" },
      { a: "1", b: "2", c: "0" },
    );
    const s = summarize(d);
    expect(s.unchanged).toBe(1); // a
    expect(s.oneSided.map((e) => e.path)).toEqual(["b"]);
    expect(s.conflicts.map((e) => e.path)).toEqual(["c"]);
  });
});

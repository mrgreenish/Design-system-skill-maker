import { describe, it, expect } from "vitest";
import { emit, cssVarName, spliceGenerated } from "../tokens-to-tailwind.ts";
import type { DtcgGroup } from "../tokens.ts";

const sample: DtcgGroup = {
  color: {
    brand: { primary: { $type: "color", $value: "#4f46e5" } },
    semantic: { accent: { $type: "color", $value: "{color.brand.primary}" } },
  },
  space: { "4": { $type: "dimension", $value: "16px" } },
  radius: { md: { $type: "dimension", $value: "8px" } },
  font: {
    family: { sans: { $type: "fontFamily", $value: ["Inter", "system-ui"] } },
    size: { md: { $type: "dimension", $value: "16px" } },
  },
  motion: {
    duration: { fast: { $type: "duration", $value: "120ms" } },
    easing: { standard: { $type: "cubicBezier", $value: [0.2, 0, 0, 1] } },
  },
};

describe("cssVarName", () => {
  it("replaces dots with dashes", () => {
    expect(cssVarName("color.brand.primary")).toBe("--color-brand-primary");
  });
});

describe("emit", () => {
  it("renders css variables with resolved values", () => {
    const { css } = emit(sample);
    expect(css).toContain("--color-brand-primary: #4f46e5;");
    // Alias resolved to concrete color
    expect(css).toContain("--color-semantic-accent: #4f46e5;");
    expect(css).toContain("--space-4: 16px;");
    expect(css).toContain("--radius-md: 8px;");
    expect(css).toContain("--motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);");
  });

  it("tailwind block references css variables", () => {
    const { tailwindBlock } = emit(sample);
    expect(tailwindBlock).toContain("var(--color-brand-primary)");
    expect(tailwindBlock).toContain("var(--space-4)");
    expect(tailwindBlock).toContain("var(--radius-md)");
    expect(tailwindBlock).toContain("var(--font-family-sans)");
    expect(tailwindBlock).toContain("BEGIN GENERATED");
    expect(tailwindBlock).toContain("END GENERATED");
  });
});

describe("spliceGenerated", () => {
  it("replaces an existing block in place", () => {
    const initial = `before\n// BEGIN GENERATED — do not edit, managed by scripts/tokens-to-tailwind.ts\nOLD\n// END GENERATED\nafter`;
    const next = `// BEGIN GENERATED — do not edit, managed by scripts/tokens-to-tailwind.ts\nNEW\n// END GENERATED`;
    const out = spliceGenerated(initial, next);
    expect(out).toContain("NEW");
    expect(out).not.toContain("OLD");
    expect(out.startsWith("before\n")).toBe(true);
    expect(out.endsWith("\nafter")).toBe(true);
  });

  it("appends when no marker exists", () => {
    const out = spliceGenerated("no markers here", "// BEGIN GENERATED — do not edit, managed by scripts/tokens-to-tailwind.ts\nX\n// END GENERATED");
    expect(out).toContain("no markers here");
    expect(out).toContain("X");
  });
});

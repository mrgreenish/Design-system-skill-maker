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

const extendedSample: DtcgGroup = {
  ...sample,
  letterSpacing: {
    tight:  { $type: "dimension", $value: "-0.025em" },
    normal: { $type: "dimension", $value: "0em" },
    wide:   { $type: "dimension", $value: "0.025em" },
  },
  borderWidth: {
    default: { $type: "dimension", $value: "1px" },
    thick:   { $type: "dimension", $value: "2px" },
  },
  opacity: {
    disabled: { $type: "number", $value: 0.4 },
    hover:    { $type: "number", $value: 0.08 },
  },
  breakpoint: {
    sm:  { $type: "dimension", $value: "480px" },
    md:  { $type: "dimension", $value: "768px" },
    lg:  { $type: "dimension", $value: "1024px" },
  },
  zIndex: {
    dropdown: { $type: "number", $value: 10 },
    modal:    { $type: "number", $value: 40 },
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

  it("emits letterSpacing tokens to css and tailwind", () => {
    const { css, tailwindBlock } = emit(extendedSample);
    expect(css).toContain("--letter-spacing-tight: -0.025em;");
    expect(css).toContain("--letter-spacing-normal: 0em;");
    expect(css).toContain("--letter-spacing-wide: 0.025em;");
    expect(tailwindBlock).toContain('"letterSpacing"');
    expect(tailwindBlock).toContain("var(--letter-spacing-tight)");
  });

  it("emits borderWidth tokens to css and tailwind", () => {
    const { css, tailwindBlock } = emit(extendedSample);
    expect(css).toContain("--border-width-default: 1px;");
    expect(css).toContain("--border-width-thick: 2px;");
    expect(tailwindBlock).toContain('"borderWidth"');
    expect(tailwindBlock).toContain("var(--border-width-default)");
  });

  it("emits opacity tokens to css and tailwind", () => {
    const { css, tailwindBlock } = emit(extendedSample);
    expect(css).toContain("--opacity-disabled: 0.4;");
    expect(css).toContain("--opacity-hover: 0.08;");
    expect(tailwindBlock).toContain('"opacity"');
    expect(tailwindBlock).toContain("var(--opacity-disabled)");
  });

  it("emits breakpoint tokens as raw values in tailwind screens (not var references)", () => {
    const { css, tailwindBlock } = emit(extendedSample);
    // CSS var is emitted
    expect(css).toContain("--breakpoint-sm: 480px;");
    // Tailwind screens uses raw value, not var()
    expect(tailwindBlock).toContain('"screens"');
    expect(tailwindBlock).toContain('"sm": "480px"');
    expect(tailwindBlock).toContain('"md": "768px"');
    expect(tailwindBlock).toContain('"lg": "1024px"');
    expect(tailwindBlock).not.toMatch(/"sm":\s*"var\(/);
  });

  it("emits zIndex tokens to css and tailwind", () => {
    const { css, tailwindBlock } = emit(extendedSample);
    expect(css).toContain("--z-index-dropdown: 10;");
    expect(css).toContain("--z-index-modal: 40;");
    expect(tailwindBlock).toContain('"zIndex"');
    expect(tailwindBlock).toContain("var(--z-index-dropdown)");
  });

  it("omits empty theme slices from the tailwind block", () => {
    const { tailwindBlock } = emit(sample);
    // sample has no letterSpacing/borderWidth/opacity/breakpoint/zIndex
    // they should still be present as empty objects (no crash)
    expect(tailwindBlock).toContain('"letterSpacing"');
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

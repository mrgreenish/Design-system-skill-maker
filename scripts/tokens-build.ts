#!/usr/bin/env tsx
/**
 * DTCG tokens.json  →  generated CSS, Tailwind config, and/or SCSS variables.
 *
 * Output format is determined by:
 *   1. `outputFormats` in figma-map.json  (explicit override, written at setup time)
 *   2. package.json dep sniffing           (auto-detect; default when no override)
 *
 * Possible formats:
 *   "css-vars"    — always emitted; writes :root { --token-name: value; } to tokens.css
 *   "tailwind-v3" — additionally writes the BEGIN/END generated block to tailwind.config.ts
 *   "tailwind-v4" — additionally writes @theme { } block appended to tokens.css
 *   "scss"        — additionally writes _tokens.scss with $variable: value; declarations
 *
 * All existing exports (emit, cssVarName, spliceGenerated) are preserved for
 * backward compatibility with sync.ts and tests.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { flatten, type DtcgGroup, type FlatToken } from "./tokens.ts";

const ROOT = resolve(import.meta.dirname, "..");
const TOKENS = resolve(ROOT, "tokens.json");
const TAILWIND = resolve(ROOT, "tailwind.config.ts");
const TOKENS_CSS = resolve(ROOT, "src/styles/tokens.css");
const TOKENS_SCSS = resolve(ROOT, "src/styles/_tokens.scss");

export const BEGIN =
  "// BEGIN GENERATED — do not edit, managed by scripts/tokens-to-tailwind.ts";
export const END = "// END GENERATED";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type OutputFormat = "css-vars" | "tailwind-v3" | "tailwind-v4" | "scss";

export interface OutputPaths {
  css?: string;
  tailwind?: string;
  scss?: string;
}

export interface EmitResult {
  tailwindBlock: string;
  css: string;
  scssBlock?: string;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

interface FigmaMapOutputConfig {
  outputFormats?: OutputFormat[];
  outputPaths?: OutputPaths;
}

/**
 * Resolve which output formats to emit.
 *
 * Priority:
 *   1. `outputFormats` array in figma-map.json (explicit, stable)
 *   2. Package.json dep sniffing (auto-detect on first run or when map is absent)
 *
 * CSS vars are always included — they're the universal base that every other
 * format builds on.
 */
export function detectOutputFormats(root = ROOT): {
  formats: OutputFormat[];
  paths: OutputPaths;
} {
  const figmaMapPath = resolve(root, "figma-map.json");
  if (existsSync(figmaMapPath)) {
    try {
      const map = JSON.parse(readFileSync(figmaMapPath, "utf8")) as FigmaMapOutputConfig;
      if (map.outputFormats && map.outputFormats.length > 0) {
        return {
          formats: map.outputFormats,
          paths: map.outputPaths ?? {},
        };
      }
    } catch {
      // fall through to package.json detection
    }
  }

  const formats: OutputFormat[] = ["css-vars"];

  const pkgPath = resolve(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };

      if ("tailwindcss" in allDeps) {
        const ver = allDeps["tailwindcss"] ?? "";
        // Match ^4.x, ~4.x, 4.x.x, >=4
        const isV4 = /(?:^|[~^>=])4\./.test(ver) || /^\d/ && ver.startsWith("4");
        formats.push(isV4 ? "tailwind-v4" : "tailwind-v3");
      }

      if ("sass" in allDeps || "sass-embedded" in allDeps) {
        formats.push("scss");
      }
    } catch {
      // non-critical; fall through with css-vars only
    }
  }

  return { formats, paths: {} };
}

// ---------------------------------------------------------------------------
// CSS variable name helper (shared across all output formats)
// ---------------------------------------------------------------------------

/**
 * A token path like `color.brand.primary.500` becomes `--color-brand-primary-500`.
 * camelCase group names (e.g. `letterSpacing`, `borderWidth`, `zIndex`) are
 * converted to kebab-case following CSS conventions.
 */
export function cssVarName(path: string): string {
  const kebab = path.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return `--${kebab.replace(/\./g, "-")}`;
}

// ---------------------------------------------------------------------------
// CSS output  (:root and optional Tailwind v4 @theme)
// ---------------------------------------------------------------------------

/**
 * Build the tokens.css content. Always includes a :root { } block.
 * When "tailwind-v4" is in formats, appends a @theme { } block with resolved
 * values so Tailwind v4 can generate utilities from the tokens.
 */
export function emitCss(tokens: FlatToken[], formats: OutputFormat[] = ["css-vars"]): string {
  const lines: string[] = [
    "/* GENERATED by scripts/tokens-build.ts — do not edit. */",
    ":root {",
  ];
  for (const t of tokens) {
    const rendered = renderCssValue(t);
    if (rendered === null) continue;
    lines.push(`  ${cssVarName(t.path)}: ${rendered};`);
  }
  lines.push("}");

  if (formats.includes("tailwind-v4")) {
    lines.push("", "@theme {");
    for (const t of tokens) {
      const rendered = renderCssValue(t);
      if (rendered === null) continue;
      // Breakpoints use a different Tailwind v4 namespace
      const varName = t.path.startsWith("breakpoint.")
        ? `--breakpoint-${t.path.split(".").slice(1).join("-")}`
        : cssVarName(t.path);
      lines.push(`  ${varName}: ${rendered};`);
    }
    lines.push("}");
  }

  lines.push("");
  return lines.join("\n");
}

function renderCssValue(t: FlatToken): string | null {
  switch (t.type) {
    case "color":
    case "dimension":
    case "duration":
      return String(t.value);
    case "number":
    case "fontWeight":
      return String(t.value);
    case "fontFamily":
      return Array.isArray(t.value)
        ? (t.value as string[]).map(quoteIfNeeded).join(", ")
        : String(t.value);
    case "cubicBezier":
      return Array.isArray(t.value)
        ? `cubic-bezier(${(t.value as number[]).join(", ")})`
        : null;
    case "shadow": {
      const s = t.value as {
        color: string;
        offsetX: string;
        offsetY: string;
        blur: string;
        spread: string;
        inset?: boolean;
      };
      const inset = s.inset ? "inset " : "";
      return `${inset}${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
    }
    default:
      return null;
  }
}

function quoteIfNeeded(f: string): string {
  return /\s/.test(f) ? `"${f}"` : f;
}

// ---------------------------------------------------------------------------
// SCSS output
// ---------------------------------------------------------------------------

/**
 * Emit SCSS variables mirroring the CSS custom properties.
 * --color-brand-primary-500 → $color-brand-primary-500: #3b82f6;
 */
export function emitScss(tokens: FlatToken[]): string {
  const lines: string[] = [
    "// GENERATED by scripts/tokens-build.ts — do not edit.",
    "",
  ];
  for (const t of tokens) {
    const rendered = renderCssValue(t);
    if (rendered === null) continue;
    // Strip leading -- and replace with $ prefix
    const scssVar = "$" + cssVarName(t.path).slice(2);
    lines.push(`${scssVar}: ${rendered};`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tailwind v3 config block
// ---------------------------------------------------------------------------

/**
 * Build a Tailwind v3-compatible theme.extend block. Values reference CSS
 * variables so the runtime theme is CSS-driven.
 */
function emitTailwind(tokens: FlatToken[]): string {
  const colors: Record<string, unknown> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const fontFamily: Record<string, string[]> = {};
  const fontSize: Record<string, string> = {};
  const fontWeight: Record<string, string> = {};
  const lineHeight: Record<string, string> = {};
  const letterSpacing: Record<string, string> = {};
  const borderWidth: Record<string, string> = {};
  const opacity: Record<string, string> = {};
  const boxShadow: Record<string, string> = {};
  const transitionDuration: Record<string, string> = {};
  const transitionTimingFunction: Record<string, string> = {};
  const screens: Record<string, string> = {};
  const zIndex: Record<string, string> = {};

  for (const t of tokens) {
    const v = `var(${cssVarName(t.path)})`;
    const tail = t.path.split(".").slice(1).join("-");

    switch (t.path.split(".")[0]) {
      case "color":
        setNested(colors, t.path.split(".").slice(1), v);
        break;
      case "space":
        spacing[tail] = v;
        break;
      case "radius":
        borderRadius[tail] = v;
        break;
      case "font":
        handleFont(t, tail, { fontFamily, fontSize, fontWeight, lineHeight });
        break;
      case "letterSpacing":
        letterSpacing[tail] = v;
        break;
      case "borderWidth":
        borderWidth[tail] = v;
        break;
      case "opacity":
        opacity[tail] = v;
        break;
      case "shadow":
        boxShadow[tail] = v;
        break;
      case "motion":
        if (t.path.startsWith("motion.duration."))
          transitionDuration[tail.replace(/^duration-/, "")] = v;
        if (t.path.startsWith("motion.easing."))
          transitionTimingFunction[tail.replace(/^easing-/, "")] = v;
        break;
      case "breakpoint":
        // Tailwind screens expects raw CSS values at build time, not var() refs.
        screens[tail] = String(t.value);
        break;
      case "zIndex":
        zIndex[tail] = v;
        break;
    }
  }

  const theme = {
    colors,
    spacing,
    borderRadius,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    borderWidth,
    opacity,
    boxShadow,
    transitionDuration,
    transitionTimingFunction,
    screens,
    zIndex,
  };

  return [
    BEGIN,
    `export const generatedTheme = ${JSON.stringify(theme, null, 2)};`,
    END,
  ].join("\n");
}

function setNested(obj: Record<string, unknown>, path: string[], value: unknown) {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!(k in cur) || typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  const existing = cur[last];
  if (existing && typeof existing === "object") {
    (existing as Record<string, unknown>).DEFAULT = value;
  } else {
    cur[last] = value;
  }
}

function handleFont(
  t: FlatToken,
  tail: string,
  sinks: {
    fontFamily: Record<string, string[]>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  },
) {
  const v = `var(${cssVarName(t.path)})`;
  if (t.path.startsWith("font.family.")) {
    sinks.fontFamily[tail.replace(/^family-/, "")] = [v];
  } else if (t.path.startsWith("font.size.")) {
    sinks.fontSize[tail.replace(/^size-/, "")] = v;
  } else if (t.path.startsWith("font.weight.")) {
    sinks.fontWeight[tail.replace(/^weight-/, "")] = v;
  } else if (t.path.startsWith("font.lineHeight.")) {
    sinks.lineHeight[tail.replace(/^lineHeight-/, "")] = v;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible emit() — used by tests and sync.ts
// ---------------------------------------------------------------------------

/** Emit CSS vars + Tailwind v3 block. Used by tests and sync.ts. */
export function emit(tree: DtcgGroup): EmitResult {
  const tokens = flatten(tree);
  return {
    tailwindBlock: emitTailwind(tokens),
    css: emitCss(tokens, ["css-vars"]),
    scssBlock: undefined,
  };
}

/** Replace (or append) the generated block inside an existing tailwind.config.ts. */
export function spliceGenerated(existing: string, newBlock: string): string {
  const beginIdx = existing.indexOf(BEGIN);
  const endIdx = existing.indexOf(END);
  if (beginIdx === -1 || endIdx === -1) {
    const sep = existing.endsWith("\n") ? "" : "\n";
    return `${existing}${sep}\n${newBlock}\n`;
  }
  const before = existing.slice(0, beginIdx);
  const after = existing.slice(endIdx + END.length);
  return `${before}${newBlock}${after}`;
}

// ---------------------------------------------------------------------------
// Main run() — called by sync.ts and directly via tsx
// ---------------------------------------------------------------------------

export async function run(root = ROOT): Promise<void> {
  const { formats, paths } = detectOutputFormats(root);

  const tokensPath = resolve(root, "tokens.json");
  const tree = JSON.parse(readFileSync(tokensPath, "utf8")) as DtcgGroup;
  const tokens = flatten(tree);

  // --- CSS vars (always) + optional Tailwind v4 @theme ---
  const cssPath = resolve(root, paths.css ?? "src/styles/tokens.css");
  mkdirSync(dirname(cssPath), { recursive: true });
  writeFileSync(cssPath, emitCss(tokens, formats));
  console.log(`[tokens-build] wrote ${cssPath}`);

  // --- Tailwind v3 config block ---
  if (formats.includes("tailwind-v3")) {
    const tailwindPath = resolve(root, paths.tailwind ?? "tailwind.config.ts");
    const tailwindBlock = emitTailwind(tokens);
    const existing = existsSync(tailwindPath)
      ? readFileSync(tailwindPath, "utf8")
      : defaultTailwindScaffold();
    writeFileSync(tailwindPath, spliceGenerated(existing, tailwindBlock));
    console.log(`[tokens-build] wrote ${tailwindPath}`);
  }

  // --- SCSS variables ---
  if (formats.includes("scss")) {
    const scssPath = resolve(root, paths.scss ?? "src/styles/_tokens.scss");
    mkdirSync(dirname(scssPath), { recursive: true });
    writeFileSync(scssPath, emitScss(tokens));
    console.log(`[tokens-build] wrote ${scssPath}`);
  }

  const formatList = formats.join(", ");
  console.log(`[tokens-build] formats: ${formatList}`);
}

function defaultTailwindScaffold(): string {
  return `import type { Config } from "tailwindcss";

${BEGIN}
export const generatedTheme = {};
${END}

const config: Config = {
  content: ["./src/**/*.{ts,tsx,html,mdx}", "./.storybook/**/*.{ts,tsx,mdx}"],
  theme: { extend: generatedTheme },
  plugins: [],
};

export default config;
`;
}

// Run when invoked directly (tsx scripts/tokens-build.ts).
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

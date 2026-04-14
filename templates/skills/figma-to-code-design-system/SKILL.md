---
name: figma-to-code-design-system
description: Pulls design tokens from Figma into code. Reads Figma variables and text/effect styles via MCP, updates tokens.json, regenerates output files (CSS custom properties, and conditionally Tailwind config or SCSS based on outputFormats in figma-map.json), updates DESIGN.md, and scaffolds / updates Storybook with rich token-gallery stories. Use when Figma has changed and you want code to reflect those changes.
---

# figma-to-code-design-system

## When to use

- User says "pull from Figma", "update tokens from Figma", "Figma changed — update code."
- After a designer updates variables, text styles, or effect styles in Figma.
- First-time Storybook scaffold for a project.

Do NOT use this skill to push changes INTO Figma — that's `code-to-figma-design-system`.

## Prerequisites

- Figma Dev Mode MCP server connected.
- `figma-map.json` present (produced by `setup-design-system`).

## Steps

### 1. Read Figma state via MCP

Call all available MCP read tools and write their output to the cache:

a. **Variables**: `get_variable_defs` → write to `.figma-cache/variables.json`.
   Primary source for color, dimension, fontFamily, fontWeight, number, duration tokens.

b. **Text styles** (if available): `get_local_text_styles` → write to
   `.figma-cache/text-styles.json`. Carries the full typography spec (family,
   size, weight, lineHeight, letterSpacing) even when not exposed as variables.

c. **Effect styles** (if available): `get_local_effect_styles` → write to
   `.figma-cache/effect-styles.json`. Carries shadow definitions.

### 2. Load and flatten tokens.json

Read `tokens.json` and build a flat map `{ [dtcgPath]: { type, value } }` by
walking every nested key that contains a `$value` field. Resolve alias values
(`{color.brand.primary}` → concrete hex) so comparisons are value-to-value.

### 3. Compare Figma state to tokens.json

For each Figma variable in the cache, derive its DTCG path following
`_shared/token-conventions.md` and compare to the flat token map:

- **New in Figma, absent in tokens.json** → add
- **Value differs** → update (Figma wins for figma-to-code direction)
- **Present in tokens.json, absent in Figma** → skip (never auto-delete; surface
  as a note so the user can decide)
- **Token type is `shadow` or `cubicBezier`** → skip (these don't round-trip
  through Figma variables; handle via text/effect styles below)

For text styles (`.figma-cache/text-styles.json` if present):
- Map `fontFamily` → `font.family.{sans|serif|mono}`
- Map `fontSize` → `font.size.{xs..5xl}`
- Map `fontWeight` → `font.weight.{light|regular|medium|semibold|bold}`
- Map `lineHeight` → `font.lineHeight.{tight..loose}`
- Map `letterSpacing` → `letterSpacing.{tighter..widest}`
- Additive only — never overwrite hand-crafted values that exist in tokens.json

For effect styles (`.figma-cache/effect-styles.json` if present):
- Map box shadows → `shadow.{xs|sm|md|lg|xl}` based on blur radius
- Additive only

Surface a concise summary of planned changes (e.g. "12 tokens to update, 3 to
add, 2 tokens in tokens.json not found in Figma (kept)") and ask the user to
confirm before writing.

### 4. Write tokens.json

Apply the confirmed changes directly to `tokens.json`. Preserve all existing
keys outside the changed set — do not reformat or reorder untouched sections.

### 5. Regenerate output files

Read `figma-map.json` to get `outputFormats` (set by `setup-design-system`).
If `outputFormats` is absent, auto-detect from `package.json` deps (same
logic as `setup-design-system` Step 2.5).

For each token in the updated `tokens.json`, derive:
- CSS var name: replace dots with dashes, convert camelCase to kebab-case,
  prefix with `--`. Example: `color.brand.primary.500` → `--color-brand-primary-500`
- CSS value: use the resolved `$value` directly (colors as hex/oklch, dimensions
  with unit, fontFamily as comma-separated list, shadow as the expanded shorthand)

**Always — CSS custom properties:**

Write `tokens.css` (path from `outputPaths.css` or default `src/styles/tokens.css`):
```css
/* GENERATED — do not edit */
:root {
  --color-brand-primary-500: #3b82f6;
  --space-4: 1rem;
  /* ... all tokens ... */
}
```

**If `tailwind-v3` in `outputFormats`:**

Splice the generated block into `tailwind.config.ts` between the
`// BEGIN GENERATED` and `// END GENERATED` markers. The block exports
`generatedTheme` with CSS `var()` references for every token category
(colors, spacing, borderRadius, fontFamily, fontSize, fontWeight, lineHeight,
letterSpacing, borderWidth, opacity, boxShadow, transitionDuration,
transitionTimingFunction, screens, zIndex). Breakpoint values use raw values
(not `var()`) because Tailwind processes them at build time.

If `tailwind.config.ts` doesn't exist yet, create it with a minimal scaffold:
```ts
import type { Config } from "tailwindcss";
// BEGIN GENERATED — do not edit
export const generatedTheme = { /* ... */ };
// END GENERATED
const config: Config = {
  content: ["./src/**/*.{ts,tsx,html,mdx}"],
  theme: { extend: generatedTheme },
  plugins: [],
};
export default config;
```

**If `tailwind-v4` in `outputFormats`:**

Append an `@theme { }` block after the `:root` block in `tokens.css`:
```css
@theme {
  --color-brand-primary-500: #3b82f6;
  --spacing-4: 1rem;
  /* ... all tokens with their actual values ... */
}
```
No `tailwind.config.ts` is needed for v4.

**If `scss` in `outputFormats`:**

Write `_tokens.scss` (path from `outputPaths.scss` or default
`src/styles/_tokens.scss`):
```scss
// GENERATED — do not edit
$color-brand-primary-500: #3b82f6;
$space-4: 1rem;
// ...
```
Variable names mirror the CSS var names with `$` prefix and no leading `--`.

### 6. Update DESIGN.md

If `DESIGN.md` exists in the project root, update sections 2–6 to reflect
the new token values. Leave sections 1, 7, 8, 9 unchanged.

- **Section 2**: Rebuild color tables from `color.*` tokens
- **Section 3**: Rebuild typography table from `font.*` and `letterSpacing.*`
- **Section 5**: Rebuild spacing/radius tables from `space.*` and `radius.*`
- **Section 6**: Rebuild shadow table from `shadow.*`

### 7. Install Storybook if missing

If `.storybook/main.ts` exists but `node_modules/storybook` does not, run:

```
npm i -D storybook @storybook/react-vite @storybook/addon-essentials \
         @storybook/blocks storybook-design-token \
         react react-dom vite @vitejs/plugin-react
```

### 8. Update Storybook token stories

Create or update the following MDX story files in `.storybook/stories/`:

**Colors.stories.mdx**
- Color palette grid organized by hue family (brand, neutral, status, semantic)
- Each swatch shows: CSS var name, hex value, and semantic role if applicable
- Semantic section: shows bg/fg/border/interactive/status role names with their resolved colors

**Typography.stories.mdx**
- Full type scale rendered at actual sizes
- For each type stop: role name, sample text, and specs (size / weight / line-height / letter-spacing)
- Desktop/tablet/mobile columns where responsive sizes differ

**Spacing.stories.mdx**
- Visual spacing blocks with proportional widths
- Each row: token name | rem value | px value | proportional rectangle
- Radius section: rounded squares showing each radius stop

**Shadows.stories.mdx**
- Cards showing each shadow level with the CSS value
- Light and dark surface variants side by side

**Motion.stories.mdx**
- Animated demo boxes cycling through each duration + easing combination

### 9. Report

Summarize:
- How many tokens changed (by group: color N, space N, font N, …)
- Which output files were written
- Any text/effect styles extracted manually
- Any tokens in tokens.json not found in Figma (kept, not deleted)
- DESIGN.md sections updated (or skipped if not present)

## Constraints

- Never hand-edit `tokens.css`, `_tokens.scss`, or the generated block in
  `tailwind.config.ts`. If the user asks to tweak a token, edit `tokens.json`
  and re-run this skill.
- Text and effect style extraction is additive only — never delete tokens that
  exist in `tokens.json` but not in the Figma cache.
- Never auto-delete tokens that are absent from Figma — surface them as a note.

## Troubleshooting

- **Tailwind typecheck error on `fontFamily`** — the generated block must
  emit plain arrays (not `as const`); wrap each font family entry in an array.
- **Storybook Design Tokens panel empty** — ensure `.storybook/main.ts`
  points `storybook-design-token.glob` at `src/styles/tokens.css`.
- **Text styles not syncing** — check that `.figma-cache/text-styles.json`
  was written in step 1. If the MCP doesn't expose a text-styles tool,
  extract them from `get_code` on a typography frame and manually update
  `tokens.json`.
- **Shadow values not updating** — shadows are additive only. Update
  `tokens.json` directly with the new shadow values from the effect styles,
  then re-run step 5 to regenerate output files.
- **outputFormats not set** — if `figma-map.json` has no `outputFormats`,
  auto-detection from `package.json` is used. Run `setup-design-system` to
  write an explicit `outputFormats` to `figma-map.json`.

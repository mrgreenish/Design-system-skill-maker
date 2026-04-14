---
name: figma-to-code-design-system
description: Pulls design tokens from Figma into code. Reads Figma variables and text/effect styles via MCP, updates tokens.json, regenerates tailwind.config.ts (generated block) and src/styles/tokens.css, updates DESIGN.md, and scaffolds / updates Storybook with rich token-gallery stories. Use when Figma has changed and you want code to reflect those changes.
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

### 1. Refresh the Figma cache

Call all available MCP read tools and write their output to the cache:

a. **Variables**: `get_variable_defs` → write to `.figma-cache/variables.json`.
   This is the primary source for color, dimension, fontFamily, fontWeight,
   number, and duration tokens.

b. **Text styles** (if available): `get_local_text_styles` → write to
   `.figma-cache/text-styles.json`. Text styles carry the full typography
   spec (family, size, weight, lineHeight, letterSpacing) even when these
   aren't exposed as variables.

c. **Effect styles** (if available): `get_local_effect_styles` → write to
   `.figma-cache/effect-styles.json`. Effect styles carry shadow definitions.

### 2. Dry-run the sync

```
npm run ds:sync:dry -- --direction=figma-to-code
```

Read the stdout summary. If conflicts > 0, stop and run the full sync
(without `--dry-run`) to generate `sync-conflict.md`, then surface it
to the user. Do not proceed until all conflicts are resolved.

### 3. Apply text style changes to tokens.json (if .figma-cache/text-styles.json exists)

Text styles are not Figma variables, so `sync.ts` doesn't pick them up
automatically. For each text style in the cache, derive the DTCG token paths
following `_shared/token-conventions.md` and update `tokens.json` directly:

- `fontFamily` → `font.family.{sans|serif|mono}`
- `fontSize` → `font.size.{xs..5xl}` (map to nearest size stop or add new)
- `fontWeight` → `font.weight.{light|regular|medium|semibold|bold}`
- `lineHeight` → `font.lineHeight.{tight..loose}` (as a `number` type)
- `letterSpacing` → `letterSpacing.{tighter..widest}` (as a `dimension` type with em unit)

Only add new tokens or update changed ones — never delete tokens that exist in
`tokens.json` but not in the Figma text styles (the designer may use hand-crafted
values for some stops).

### 4. Apply effect style changes to tokens.json (if .figma-cache/effect-styles.json exists)

For each effect style that represents a box shadow:
- Map to `shadow.{xs|sm|md|lg|xl}` based on blur radius and spread
- Update the `shadow` composite token in `tokens.json`

These are manual-protected — they won't be auto-pushed back to Figma.

### 5. Run the full figma-to-code sync

```
npm run ds:sync -- --direction=figma-to-code
```

This reads `.figma-cache/variables.json`, diffs against `tokens.json` +
`tokens.lock.json`, and updates `tokens.json`.

### 6. Sanity-check `tokens.json`

Run `npm run ds:sync:dry`. If it now shows `conflict`, stop and direct the
user to resolve them first (see `sync-conflict.md`).

### 7. Regenerate code

```
npm run ds:build
```

This writes:
- `src/styles/tokens.css` — fully generated
- `tailwind.config.ts` — only the `BEGIN GENERATED` / `END GENERATED` block
  is replaced; everything outside those markers is preserved

### 8. Update DESIGN.md

If `DESIGN.md` exists in the project root, update sections 2–6 to reflect
the new token values. Leave sections 1, 7, 8, 9 unchanged (those require
human review).

For each section, re-generate the tables and lists from the updated `tokens.json`:
- **Section 2**: Rebuild color tables from `color.*` tokens
- **Section 3**: Rebuild typography table from `font.*` and `letterSpacing.*`
- **Section 5**: Rebuild spacing/radius tables from `space.*` and `radius.*`
- **Section 6**: Rebuild shadow table from `shadow.*`

### 9. Install Storybook if missing

If `.storybook/main.ts` exists but `node_modules/storybook` does not, run:

```
npm i -D storybook @storybook/react-vite @storybook/addon-essentials \
         @storybook/blocks storybook-design-token \
         react react-dom vite @vitejs/plugin-react
```

These are intentionally NOT in `package.json` by default so token-only users
don't pay the install cost.

### 10. Update Storybook token stories

Create or update the following MDX story files in `.storybook/stories/`:

**Colors.stories.mdx**
- Color palette grid organized by hue family (brand, neutral, status, semantic)
- Each swatch shows: CSS var name, hex value, and semantic role if applicable
- Semantic section: shows bg/fg/border/interactive/status role names with their resolved colors
- Based on the "Boodschappen" pattern: dark shades at top → light at bottom per family

**Typography.stories.mdx**
- Full type scale rendered at actual sizes
- For each type stop: role name, sample text ("The quick brown fox jumps over the lazy dog"),
  and specs (size / weight / line-height / letter-spacing)
- Desktop/tablet/mobile columns where responsive sizes differ
- Based on the Boodschappen typography documentation pattern

**Spacing.stories.mdx**
- Visual spacing blocks with proportional widths (like IBM Carbon's spacing spec)
- Each row: token name | rem value | px value | proportional rectangle
- Radius section: rounded squares showing each radius stop

**Shadows.stories.mdx**
- Cards showing each shadow level with the CSS value
- Light and dark surface variants side by side

**Motion.stories.mdx**
- Animated demo boxes cycling through each duration + easing combination

### 11. Verify Storybook renders

Run `npm run storybook -p 6006` (background) and open `http://localhost:6006`.
Check that:
- `Tokens/Colors` shows swatches for all `color.*` tokens grouped by family
- `Tokens/Typography` renders the full type scale with responsive columns
- `Tokens/Spacing & Radii` renders spacing bars + rounded squares
- `Tokens/Shadows & Motion` renders shadow cards and animates on hover

### 12. Commit the lock

```
tsx scripts/ds/sync.ts --commit-lock
```

### 13. Report

Summarize to the user:
- How many tokens changed (by group)
- Which files changed
- Any text/effect styles extracted manually
- Any tokens skipped (alias, manual-protected)
- DESIGN.md sections updated

## Constraints

- Never hand-edit `src/styles/tokens.css` or the generated block in
  `tailwind.config.ts`. If the user asks to tweak a token, edit
  `tokens.json` and re-run this skill.
- Do not regenerate if `npm run ds:sync:dry` reports conflicts.
- Text and effect style extraction in steps 3–4 is additive only — never
  delete tokens that exist in `tokens.json` but not in the Figma cache.

## Troubleshooting

- **Tailwind typecheck error on `fontFamily`** — the generated block must
  emit plain arrays (not `as const`); that's already handled by
  `scripts/ds/tokens-to-tailwind.ts`.
- **Storybook Design Tokens panel empty** — ensure `.storybook/main.ts`
  points `storybook-design-token.glob` at `src/styles/tokens.css`.
- **Text styles not syncing** — check that `.figma-cache/text-styles.json`
  was written in step 1. If the MCP doesn't expose a text-styles tool,
  extract them from `get_code` on a typography frame and manually update
  `tokens.json`.
- **Shadow values not updating** — shadows are manual-protected. Update
  `tokens.json` directly with the new shadow values from the effect styles,
  then re-run `npm run ds:build`.

---
name: setup-design-system
description: Meta-skill. Sets up a bi-directional Figma ↔ code design system in a target project. Inspects an existing Figma file via Dev Mode MCP, detects the project's CSS framework, scaffolds two skills (figma-to-code-design-system and code-to-figma-design-system), wires hooks, seeds tokens.json, writes initial output files, and auto-generates DESIGN.md. Use when starting a new project or when the Figma file's structure has changed meaningfully.
---

# setup-design-system

## What this skill does

It turns **any project** into a fully wired Figma ↔ code design system by:

1. Reading the Figma file's variable structure, text styles, and effect styles via MCP
2. Asking you to confirm the DTCG token mapping
3. Detecting the project's CSS framework (Tailwind v3/v4, SCSS, or plain CSS)
4. Writing two operational skills into the project's skills folder:
   - **`figma-to-code-design-system`** — pull Figma tokens into code
   - **`code-to-figma-design-system`** — push code tokens back to Figma
5. Seeding `tokens.json` from the current Figma state with the full token group structure
6. Writing the initial CSS, Tailwind config, and/or SCSS output files directly
7. Auto-generating `DESIGN.md` from the extracted design system data

The target project gets **zero TypeScript scripts** — only `figma-map.json`,
`tokens.json`, two skill files, and optional hooks. All sync and build logic
lives in the skills themselves.

After this skill completes, the target project is self-contained.

## When to use

- "Set up a design system from this Figma file"
- "Create the design system skills for this project"
- The Figma file's variable-collection or page structure has been reorganized
  and the existing skills are out of date (re-run to refresh).

Do NOT use this skill if the user just wants to pull token values from Figma
into code — that's the `figma-to-code-design-system` skill (already installed).

## Prerequisites

- Figma Dev Mode MCP server connected (`get_variable_defs` reachable).
- User has either a Figma URL open OR a frame selected in Figma desktop.
- This repo (`Design-system-skill-maker`) is accessible so the setup skill
  can copy from the `templates/` directory.

## Inputs to collect

1. **Figma file URL or file key.**
   If the user opens Figma desktop and has a selection, `get_variable_defs`
   may work without a URL. Otherwise ask:
   > "Paste the Figma file URL (or just the file key — the alphanumeric
   > segment after `/file/`)."

2. **Target project root path.**
   > "What is the absolute path to the project where I should install the
   > design system? (e.g. `/Users/you/projects/my-app`)"

3. **Skills folder location** in the target project:
   > "Where should I put the design system skills?
   > 1. `.claude/skills/` (Claude Code)
   > 2. `.cursor/skills/` (Cursor)
   > 3. Other (I'll type the path)"

4. **Hooks folder location** in the target project:
   > "Where should I put the hooks?
   > 1. `.claude/hooks/` (Claude Code)
   > 2. `.cursor/hooks/` (Cursor)
   > 3. Skip hooks for now"

5. **Token grouping intent.** Confirm with the user:
   > "I'll organize tokens into:
   > - Primitives: color.brand, color.neutral, color.{hue}, space, radius, font,
   >   letterSpacing, borderWidth, opacity, shadow, motion
   > - Semantic: color.semantic.{bg,fg,border,accent}, color.interactive, color.status
   > - Utility: breakpoint, zIndex
   > OK to proceed, or do you want a different split?"

## Steps

### 1. Read Figma state via MCP

Call MCP tools to extract all available design data:

a. **Variables**: Call `get_variable_defs` to list all variable collections,
   modes, and variables. This is the primary source for colors, spacing, radii,
   typography sizes/weights, and any other numeric tokens.

b. **Text styles** (if available): Call `get_local_text_styles` or equivalent.
   These provide the full typography scale including family, size, weight,
   line-height, and letter-spacing.

c. **Effect styles** (if available): Call `get_local_effect_styles` or
   equivalent. These provide shadow definitions.

d. Fall back to `get_code` on representative frames only if variables and styles
   don't provide enough data. Prefer variables — they round-trip cleanly to DTCG.

### 2. Propose a name → DTCG-path mapping

For each Figma variable/style, derive a DTCG path following
`_shared/token-conventions.md`. Aim for this full structure:

```
color.brand.primary.{50..900}
color.brand.secondary.{50..900}   (if present)
color.neutral.{0..900}
color.semantic.bg.{default,card,input,nav}
color.semantic.fg.{default,secondary,tertiary,placeholder}
color.semantic.border.{default,input,strong,focus}
color.interactive.{primary,hover,active,focus,disabled}
color.status.{error,success,warning,info}.{bg,fg,border}
space.{0,1,2,3,4,5,6,7,8,10,12,16}
radius.{none,sm,md,lg,xl,full}
font.family.{sans,serif?,mono}
font.size.{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl}
font.weight.{light?,regular,medium,semibold,bold}
font.lineHeight.{tight,snug,normal,relaxed,loose}
letterSpacing.{tighter?,tight?,normal,wide,wider?}
borderWidth.{default,thick}
opacity.{disabled,hover}
shadow.{xs?,sm,md,lg,xl}
motion.duration.{fast,normal,slow}
motion.easing.{standard,decelerate,accelerate}
breakpoint.{sm,md,lg,xl,2xl}
zIndex.{dropdown,sticky,modal,tooltip}
```

Show the mapping as a confirmation table (max 40 rows visible at once) and ask
the user to confirm or edit before writing any files.

### 2.5. Detect CSS framework and confirm output formats

Read the target project's `package.json` (dependencies, devDependencies,
peerDependencies) to determine which output formats to emit. Then confirm
with the user before writing any files.

Detection rules:

| Condition | Formats added |
|---|---|
| Always | `css-vars` — `:root { }` CSS custom properties in `tokens.css` |
| `tailwindcss` `^3.x` / `~3.x` present | `tailwind-v3` — generated block in `tailwind.config.ts` |
| `tailwindcss` `^4.x` / `4.x` present | `tailwind-v4` — `@theme { }` block appended to `tokens.css` |
| `sass` or `sass-embedded` present | `scss` — `_tokens.scss` with `$variable: value;` declarations |

Example confirmation message:
> "Detected Tailwind v3 — will emit:
> - `src/styles/tokens.css` (CSS custom properties, always)
> - `tailwind.config.ts` generated block (Tailwind v3)
> OK to proceed, or do you want a different set?"

Write the confirmed formats into `figma-map.json` along with optional path
overrides so subsequent skill runs are deterministic:

```json
{
  "fileKey": "abc123",
  "outputFormats": ["css-vars", "tailwind-v3"],
  "outputPaths": {
    "css": "src/styles/tokens.css",
    "tailwind": "tailwind.config.ts",
    "scss": "src/styles/_tokens.scss"
  }
}
```

`outputPaths` is optional — omit entries that use their default paths.

### 3. Copy skill templates into the target project

Source: `templates/skills/` in this repo.
Destination: the skills folder the user chose in Inputs step 3.

Files to copy:
- `figma-to-code-design-system/SKILL.md`
- `code-to-figma-design-system/SKILL.md`
- `_shared/dtcg-reference.md`
- `_shared/token-conventions.md`

Also copy `templates/DESIGN-TEMPLATE.md` to `<target-root>/DESIGN-TEMPLATE.md`
(it will be filled and renamed to `DESIGN.md` in step 8).

### 4. Copy hooks (unless user skipped)

Source: `templates/hooks/` in this repo.
Destination: the hooks folder the user chose.

Files to copy:
- `post-edit.mjs`
- `session-start.mjs`
- `stop.mjs`

After copying, wire the hooks in the target project's settings file
(`.claude/settings.json` or `.cursor/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "node <hooks-folder>/post-edit.mjs" }] }],
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node <hooks-folder>/session-start.mjs" }] }],
    "Stop":         [{ "hooks": [{ "type": "command", "command": "node <hooks-folder>/stop.mjs" }] }]
  }
}
```

If a settings file already exists, merge rather than overwrite.

### 5. Write `figma-map.json` and `.figma-cache/variables.json`

Using the confirmed mapping from step 2, the output formats from step 2.5,
and the raw MCP data:

- `<target-root>/figma-map.json` — file key, collection IDs, mode IDs,
  per-token type/unit overrides, manual-protected flags, and `outputFormats`.
- `<target-root>/.figma-cache/variables.json` — raw variable cache from
  `get_variable_defs` (write exactly what the MCP returned).

### 6. Seed `tokens.json`

Build `tokens.json` directly from the MCP data collected in step 1, using
the confirmed DTCG path mapping from step 2.

Walk every Figma variable and write it as a DTCG token leaf:
```json
{
  "color": {
    "brand": {
      "primary": {
        "500": { "$type": "color", "$value": "#3b82f6" }
      }
    }
  }
}
```

After the variable tokens are written, manually add token groups that Figma
variables can't carry (from text/effect styles collected in step 1):
- `shadow.*` — from effect styles; use composite shadow token format
- `motion.*` — from prototype tokens or designer-provided values if absent
- `breakpoint.*` — from design specs or standard breakpoint set
- `zIndex.*` — standard values unless the project specifies custom ones

Use `_shared/token-conventions.md` as the reference for the full expected
token group structure and value conventions.

### 7. Write initial output files

Using the `outputFormats` confirmed in step 2.5, write the initial output
files directly (no build script needed):

**CSS custom properties (always):**
Write `tokens.css` at `outputPaths.css` (default: `src/styles/tokens.css`):
```css
/* GENERATED — do not edit */
:root {
  --color-brand-primary-500: #3b82f6;
  --space-4: 1rem;
  /* ... */
}
```
CSS var name derivation: replace dots with dashes, convert camelCase segments
to kebab-case, prefix with `--`.
Example: `font.lineHeight.tight` → `--font-line-height-tight`

**Tailwind v3 (if in outputFormats):**
Create or splice the generated block in `tailwind.config.ts`. The block exports
`generatedTheme` with `var()` references for all token categories. Breakpoints
use raw values. Create the file with a minimal scaffold if absent.

**Tailwind v4 (if in outputFormats):**
Append `@theme { }` after the `:root` block in `tokens.css`. No `.config.ts` needed.

**SCSS (if in outputFormats):**
Write `_tokens.scss` at `outputPaths.scss` (default: `src/styles/_tokens.scss`)
with `$variable-name: value;` for every token.

### 8. Auto-generate DESIGN.md

Read `DESIGN-TEMPLATE.md` (copied in step 3) and fill all `{{PLACEHOLDER}}`
markers using the data already collected. Write the result to `DESIGN.md`.

**How to fill each section:**

**Section 1 — Visual Theme & Atmosphere**
Analyze the extracted tokens to write a brief atmospheric description:
- `{{BACKGROUND_TONE}}`: warm/cool/neutral? (compare bg default color temp)
- `{{ACCENT_DESCRIPTION}}`: describe the brand primary hue (e.g. "vibrant blue", "earthy terracotta")
- `{{TYPOGRAPHY_MOOD}}`: editorial/clean/technical? (serif presence? light weights?)
- `{{ELEVATION_STRATEGY}}`: "shadow layering" if multiple shadow levels, "background-color zoning" if flat design

**Section 2 — Color Palette & Roles**
Populate directly from `tokens.json`:
- Each `color.brand.*` group → brand colors table
- Each `color.neutral.*` → neutral scale
- Each `color.semantic.*` → semantic tables
- Each `color.interactive.*` → interactive states
- Each `color.status.*` → status table

**Section 3 — Typography Rules**
Populate from `tokens.json` + text styles:
- `font.family.*` → font families
- Combine `font.size`, `font.weight`, `font.lineHeight`, `letterSpacing` into the type scale table
- If Figma text styles have named roles (Display, Heading-01, Body, Caption), map them
- Infer principles from the weight and size distribution

**Section 4 — Component Stylings**
Fill button/card/input/nav sections using semantic color tokens + dimension tokens.
Use `color.interactive.*` for CTA states, `radius.*` for corners, `space.*` for padding.

**Section 5 — Layout Principles**
- Spacing: dump `space.*` tokens as a table with px/rem equivalents
- Grid: use `breakpoint.*` tokens for the columns/gutter table if present
- Radius: dump `radius.*` scale with suggested use cases

**Section 6 — Depth & Elevation**
- Dump `shadow.*` tokens with CSS output values
- Describe strategy (flat vs layered vs ring-based)

**Sections 7–9** (Do's/Don'ts, Responsive, Prompt Guide)
Fill in using the actual extracted token values as the specific references.
Sections 7 and 9 require some creative writing — use the values you extracted
to make them concrete and actionable.

Save the completed file as `<target-root>/DESIGN.md`. Delete `DESIGN-TEMPLATE.md`.

### 9. Verify

Check that:
- `figma-map.json` parses and contains `fileKey` and `outputFormats`
- `tokens.json` parses and contains at least color, space, and font tokens
- Output files exist at their expected paths (`tokens.css`, and conditionally
  `tailwind.config.ts` or `_tokens.scss`)
- Skills are present at the chosen skills location
- Hooks are present and wired (or noted as skipped)

If any check fails, fix it before reporting completion.

## Output checklist

- [ ] Two skills installed at the chosen skills location
- [ ] Shared docs (`_shared/`) installed alongside the skills
- [ ] Hooks installed and wired in settings (or skipped by user)
- [ ] `figma-map.json` exists with `fileKey`, `outputFormats`, and collection metadata
- [ ] `.figma-cache/variables.json` exists and parses
- [ ] `tokens.json` seeded from Figma with full token group structure
- [ ] Output files written: `tokens.css` always; plus `tailwind.config.ts` or `_tokens.scss` as appropriate
- [ ] `DESIGN.md` written with all placeholders filled
- [ ] All output files parse without errors
- [ ] Summary delivered to user: N tokens seeded, files written, DESIGN.md sections completed

## Template — `build-ds-figma/SKILL.md` (optional project-specific shortcut)

If the user wants a project-specific shortcut skill that pre-fills the file
key, write this additional skill to the chosen skills location:

```markdown
---
name: build-ds-figma
description: Project-specific shortcut. Delegates to code-to-figma-design-system with the Figma file "<FIGMA_FILE_NAME>" (key: <FIGMA_FILE_KEY>) pre-filled.
---

# build-ds-figma (generated)

File key: `<FIGMA_FILE_KEY>`
Variable collection(s): `<COLLECTION_NAMES>`
Modes: `<MODE_NAMES>`

## Invocation

Delegate to the generic `code-to-figma-design-system` skill with this file key
pre-filled. Do NOT re-run `setup-design-system` unless the Figma file's
structure has changed.
```

---
name: setup-design-system
description: Meta-skill. Sets up a bi-directional Figma ↔ code design system in a target project. Inspects an existing Figma file via Dev Mode MCP, scaffolds two skills (figma-to-code-design-system and code-to-figma-design-system), copies the sync engine scripts, wires hooks, seeds tokens.json, and auto-generates DESIGN.md. Use when starting a new project or when the Figma file's structure has changed meaningfully.
---

# setup-design-system

## What this skill does

It turns **any project** into a fully wired Figma ↔ code design system by:

1. Reading the Figma file's variable structure, text styles, and effect styles via MCP
2. Asking you to confirm the DTCG token mapping
3. Copying the sync engine (`scripts/ds/`) and hooks into the target project
4. Merging the required npm scripts and deps into `package.json`
5. Writing two operational skills into the project's skills folder:
   - **`figma-to-code-design-system`** — pull Figma tokens into code
   - **`code-to-figma-design-system`** — push code tokens back to Figma
6. Seeding `tokens.json` from the current Figma state with the full token group structure
7. Running the initial code build
8. Auto-generating `DESIGN.md` from the extracted design system data

After this skill completes, the target project is self-contained — it never
needs to reference this repo again.

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
  can copy from the `templates/` and `scripts/` directories.

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

### 3. Copy the sync engine into the target project

Copy `scripts/` from this repo into `<target-root>/scripts/ds/`:

```
<target-root>/scripts/ds/sync.ts
<target-root>/scripts/ds/tokens.ts
<target-root>/scripts/ds/diff-tokens.ts
<target-root>/scripts/ds/figma-read.ts
<target-root>/scripts/ds/figma-write.ts
<target-root>/scripts/ds/figma-map.ts
<target-root>/scripts/ds/sync-direction.ts
<target-root>/scripts/ds/tokens-to-tailwind.ts
```

Do NOT copy `scripts/__tests__/` unless the user explicitly asks for tests.

### 4. Copy skill templates into the target project

Source: `templates/skills/` in this repo.
Destination: the skills folder the user chose in step 3 of Inputs.

Files to copy:
- `figma-to-code-design-system/SKILL.md`
- `code-to-figma-design-system/SKILL.md`
- `_shared/dtcg-reference.md`
- `_shared/token-conventions.md`

Also copy `templates/DESIGN-TEMPLATE.md` to `<target-root>/DESIGN-TEMPLATE.md`
(it will be filled and renamed to `DESIGN.md` in step 10).

### 5. Copy hooks (unless user skipped)

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

### 6. Merge deps and scripts into the target project's package.json

Read `templates/package-fragment.json` from this repo. For each key:
- `scripts`: add `ds:build`, `ds:sync`, `ds:sync:dry` (never overwrite
  existing scripts with conflicting names without asking).
- `devDependencies` / `dependencies`: add only if not already present.

### 7. Write `figma-map.json` and `.figma-cache/variables.json`

Using the confirmed mapping from step 2 and the raw MCP data:

- `<target-root>/figma-map.json` — file key, collection IDs, mode IDs,
  per-token type/unit overrides, and any manual-protected flags.
- `<target-root>/.figma-cache/variables.json` — raw variable cache (the
  schema is documented in `scripts/ds/figma-read.ts`).

### 8. Seed `tokens.json`

Run in the target project root:

```
tsx scripts/ds/sync.ts --direction=figma-to-code
```

This reads `.figma-cache/variables.json` and writes `tokens.json`.

After seeding, manually add any token groups that Figma variables can't carry
(shadows from effect styles, motion values if not in variables, breakpoints,
zIndex). Use the full structure in `_shared/token-conventions.md` as a guide —
populate with values from the Figma file inspection.

### 9. Run the initial code build

```
npm run ds:build
```

This writes `src/styles/tokens.css` and splices the generated block into
`tailwind.config.ts` (creating it with a minimal scaffold if absent).

### 10. Auto-generate DESIGN.md

Read `DESIGN-TEMPLATE.md` (copied in step 4) and fill all `{{PLACEHOLDER}}`
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

### 11. Verify

```
npm run ds:sync:dry
```

Should report `0 conflicts` and `0 one-sided`. If not, surface the summary
to the user before finishing.

## Output checklist

- [ ] `<target-root>/scripts/ds/` contains all 8 engine scripts
- [ ] Two skills installed at the chosen skills location
- [ ] Shared docs (`_shared/`) installed alongside the skills
- [ ] Hooks installed and wired in settings (or skipped by user)
- [ ] `package.json` has `ds:build`, `ds:sync`, `ds:sync:dry` scripts
- [ ] `figma-map.json` exists with `fileKey` and collection metadata
- [ ] `.figma-cache/variables.json` exists and parses
- [ ] `tokens.json` seeded from Figma with full token group structure
- [ ] `npm run ds:build` succeeds
- [ ] `DESIGN.md` written with all placeholders filled
- [ ] `npm run ds:sync:dry` reports `0 conflicts`
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

---
name: code-to-figma-design-system
description: Pushes design token changes from the code side (tokens.json) into Figma via the Dev Mode MCP, then creates/updates visual documentation pages in Figma (color swatches, typography scale, spacing spec, grid, button/form state matrices). Use when the user edits tokens.json and wants Figma to reflect those changes.
---

# code-to-figma-design-system

## When to use

- User says "push tokens to Figma", "update Figma", "sync design system to Figma."
- The `PostToolUse` hook on `tokens.json` fires and you want to offer the push.
- User says "create the Figma documentation pages" or "build the design system in Figma."

Do NOT use this skill to pull Figma changes into code — use
`figma-to-code-design-system` instead.

## Prerequisites

- Figma Dev Mode MCP connected, with the file open in Figma desktop.
- `figma-map.json` present (produced by `setup-design-system`). If it's
  missing, stop and tell the user to run `setup-design-system` first.

---

## Part A — Variable sync (tokens into Figma)

### A1. Load tokens and current Figma state

Read `tokens.json` and build a flat map `{ [dtcgPath]: { type, value } }` by
walking every nested key with a `$value` field. Resolve all alias references
so every value is concrete before comparing.

Call `get_variable_defs` to get the current state of all variables in the
Figma file. Build a parallel flat map from the Figma response.

Read `figma-map.json` for `fileKey`, `collections`, and per-token metadata
(type overrides, unit hints, `syncCapability`).

### A2. Identify changes

Compare the two flat maps and produce three lists:

**To create** — in `tokens.json` but absent from Figma variables.
Skip tokens whose DTCG type is `shadow` or `cubicBezier` (these cannot be
represented as Figma variables; move them to the manual list in A4).

**To update** — present in both, value differs.
Skip `shadow` and `cubicBezier` types (move to manual list).
Skip any token explicitly marked `syncCapability: "manual-protected"` in
`figma-map.json` (move to manual list).

**To delete** — in Figma but absent from `tokens.json`.
Never auto-delete. Always list these and ask the user to confirm individually
before proceeding.

Surface the three lists as a summary table and ask for confirmation before
making any changes.

### A3. Execute the plan

For each token in the **create** list:
- Call `create_variable` with the appropriate collection and type
- Call `set_variable_mode_value` to set the value in the default mode

For each token in the **update** list:
- Call `update_variable` if the variable already exists in the cache
- Call `set_variable_mode_value` to update the value in the default mode

For each confirmed **delete** (user must confirm each individually):
- Call `delete_variable`

Collect successes and failures. If a write tool is unavailable on the MCP
server, move the op to the manual follow-up list.

### A4. Handle manual items

For shadows, easings, and any tokens that couldn't be written via MCP,
render a checklist for the user to apply in Figma manually:

```
Manual follow-up needed in Figma:
[ ] shadow.sm → Effects panel: Drop Shadow, 0px 1px 2px 0px rgba(0,0,0,0.06)
[ ] shadow.md → Effects panel: Drop Shadow, 0px 4px 8px 0px rgba(0,0,0,0.10)
[ ] motion.easing.standard → Prototype panel: Custom easing 0.2, 0, 0, 1
```

Do not block Part B on these manual items.

### A5. Report

- N variables created
- N variables updated
- N variables skipped (manual-protected or non-variable types)
- N confirmations pending (deletes)
- Manual items listed

---

## Part B — Visual documentation pages in Figma

After variables are synced, create or update visual documentation frames.
Use the `use_figma` Plugin API skill (load `figma-use` skill before any
`use_figma` calls). Follow these patterns from reference design systems:
- **Boodschappen.nl**: Color grid, responsive grid overlays, typography at 3 breakpoints,
  form element states with labels
- **IBM Carbon**: Spacing block specification with proportional rectangles,
  semantic color table, typography hierarchy with specs
- **Porsche/Web Design System v3**: Fluid type tokens, shadow levels, breakpoint specs

**Check for an existing "Design System" page first.** If it exists, update frames
in place. If not, create a new page named "Design System".

### B1. Colors page

Create a frame titled "Colors" (or update the existing one).

**Color families section** — one group per hue family (`brand.primary`, `brand.secondary`,
`neutral`, etc.):
- Column header: family name in a label style
- Stack dark → light: for each step (50..900 or whatever the project uses):
  - Filled rectangle (60×40px) in the token color
  - Token name below: `color/brand/primary/500`
  - Hex value below: `#3b82f6`
- Arrange families in a horizontal row, 8px gap between swatches, 24px gap between families

**Semantic colors section** — table layout showing role → color mapping:
- Rows: bg.default, bg.card, bg.input, fg.default, fg.secondary, border.default,
  interactive.primary, interactive.hover, interactive.focus, interactive.disabled
- Each row: role name | color swatch (40×24px) | resolved hex value | alias path

**Status colors section** — 4-column grid (error, success, warning, info):
- Each column: label | bg swatch | fg swatch | border swatch

### B2. Typography page

Create a frame titled "Typography" (or update the existing one).

Layout: **3 columns** — Desktop | Tablet | Mobile.

For each column (breakpoint), show the full type scale:

**Headings section** (label "HEADINGS"):
- Display / H1 through H6: sample text "The quick brown fox jumps over the lazy dog"
- Each row: role name + specs below (e.g. `font.size.5xl / weight.light / lineHeight.tight`)

**Body text section** (label "BODY TEXT"):
- Body large through xs: sample text

**Call to action section** (label "CALL TO ACTION"):
- Action link, Nav main, Nav secondary, Tag button text

### B3. Spacing page

Create a frame titled "Spacing" (or update the existing one).

Follow the IBM Carbon spacing specification pattern:

**Specification table**:
```
Token     | rem    | px   | Example
space.1   | 0.25   | 4    | ▌ (4px wide)
space.4   | 1.0    | 16   | ▌▌▌▌
...
```
Rectangles should be proportional. Use brand primary at 20% opacity.

**Radius section** below:
- Rounded squares showing each radius value: radius.none → radius.full
- Token name + px value as label

### B4. Grid page

Create a frame titled "Grid" (or update the existing one).

For each breakpoint (`breakpoint.sm` through `breakpoint.2xl`), create a browser
chrome frame at that width showing the column grid overlay, column count,
gutter width, margin width as annotations.

### B5. Buttons page (best effort)

Create a frame titled "Buttons" if the project has `color.interactive.*` tokens.

**Variant × State matrix**:
- Rows: Default, Hover, Focused, Disabled, Destructive
- Columns: Primary, Secondary, Ghost/Outline, Danger

### B6. Form elements page (best effort)

Create a frame titled "Form Elements" if input-related tokens exist.

- 5 columns: Default | Hover | Focused | Disabled | Error
- Rows: input fields, checkboxes, radio buttons

### B7. Icons page

Create a placeholder frame titled "Icons" noting the icon library source.

---

## Fallback: MCP writes unavailable

If the Dev Mode MCP has no write tools, skip Part A steps A3–A4 and render a
single Markdown checklist for the user to apply manually in Figma:

```
Manual Figma variable updates:
[ ] color/brand/primary/500 (COLOR): #3b82f6
[ ] space/4 (FLOAT): 16
...
```

Do not claim a sync succeeded when it was manual-only.

If `use_figma` is unavailable for Part B, generate a Markdown spec for
each documentation page that the user (or designer) can follow in Figma.

---

## Constraints

- Never push when there are unresolved conflicts (same token changed in both
  tokens.json and Figma since the last known state).
- Always confirm `delete_variable` operations individually — they are destructive.
- **Shadow and cubicBezier tokens** always go to the manual list, never to operations.

## Output checklist

- [ ] Flat map built from `tokens.json`
- [ ] Current Figma state loaded via `get_variable_defs`
- [ ] Change summary surfaced and confirmed
- [ ] Every `create`/`update` entry either succeeded via MCP or moved to manual list
- [ ] Manual items surfaced as a checklist
- [ ] Colors documentation page created/updated in Figma
- [ ] Typography documentation page created/updated in Figma
- [ ] Spacing documentation page created/updated in Figma
- [ ] Grid documentation page created/updated in Figma
- [ ] Buttons page created/updated (or skipped with note)
- [ ] Form elements page created/updated (or skipped with note)
- [ ] Icons page created/updated (or placeholder added)
- [ ] Summary delivered: N created, N updated, N manual, N Figma pages updated

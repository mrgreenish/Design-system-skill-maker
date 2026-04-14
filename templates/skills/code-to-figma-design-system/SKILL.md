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

## Part A — Variable sync (tokens into Figma)

### A1. Refresh the Figma cache

Call `get_variable_defs` for the file's variable collections (ids are in
`figma-map.json`). Write the result to `.figma-cache/variables.json`.

### A2. Dry-run the sync

```
npm run ds:sync:dry -- --direction=code-to-figma
```

If conflicts > 0, stop. Run the full sync to generate `sync-conflict.md`,
surface it to the user. Do not proceed until resolved.

### A3. Build the plan

```
tsx scripts/ds/sync.ts --direction=code-to-figma
```

This writes `.sync-plan.json` with:
- `operations` — variable upserts/deletes (executable via MCP)
- `manual` — shadow/cubicBezier types that Figma variables can't represent

### A4. Execute the plan

For each entry in `operations`:
- `upsert-variable`: call `update_variable` if it exists in the cache,
  else `create_variable`. Then call `set_variable_mode_value` to set the value.
- `delete-variable`: call `delete_variable` only after user confirms (always
  confirm deletions — they are destructive).

Collect successes and failures. If a tool isn't available on the MCP server,
move the op to the manual follow-up list.

### A5. Handle manual items

For shadows and easings (not backed by Figma variables), render a checklist:

```
Manual follow-up needed in Figma:
[ ] shadow.sm → Effects panel: Drop Shadow, 0px 1px 2px 0px rgba(0,0,0,0.06)
[ ] shadow.md → Effects panel: Drop Shadow, 0px 4px 8px 0px rgba(0,0,0,0.10)
[ ] motion.easing.standard → Prototype panel: Custom easing 0.2, 0, 0, 1
```

Do not block Part B on these manual items.

### A6. Commit the lock

```
tsx scripts/ds/sync.ts --commit-lock
```

### A7. Clean up

Delete `.sync-plan.json`. Keep `.figma-cache/variables.json`.

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

```javascript
// Pseudocode for use_figma call
figma.createFrame({
  name: "Colors",
  width: 1440,
  // ... populate with above layout using tokens from tokens.json
})
```

### B2. Typography page

Create a frame titled "Typography" (or update the existing one).

Layout: **3 columns** — Desktop | Tablet | Mobile — like the Boodschappen typography documentation.

For each column (breakpoint), show the full type scale:

**Headings section** (label "HEADINGS"):
- Display / H1 through H6: sample text "The quick brown fox jumps over the lazy dog"
- Each row: role name + specs below (e.g. `font.size.5xl / weight.light / lineHeight.tight`)

**Titles section** (label "TITLES"):
- Subtitle, Card title: sample text

**Body text section** (label "BODY TEXT"):
- Body large through xs: sample text

**Call to action section** (label "CALL TO ACTION"):
- Action link, Nav main, Nav secondary, Tag button text, Body link

**Text fields section** (label "TEXT FIELD"):
- Text field label, helper text

At different breakpoints the font sizes change (use `breakpoint.*` tokens to calculate).
If only one size is defined per stop, use it for all breakpoints.

### B3. Spacing page

Create a frame titled "Spacing" (or update the existing one).

Follow the IBM Carbon spacing specification pattern:
- Two panels side by side: "Specification" table + "Utility" visual

**Specification table**:
```
Token          | rem    | px   | Example (rectangle)
space.1        | 0.25   | 4    | ▌ (4px wide)
space.2        | 0.5    | 8    | ▌▌ (8px wide)
space.4        | 1.0    | 16   | ▌▌▌▌ (16px wide)
...
```
Rectangles should be proportional — scale from 4px to the largest space value.
Use the brand primary color (at 20% opacity) + a filled version for alternating rows.

**Radius section** below:
- Rounded squares showing each radius value: radius.none → radius.full
- Token name + px value as label

### B4. Grid page

Create a frame titled "Grid" (or update the existing one).

For each breakpoint (`breakpoint.sm` through `breakpoint.2xl`), create a browser
chrome frame at that width showing:
- The column grid overlay (use `color.brand.primary` at 10% opacity for column fills,
  and the gutter/margin as empty space)
- Column count, gutter width, and margin width as annotations
- Frame label: "Desktop", "Tablet", "Mobile"
- Include a simple content placeholder (2–3 grey boxes) to show how content flows

Show columns in a pink/purple tint (like the Boodschappen reference) so they stand out.

### B5. Buttons page (best effort)

Create a frame titled "Buttons" if the project has button-related tokens
(`color.interactive.*` or explicit `color.button.*` tokens).

**Variant × State matrix** (like the Boodschappen button documentation):
- Rows: Default, Hover (simulated), Focused, Disabled, Destructive
- Columns: Primary, Secondary, Ghost/Outline, Danger, (Icon-only if applicable)
- Each cell: the button at that variant/state
- Left of each row: state label
- Above each column: variant label (teal/green accent like Boodschappen)

Button specs come from:
- Background: `color.interactive.{primary,hover,active,disabled}`
- Text size: `font.size.md` or `font.size.sm`
- Radius: `radius.md` or `radius.full` depending on the project
- Height: typically `space.10` (40px) or `space.12` (48px)
- Padding: `space.4` horizontal

If button tokens don't exist yet, create a simplified 2-variant (primary/secondary)
× 4-state (default/hover/focused/disabled) matrix using the interactive colors.

### B6. Form elements page (best effort)

Create a frame titled "Form Elements" if the project has input-related tokens.

Following the Boodschappen form elements documentation pattern:

**Input fields section**:
- 5 columns: Default | Hover | Focused | Disabled | Error
- 2 rows: Empty | Filled
- Each cell: the input field at that state, with label above and error text below (error state)

**Checkboxes section**:
- Same 5 states × 2 rows (unselected / selected)

**Radio buttons section**:
- Same 5 states × 2 rows (unselected / selected)

If select/dropdown tokens exist, add a **Select section** in the same pattern.

### B7. Icons page

Create a frame titled "Icons" (simplified — just a reference placeholder).

- Title: "Icons"
- Note the icon library source (if known from the project, e.g. "Google Material Icons — https://fonts.google.com/icons" or "Heroicons")
- Group any icons found in the Figma file into categories matching the Boodschappen pattern:
  - Basis (basic UI icons)
  - Richtingen (directional/arrow icons)
  - Domain-specific categories

If no icons are in the Figma file, show a placeholder frame with the external icon source URL.

---

## Fallback: MCP writes unavailable

If the Dev Mode MCP has no write tools, skip Part A step A4 and render a
single Markdown checklist for the user to apply manually in Figma:

```
Manual Figma variable updates:
[ ] color/brand/primary/500 (COLOR): #3b82f6
[ ] color/brand/primary/600 (COLOR): #2563eb
[ ] space/4 (FLOAT): 16
...
```

Do not claim a sync succeeded when it was manual-only. Skip `--commit-lock`.

If `use_figma` is unavailable for Part B, generate a Markdown spec for
each documentation page that the user (or designer) can follow in Figma.

---

## Fallbacks & constraints

- Never push when `npm run ds:sync:dry` shows conflicts.
- Always confirm `delete-variable` operations individually.
- **Manual-protected tokens** (`shadow`, `cubicBezier`, anything marked
  `syncCapability: "manual-protected"` in `figma-map.json`) appear under
  `manual`, never `operations`.
- **Alias tokens** are never overwritten by a figma-to-code apply.

## Output checklist

- [ ] `.figma-cache/variables.json` refreshed this run
- [ ] `npm run ds:sync:dry` showed `0 conflicts`
- [ ] Every `operations` entry either succeeded via MCP or moved to manual list
- [ ] Manual items surfaced to the user as a checklist
- [ ] `tokens.lock.json` committed (only if no manual-only ops remain)
- [ ] Colors documentation page created/updated in Figma
- [ ] Typography documentation page created/updated in Figma
- [ ] Spacing documentation page created/updated in Figma
- [ ] Grid documentation page created/updated in Figma
- [ ] Buttons page created/updated (or skipped with note)
- [ ] Form elements page created/updated (or skipped with note)
- [ ] Icons page created/updated (or placeholder added)
- [ ] Summary delivered: N upserted, N deleted, N manual, N Figma pages updated

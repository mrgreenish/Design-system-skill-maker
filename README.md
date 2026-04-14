# Design System Skill Maker

A project-local toolkit of **Claude Code / Cursor skills** and **hooks** that keeps a
design system synchronized between **Figma** and **code (Tailwind)**, using a
W3C DTCG [`tokens.json`](./tokens.json) manifest as the neutral source of truth.

Scope: **tokens + visual documentation** — colors, typography, spacing, radii,
letter-spacing, border widths, opacity, shadows, motion, breakpoints, z-index.
Components are intentionally out of scope for the sync engine (but visual
documentation pages for buttons/forms are created as best-effort Figma frames).

## Architecture

```
Figma file  ◄──►  Figma Dev Mode MCP  ◄──►  Claude skills  ◄──►  tokens.json (DTCG, SoT)
                                                │
                                                ├── Tailwind theme (generated)
                                                ├── CSS variables (generated)
                                                ├── Storybook token docs (generated)
                                                └── DESIGN.md (auto-generated on setup)
```

Both Figma and code are **projections** of `tokens.json`. A three-way diff
against `tokens.lock.json` (per-token hashes from the last successful sync)
detects one-sided changes and flags genuine conflicts.

## Round-trip contract

For tokens backed by native Figma variables (colors, dimensions, font
families, numbers), the sync is fully round-trippable **when `figma-map.json`
is present**. The map supplies the DTCG type override and unit hint that
prevent lossy `FLOAT → dimension` conversions.

Without `figma-map.json` the sync falls back to heuristics, which are
accurate for simple color/dimension tokens but lossy for numeric types.

**Manual-protected tokens** (`shadow`, `cubicBezier`, any token marked
`syncCapability: "manual-protected"` in `figma-map.json`) are never
auto-deleted from `tokens.json`. Changes are surfaced as a manual checklist
for the user to apply via Figma's Effects / Easing UI.

**Alias tokens** (DTCG values like `{color.neutral.0}`) are not de-aliased
by a figma-to-code sync — if the Figma side diverges from the alias's
resolved value the user is warned to update the alias target (the primitive)
instead.

## Skills (invoked by Claude Code / Cursor)

| Skill | Location | Purpose |
|---|---|---|
| `setup-design-system` (meta) | `.claude/skills/setup-design-system/` | Inspects a Figma file via MCP, scaffolds both operational skills, seeds `tokens.json`, copies the sync engine, and auto-generates `DESIGN.md`. |
| `figma-to-code-design-system` | copied to target project | Pulls Figma variables, text styles, and effect styles into `tokens.json`; regenerates Tailwind + CSS; updates `DESIGN.md` sections 2–6; scaffolds Storybook token galleries. |
| `code-to-figma-design-system` | copied to target project | Pushes `tokens.json` changes to Figma variables, then creates/updates visual documentation pages (colors, typography, spacing, grid, buttons, forms, icons). |

Shared reference docs live in `.claude/skills/_shared/` (and `templates/skills/_shared/`).

## Hooks

Configured in `.claude/settings.json` and implemented in `.claude/hooks/`:

- **`PostToolUse`** (Edit/Write/MultiEdit): if `tokens.json` changed, prints a
  dry-run sync summary so Claude knows whether a Figma push is pending.
- **`SessionStart`**: one-liner "in sync / N tokens drifted" status.
- **`Stop`**: reminder to run `code-to-figma-design-system` if `tokens.json`
  changed but the lock wasn't updated.

## Token coverage

Tokens are organized following `_shared/token-conventions.md`:

| Group | Examples | Tailwind slot |
|---|---|---|
| `color.*` | brand, neutral, semantic, interactive, status | `colors` |
| `space.*` | 0–128px scale | `spacing` |
| `radius.*` | none, sm, md, lg, xl, full | `borderRadius` |
| `font.family.*` | sans, serif, mono | `fontFamily` |
| `font.size.*` | xs–5xl | `fontSize` |
| `font.weight.*` | light–bold | `fontWeight` |
| `font.lineHeight.*` | tight–loose | `lineHeight` |
| `letterSpacing.*` | tighter–widest | `letterSpacing` |
| `borderWidth.*` | default, thick | `borderWidth` |
| `opacity.*` | disabled, hover | `opacity` |
| `shadow.*` | xs–xl, inner | `boxShadow` |
| `motion.duration.*` | fast, normal, slow | `transitionDuration` |
| `motion.easing.*` | standard, decelerate, accelerate | `transitionTimingFunction` |
| `breakpoint.*` | sm–2xl | `screens` (raw values) |
| `zIndex.*` | dropdown, sticky, modal, tooltip | `zIndex` |

## DESIGN.md

Every project set up with `setup-design-system` gets an auto-generated
`DESIGN.md` following the 9-section format from `example-skills/`:

1. Visual Theme & Atmosphere
2. Color Palette & Roles
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide

Sections 2–6 are regenerated whenever `figma-to-code-design-system` runs.
Sections 1, 7, 8, 9 are filled on first setup and preserved on subsequent syncs.

## Figma documentation pages

`code-to-figma-design-system` creates/updates these frames in a "Design System"
page in Figma after each variable push:

| Page | Pattern inspired by |
|---|---|
| Colors | Boodschappen.nl — color grid with hex labels, semantic roles table |
| Typography | Boodschappen.nl — 3-column (desktop/tablet/mobile) type scale |
| Spacing | IBM Carbon — proportional rectangle spec + utility visual |
| Grid | Boodschappen.nl — responsive grid overlays at each breakpoint |
| Buttons | Boodschappen.nl — variant × state matrix |
| Form elements | Boodschappen.nl — input/checkbox/radio with 5 states |
| Icons | Icon library reference placeholder |

## Scripts (plain Node, callable from CLI or skills)

| Script | CLI | Purpose |
|---|---|---|
| `scripts/tokens-to-tailwind.ts` | `npm run ds:build` | DTCG → Tailwind + CSS vars (all 15 token groups) |
| `scripts/sync.ts` | `npm run ds:sync` | Three-way diff, plan emitter, optional lock commit |
| | `npm run ds:sync:dry` | Same, read-only (prints summary to stdout) |
| `scripts/figma-read.ts` | (module) | Parses `.figma-cache/variables.json` written by Claude via MCP |
| `scripts/figma-write.ts` | (module) | Builds `.sync-plan.json` of MCP ops from a diff |
| `scripts/figma-map.ts` | (module) | Loads `figma-map.json`; type overrides, unit hints, protected-token detection |
| `scripts/diff-tokens.ts` | (module) | Pure three-way diff — unit-tested |
| `scripts/tokens.ts` | (module) | DTCG flatten / alias resolve / hash |

Tests: `npm test` (vitest, all 65 tests).

## Usage

### First-time setup on a project with an existing Figma file

1. `npm install`
2. Open the Figma file in Figma desktop with Dev Mode MCP enabled.
3. In Claude Code / Cursor, invoke the **`setup-design-system`** meta-skill.
   It reads Figma variables + text/effect styles, confirms the DTCG mapping
   with you, seeds `tokens.json`, builds Tailwind + CSS, and generates
   `DESIGN.md`.
4. `npm run storybook` — sanity-check the token galleries.

### Ongoing: Figma → code

1. Ask Claude/Cursor to run `figma-to-code-design-system`.
2. It refreshes Figma variables, text styles, and effect styles, updates
   `tokens.json`, regenerates Tailwind + CSS, updates `DESIGN.md` sections
   2–6, and rebuilds Storybook stories.
3. `tsx scripts/sync.ts --commit-lock` to record the new baseline.

### Ongoing: code → Figma

1. Edit `tokens.json` (or let Claude do it).
2. The `PostToolUse` hook fires and tells Claude there's a Figma push pending.
3. Invoke `code-to-figma-design-system`. It pushes variables, updates visual
   documentation pages in Figma, and commits the lock.

### Conflicts

If both sides changed the same token, `npm run ds:sync:dry` exits with code
`2`. A full run writes `sync-conflict.md`. Resolve by editing `tokens.json`
to the intended final value, then re-run the sync.

## Repo layout

```
.
├── tokens.json                 # SoT (W3C DTCG)
├── tokens.lock.json            # Per-token hashes from last successful sync (v2)
├── tailwind.config.ts          # Hand-authored outside BEGIN/END GENERATED
├── src/styles/tokens.css       # Fully generated
├── example-skills/             # Reference design system documents (Claude, IBM)
│   ├── DESIGN-claude.md
│   └── DESIGN-ibm.md
├── templates/
│   ├── DESIGN-TEMPLATE.md      # 9-section skeleton copied to target projects
│   ├── skills/
│   │   ├── figma-to-code-design-system/SKILL.md
│   │   ├── code-to-figma-design-system/SKILL.md
│   │   └── _shared/
│   │       ├── dtcg-reference.md
│   │       └── token-conventions.md
│   ├── hooks/                  # post-edit, session-start, stop
│   └── package-fragment.json
├── .storybook/                 # Config + MDX token stories
├── scripts/                    # Node scripts + vitest tests
└── .claude/
    ├── settings.json           # Hook wiring
    ├── hooks/                  # post-edit, session-start, stop
    └── skills/
        ├── setup-design-system/
        └── _shared/
```

## Assumptions

- Figma Dev Mode MCP exposes `get_variable_defs` (read) and at least
  `create_variable` / `update_variable` (write). If your server lacks writes,
  `code-to-figma-design-system` degrades to a manual checklist rather than failing.
- Node ≥ 20, TypeScript ≥ 5.6, Tailwind 3 (compatible with 4 with minor tweaks).
- Storybook deps are installed on first use of `figma-to-code-design-system`,
  not on baseline `npm install` — keeps token-only workflows lean.
- `figma-map.json` is required for full round-trip fidelity. Without it, the
  sync falls back to type heuristics.
- `breakpoint.*` tokens are emitted as raw CSS values in `theme.screens`
  (not `var()` references) so Tailwind can process them at build time.

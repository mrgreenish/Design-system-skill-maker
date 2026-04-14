# Design System Skill Maker

A meta-toolkit that **installs a bi-directional Figma ↔ code design system**
into any project by scaffolding skills, scripts, and hooks from a single
setup command.

## What it creates

Running the `setup-design-system` skill on a target project produces:

```
<target-project>/
├── scripts/ds/              ← sync engine (copied from this repo)
├── tokens.json              ← W3C DTCG tokens, seeded from Figma
├── tokens.lock.json         ← per-token hashes from last sync
├── figma-map.json           ← Figma file key, collection IDs, type overrides
├── .figma-cache/
│   └── variables.json       ← cached Figma variable snapshot
├── src/styles/tokens.css    ← generated CSS vars
├── tailwind.config.ts       ← spliced with generated theme block
└── <skills-folder>/
    ├── figma-to-code-design-system/SKILL.md
    ├── code-to-figma-design-system/SKILL.md
    └── _shared/
        ├── dtcg-reference.md
        └── token-conventions.md
```

The two installed skills handle ongoing work in the target project:

| Skill | Direction | When to use |
|---|---|---|
| `figma-to-code-design-system` | Figma → code | After Figma tokens change; regenerates Tailwind + CSS |
| `code-to-figma-design-system` | code → Figma | After `tokens.json` changes; pushes to Figma via MCP |

## Architecture

```
Figma file  ◄──►  Figma Dev Mode MCP  ◄──►  scripts/ds/sync.ts
                                                │
                                     ┌──────────┴──────────┐
                               tokens.json (DTCG SoT)   figma-map.json
                                     │
                          ┌──────────┴──────────┐
                    tailwind.config.ts    src/styles/tokens.css
```

`tokens.json` is the canonical source of truth. A three-way diff against
`tokens.lock.json` (per-token hashes from the last successful sync) detects
one-sided changes and flags genuine conflicts.

## Repo layout

```
.
├── scripts/                         ← sync engine (canonical source)
│   ├── sync.ts                      ← orchestrator (three-way diff + plan emitter)
│   ├── tokens.ts                    ← DTCG flatten / alias resolve / hash
│   ├── diff-tokens.ts               ← pure three-way diff
│   ├── sync-direction.ts            ← maps --direction to diff statuses
│   ├── figma-read.ts                ← reads .figma-cache/variables.json
│   ├── figma-write.ts               ← builds .sync-plan.json of MCP ops
│   ├── figma-map.ts                 ← loads figma-map.json
│   ├── tokens-to-tailwind.ts        ← DTCG → Tailwind + CSS vars
│   └── __tests__/                   ← vitest unit tests
│
├── templates/                       ← scaffolded into target projects
│   ├── skills/
│   │   ├── figma-to-code-design-system/SKILL.md
│   │   ├── code-to-figma-design-system/SKILL.md
│   │   └── _shared/
│   ├── hooks/
│   │   ├── post-edit.mjs
│   │   ├── session-start.mjs
│   │   └── stop.mjs
│   └── package-fragment.json        ← deps + npm scripts to merge
│
└── .claude/
    └── skills/
        └── setup-design-system/     ← the one skill in this repo
            └── SKILL.md
```

## Skills in this repo

| Skill | Purpose |
|---|---|
| `setup-design-system` | Inspects a Figma file via Dev Mode MCP, scaffolds the full design system (scripts, skills, hooks, tokens) into a target project. |

## Usage

### First-time setup on a project with an existing Figma file

1. Open the Figma file in Figma desktop with Dev Mode MCP enabled.
2. In Claude Code (or Cursor), invoke the **`setup-design-system`** skill
   from this repo.
3. Answer the prompts: Figma URL, target project path, skills folder
   location, token grouping.
4. The skill copies everything and seeds `tokens.json`. You're done.

From that point, all ongoing work happens in the **target project** using its
own installed skills — this repo is no longer needed day-to-day.

### Ongoing: Figma → code (in the target project)

1. Ask Claude to refresh the Figma cache (via the MCP tool `get_variable_defs`)
   and write to `.figma-cache/variables.json`.
2. Invoke the **`figma-to-code-design-system`** skill.

### Ongoing: code → Figma (in the target project)

1. Edit `tokens.json` (or let Claude do it).
2. The `PostToolUse` hook fires and tells Claude there's a Figma push pending.
3. Invoke the **`code-to-figma-design-system`** skill.

### Conflicts

If both sides changed the same token, `npm run ds:sync:dry` exits with code
`2` and prints the conflict count. A full (non-dry) run writes
`sync-conflict.md`. Resolve by editing `tokens.json` to the intended final
value, then re-run the sync.

## Round-trip contract

For tokens backed by native Figma variables (colors, dimensions, font
families, numbers), the sync is fully round-trippable **when `figma-map.json`
is present**. Without it the sync falls back to heuristics, which are
accurate for simple color/dimension tokens but lossy for numeric types.

**Manual-protected tokens** (`shadow`, `cubicBezier`) are never auto-deleted
from `tokens.json` even if absent from Figma. Value changes are surfaced as
manual checklist items for the user to apply via Figma's Effects / Easing UI.

**Alias tokens** (DTCG values like `{color.neutral.0}`) are never de-aliased
by a figma-to-code sync — if the Figma side diverges, the user is warned to
update the alias target (the primitive) instead.

## Development (working on this repo itself)

```sh
npm install
npm test            # vitest unit tests for the sync engine
npm run typecheck   # TypeScript check
npm run ds:build    # test the Tailwind generator against tokens.json
npm run ds:sync:dry # test the three-way diff
```

Tests: `npm test` (vitest, covers diff + flatten + transform + figma-map + figma-read).

## Assumptions

- Figma Dev Mode MCP exposes `get_variable_defs` (read) and at least
  `create_variable` / `update_variable` (write). If your server lacks writes,
  `code-to-figma-design-system` degrades to a manual checklist rather than failing.
- Node ≥ 20, TypeScript ≥ 5.6, Tailwind 3 (works with 4 with minor tweaks to
  the generated block).
- Storybook deps are installed on first use of `figma-to-code-design-system`,
  not on baseline `npm install` — keeps token-only workflows lean.
- `figma-map.json` is required for full round-trip fidelity.

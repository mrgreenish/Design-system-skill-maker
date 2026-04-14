# Design System Skill Maker

A project-local toolkit of **Claude Code skills** and **hooks** that keeps a
design system synchronized between **Figma** and **code (Tailwind)**, using a
W3C DTCG [`tokens.json`](./tokens.json) manifest as the neutral source of
truth.

Scope (v1): **tokens only** — colors, typography, spacing, radii, shadows,
motion. Components/patterns are intentionally out of scope.

## Architecture

```
Figma file  ◄──►  Figma Dev Mode MCP  ◄──►  Claude skills  ◄──►  tokens.json (DTCG, SoT)
                                                │
                                                ├── Tailwind theme (generated)
                                                ├── CSS variables (generated)
                                                └── Storybook docs (consumes generated CSS)
```

Both Figma and code are **projections** of `tokens.json`. A three-way diff
against `tokens.lock.json` (per-token hashes from the last successful sync)
detects one-sided changes and flags genuine conflicts.

## Skills (invoked by Claude Code)

| Skill | Location | Purpose |
|---|---|---|
| `create-figma-ds-skill` (meta) | `.claude/skills/create-figma-ds-skill/` | Inspects an existing Figma file via Dev Mode MCP and scaffolds a project-specific `build-ds-figma` skill + `figma-map.json`. |
| `build-ds-code`         | `.claude/skills/build-ds-code/`         | Regenerates `tailwind.config.ts` (BEGIN/END GENERATED block), `src/styles/tokens.css`, and Storybook token stories from `tokens.json`. |
| `sync-code-to-figma`    | `.claude/skills/sync-code-to-figma/`    | Pushes code-side token changes into Figma via Dev Mode MCP writes. |

Shared reference docs live in `.claude/skills/_shared/`.

## Hooks

Configured in `.claude/settings.json` and implemented in `.claude/hooks/`:

- **`PostToolUse`** (Edit/Write/MultiEdit): if `tokens.json` changed, prints a
  dry-run sync summary so Claude knows whether a Figma push is pending. If
  `tailwind.config.ts` was hand-edited, warns that the generated block is
  overwritten by `ds:build`.
- **`SessionStart`**: one-liner "in sync / N tokens drifted" status.
- **`Stop`**: reminder to run `sync-code-to-figma` if `tokens.json` changed
  but the lock wasn't updated.

## Scripts (plain Node, callable from CLI or skills)

| Script | CLI | Purpose |
|---|---|---|
| `scripts/tokens-to-tailwind.ts` | `npm run ds:build`     | DTCG → Tailwind + CSS vars |
| `scripts/sync.ts`               | `npm run ds:sync`      | Three-way diff, plan emitter, optional lock commit |
|                                 | `npm run ds:sync:dry`  | Same, read-only |
| `scripts/figma-read.ts`         | (module)               | Parses `.figma-cache/variables.json` written by Claude via MCP |
| `scripts/figma-write.ts`        | (module)               | Builds `.sync-plan.json` of MCP ops from a diff |
| `scripts/diff-tokens.ts`        | (module)               | Pure three-way diff — unit-tested |
| `scripts/tokens.ts`             | (module)               | DTCG flatten / alias resolve / hash |

Tests: `npm test` (vitest, 19 tests covering diff + flatten + transform).

## Usage

### First-time setup on a project with an existing Figma file

1. `npm install`
2. Open the Figma file in Figma desktop with Dev Mode MCP enabled.
3. In Claude Code, invoke the **`create-figma-ds-skill`** meta-skill. It will
   read variables via MCP, confirm a name mapping with you, seed
   `tokens.json`, and scaffold a project-specific `build-ds-figma` skill.
4. Run **`build-ds-code`** to generate Tailwind + CSS + Storybook stories.
5. `npm run storybook` — sanity-check the token galleries.

### Ongoing: Figma → code

1. Ask Claude to refresh the Figma cache (via the MCP tool `get_variable_defs`)
   and write to `.figma-cache/variables.json`.
2. `npm run ds:sync -- --direction=figma-to-code` — updates `tokens.json`
   from Figma.
3. Run the **`build-ds-code`** skill.
4. `tsx scripts/sync.ts --commit-lock` to record the new baseline.

### Ongoing: code → Figma

1. Edit `tokens.json` (or let Claude do it).
2. The `PostToolUse` hook fires and tells Claude there's a Figma push pending.
3. Invoke the **`sync-code-to-figma`** skill. It refreshes the cache, runs
   `sync.ts` to build `.sync-plan.json`, executes each op via Dev Mode MCP
   writes, and commits the lock.

### Conflicts

If both sides changed the same token, `npm run ds:sync:dry` exits with code
`2` and writes `sync-conflict.md`. Resolve by editing `tokens.json` to the
intended final value, then re-run the sync.

## Repo layout

```
.
├── tokens.json                 # SoT (W3C DTCG)
├── tokens.lock.json            # Per-token hashes from last successful sync
├── tailwind.config.ts          # Hand-authored outside BEGIN/END GENERATED
├── src/styles/tokens.css       # Fully generated
├── .storybook/                 # Config + MDX token stories
├── scripts/                    # Node scripts + vitest tests
└── .claude/
    ├── settings.json           # Hook wiring
    ├── hooks/                  # post-edit, session-start, stop
    └── skills/
        ├── create-figma-ds-skill/
        ├── build-ds-code/
        ├── sync-code-to-figma/
        └── _shared/
```

## Assumptions

- Figma Dev Mode MCP exposes `get_variable_defs` (read) and at least
  `create_variable` / `update_variable` (write). If your server lacks writes,
  `sync-code-to-figma` degrades to a manual checklist rather than failing.
- Node ≥ 20, TypeScript ≥ 5.6, Tailwind 3 (works with 4 with minor tweaks to
  the generated block).
- Storybook deps are installed on first use of `build-ds-code`, not on
  baseline `npm install` — keeps token-only workflows lean.

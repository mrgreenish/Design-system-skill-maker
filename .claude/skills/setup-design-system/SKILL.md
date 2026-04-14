---
name: setup-design-system
description: Meta-skill. Sets up a bi-directional Figma ↔ code design system in a target project. Inspects an existing Figma file via Dev Mode MCP, scaffolds two skills (figma-to-code-design-system and code-to-figma-design-system), copies the sync engine scripts, wires hooks, and seeds tokens.json. Use when starting a new project or when the Figma file's structure has changed meaningfully.
---

# setup-design-system

## What this skill does

It turns **any project** into a fully wired Figma ↔ code design system by:

1. Reading the Figma file's variable structure via MCP
2. Asking you to confirm the DTCG token mapping
3. Copying the sync engine (`scripts/ds/`) and hooks into the target project
4. Merging the required npm scripts and deps into `package.json`
5. Writing two operational skills into the project's skills folder:
   - **`figma-to-code-design-system`** — pull Figma tokens into code
   - **`code-to-figma-design-system`** — push code tokens back to Figma
6. Seeding `tokens.json` from the current Figma state
7. Running the initial code build

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
   > "I'll organize tokens into primitives (color.brand, color.neutral,
   > space, radius, font, shadow, motion) and semantic
   > (color.semantic.bg/fg/accent). OK to proceed, or do you want a
   > different split?"

## Steps

### 1. Read Figma state via MCP

- Call `get_variable_defs` to list all variable collections, modes, and
  variables.
- Fall back to `get_code` on a representative frame only if variables don't
  cover enough. Prefer variables — they round-trip cleanly to DTCG.

### 2. Propose a name → DTCG-path mapping

For each Figma variable, derive a DTCG path following
`templates/skills/_shared/token-conventions.md`. Show the mapping as a table
and ask the user to confirm or edit before writing any files.

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

### 9. Run the initial code build

```
npm run ds:build
```

This writes `src/styles/tokens.css` and splices the generated block into
`tailwind.config.ts` (creating it with a minimal scaffold if absent).

### 10. Verify

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
- [ ] `tokens.json` seeded from Figma
- [ ] `npm run ds:build` succeeds
- [ ] `npm run ds:sync:dry` reports `0 conflicts`
- [ ] Summary delivered to user: N tokens seeded, files written, next steps

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

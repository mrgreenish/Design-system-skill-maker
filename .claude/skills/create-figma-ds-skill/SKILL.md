---
name: create-figma-ds-skill
description: Meta-skill. Inspects an existing Figma file via the Dev Mode MCP, then scaffolds a project-specific `build-ds-figma` skill (plus a `figma-map.json`) tailored to that file's variable collections, page structure, and naming. Use when starting a new project or when the Figma file's structure has changed meaningfully.
---

# create-figma-ds-skill

## When to use

- A user says something like "set up a design system from this Figma file"
  or "create a skill for this Figma file."
- The Figma file's variable-collection or page structure has been reorganized
  and the existing `build-ds-figma` skill is out of date.

If the user just wants to pull token values from Figma into code, don't run
this skill — use `sync-code-to-figma` or edit `tokens.json` directly.

## Prerequisites

- Figma Dev Mode MCP server connected (`get_variable_defs`, `get_code`,
  image tools reachable).
- User has either a Figma URL open OR a frame selected in Figma desktop.

## Inputs you need

1. **Figma file URL or file key.** If the user opens Figma desktop and has a
   selection, `get_variable_defs` may work without a URL. Otherwise ask:
   > "Paste the Figma file URL (or the file key — the alphanumeric segment after `/file/`)."
2. **Token grouping intent.** Ask the user to confirm:
   > "I'll organize tokens into primitives (color.brand, color.neutral, space, radius, font, shadow, motion) and semantic (color.semantic.bg/fg/accent). OK to proceed, or do you want a different split?"

## Steps

1. **Read Figma state via MCP.**
   - Call `get_variable_defs` to list all variable collections, modes, and variables.
   - Call `get_code` on a representative frame only if variables don't cover
     enough (fallback). We prefer variables over styles because variables
     round-trip cleanly to DTCG.

2. **Propose a name → DTCG-path mapping.** For each Figma variable, derive a
   DTCG path following `_shared/token-conventions.md`. Show the mapping as a
   table and ask the user to confirm or edit before writing files.

3. **Write artifacts.**
   - `.figma-cache/variables.json` — raw cache (see schema in `scripts/figma-read.ts`).
   - `figma-map.json` at repo root — the name↔path map plus `fileKey`, `collectionIds`, `modeIds`.
   - `.claude/skills/build-ds-figma/SKILL.md` — a project-specific runtime
     skill using the template below. Bake in the `fileKey`, collection names,
     and naming conventions you discovered so the runtime skill doesn't
     re-discover them.

4. **Seed `tokens.json`.** Run `scripts/sync.ts --direction=figma-to-code`
   (which reads `.figma-cache/variables.json`) so the first token set in
   `tokens.json` reflects Figma. Then run `npm run ds:build` to generate
   Tailwind + CSS.

5. **Verify.** `npm run ds:sync:dry` should report `0 conflicts` and
   `0 one-sided` after the initial seed.

## Template — `build-ds-figma/SKILL.md`

Write the generated skill with this frontmatter pattern:

```markdown
---
name: build-ds-figma
description: Project-specific runtime skill. Given changes in tokens.json, applies them to the Figma file "<FIGMA_FILE_NAME>" (key: <FIGMA_FILE_KEY>) via Dev Mode MCP. Use when the user wants to push code-side token changes into Figma.
---

# build-ds-figma (generated)

File key: `<FIGMA_FILE_KEY>`
Variable collection(s): `<COLLECTION_NAMES>`
Modes: `<MODE_NAMES>`

## Invocation

Delegate to the generic `sync-code-to-figma` skill with this file key
pre-filled. Do NOT re-run `create-figma-ds-skill` unless the Figma file's
structure has changed.
```

Keep the generated skill short — heavy logic lives in `scripts/sync.ts` and
in `sync-code-to-figma/SKILL.md`.

## Output checklist

- [ ] `.figma-cache/variables.json` exists and parses
- [ ] `figma-map.json` exists with `fileKey`
- [ ] `.claude/skills/build-ds-figma/SKILL.md` exists
- [ ] `tokens.json` seeded from Figma
- [ ] `npm run ds:build` succeeds
- [ ] `npm run ds:sync:dry` reports `0 conflicts`

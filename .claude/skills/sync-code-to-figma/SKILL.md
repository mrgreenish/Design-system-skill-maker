---
name: sync-code-to-figma
description: Pushes design token changes from the code side (tokens.json) into Figma via the Dev Mode MCP. Reads current Figma state through MCP, diffs against tokens.lock.json, then executes variable upserts/deletes. Use when the user edits tokens.json (or Tailwind-driven code) and wants Figma to reflect those changes.
---

# sync-code-to-figma

## When to use

- User says "push tokens to Figma", "update Figma", "sync design system to
  Figma."
- The `PostToolUse` hook on `tokens.json` fires and you want to offer the
  push.

Do NOT use this skill to pull Figma changes into code — run
`scripts/sync.ts --direction=figma-to-code` instead (after refreshing the
MCP cache, as step 1 below).

## Prerequisites

- Figma Dev Mode MCP connected, with the file open in Figma desktop.
- `figma-map.json` present (produced by `create-figma-ds-skill`). If it's
  missing, stop and tell the user to run `create-figma-ds-skill` first.

## Steps

1. **Refresh the Figma cache.** Call the Dev Mode MCP tool `get_variable_defs`
   for the file's variable collections (ids are in `figma-map.json`). Write
   the result to `.figma-cache/variables.json` in the schema documented in
   `scripts/figma-read.ts` (the `variables[]` array form is preferred).

2. **Dry-run the sync.** Run:
   ```
   npm run ds:sync:dry -- --direction=code-to-figma
   ```
   Read the summary. If conflicts > 0, stop and surface `sync-conflict.md`
   to the user — do not attempt writes.

3. **Build the plan.** Run:
   ```
   tsx scripts/sync.ts --direction=code-to-figma
   ```
   This writes `.sync-plan.json` with two arrays: `operations` (doable via
   MCP) and `manual` (types like `shadow` / `cubicBezier` that Figma
   variables can't express natively).

4. **Execute the plan.** For each entry in `operations`:
   - `upsert-variable`: if a variable with `name` exists in the cache,
     call the MCP update tool (e.g. `update_variable` / `set_variable_mode_value`);
     else call the create tool (e.g. `create_variable`).
   - `delete-variable`: call the MCP delete tool if the user confirms
     (deletions are destructive in Figma — always confirm).
   Collect the successes and failures. If a specific MCP tool isn't present
   in the current server, move the op to a "manual follow-up" list.

5. **Handle `manual`.** For shadows and easings (not backed by Figma
   variables), render a checklist to the user describing the desired value
   per path so they can apply via Figma's Effects/Easing UI. Don't block
   the rest of the sync on these.

6. **Commit the lock.** Once all operations succeed (or the user accepts the
   manual items), run:
   ```
   tsx scripts/sync.ts --commit-lock
   ```
   This writes the merged hash set to `tokens.lock.json` so future diffs
   have a clean baseline.

7. **Clean up.** Delete `.sync-plan.json`. Keep `.figma-cache/variables.json`
   (the `SessionStart` hook uses it to detect drift at the next session).

## Fallbacks & constraints

- If the Dev Mode MCP in the user's setup has no write tools at all, skip
  step 4 and instead render a single Markdown checklist for the user to
  apply manually in Figma (one row per op). Do not claim a sync succeeded
  when it was manual-only — skip `--commit-lock` in that case.
- Never push when `npm run ds:sync:dry` shows conflicts. Always route the
  user through conflict resolution first.
- Always confirm `delete-variable` operations individually, even if the
  user approved the overall sync.

## Output checklist

- [ ] `.figma-cache/variables.json` refreshed this run
- [ ] `npm run ds:sync:dry` showed `0 conflicts`
- [ ] Every `operations` entry in `.sync-plan.json` either succeeded via
      MCP or was moved to the manual-follow-up list
- [ ] `tokens.lock.json` committed (only if no manual-only ops remain)
- [ ] Summary delivered: N upserted, N deleted, N manual

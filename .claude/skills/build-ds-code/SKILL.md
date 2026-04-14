---
name: build-ds-code
description: Builds the design system in code from tokens.json. Regenerates tailwind.config.ts (generated block) and src/styles/tokens.css, and scaffolds / updates Storybook with token-gallery stories. Use when tokens.json has changed, or when setting up the code side from scratch.
---

# build-ds-code

## When to use

- User says "regenerate the design system", "rebuild tokens", "update Tailwind from tokens."
- After `tokens.json` has been edited (directly or by `sync-code-to-figma` /
  `create-figma-ds-skill`).
- First-time Storybook scaffold for a project.

Do NOT use this skill to push changes INTO Figma — that's `sync-code-to-figma`.

## Steps

1. **Sanity-check `tokens.json`.** Run `npm run ds:sync:dry`. If it shows
   `conflict`, stop and direct the user to resolve them first (see
   `sync-conflict.md`).

2. **Regenerate code.** Run `npm run ds:build` (= `tsx scripts/tokens-to-tailwind.ts`).
   This writes:
   - `src/styles/tokens.css` — fully generated.
   - `tailwind.config.ts` — the block between `BEGIN GENERATED` /
     `END GENERATED` is replaced in place. Anything outside those markers
     is preserved.

3. **Install Storybook if missing.** If `.storybook/main.ts` exists but
   `node_modules/storybook` does not, run:
   ```
   npm i -D storybook @storybook/react-vite @storybook/addon-essentials \
            @storybook/blocks storybook-design-token \
            react react-dom vite @vitejs/plugin-react
   ```
   These are intentionally NOT in `package.json` by default so token-only
   users don't pay the install cost. If the user wants a fully zero-config
   start, offer to commit them.

4. **Verify Storybook renders.** Run `npm run storybook -p 6006` (background)
   and open `http://localhost:6006`. Check that:
   - `Tokens/Colors` shows swatches for all `color.*` tokens.
   - `Tokens/Typography` renders font sizes and weights.
   - `Tokens/Spacing & Radii` renders bars + rounded squares.
   - `Tokens/Shadows & Motion` renders shadow cards and animates on hover.
   If any token is missing from the Design Tokens addon panel, confirm
   `src/styles/tokens.css` was regenerated in step 2.

5. **Report.** Summarize to the user: how many tokens were emitted, which
   files changed, and whether any manual step is pending.

## Constraints

- Never hand-edit `src/styles/tokens.css` or the generated block in
  `tailwind.config.ts`. If the user asks to tweak a token, edit
  `tokens.json` and re-run this skill.
- Do not regenerate if `npm run ds:sync:dry` reports conflicts — the lock
  file would desync.

## Troubleshooting

- **Tailwind typecheck error on `fontFamily`** — the generated block must
  emit plain arrays (not `as const`); that's already handled by
  `scripts/tokens-to-tailwind.ts`. If you see readonly errors, check that
  no one edited the transform to re-add `as const`.
- **Storybook Design Tokens panel empty** — ensure
  `.storybook/main.ts` points `storybook-design-token.glob` at
  `src/styles/tokens.css` (the generated file).

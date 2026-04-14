# Token conventions (project policy)

These rules are enforced by the skills. When in doubt,
prefer these over what a given Figma file or code snippet happens to do.

## Layering

| Layer      | Pattern                                       | Edited by                       |
|------------|-----------------------------------------------|---------------------------------|
| Primitive  | `color.{brand,neutral}.{step}`, `space.{n}`, `radius.{size}`, `font.{family,size,weight,lineHeight}.*` | designers (Figma is common input) |
| Semantic   | `color.semantic.{bg,fg,accent,border}.{state}` | designers + engineers together |
| Component  | _not in scope yet_                            | —                               |

Primitives should almost never alias; semantics should almost always alias a primitive.

## Modes (light/dark/themes)

- Modes are Figma variable "modes". On the code side we emit one set of
  CSS vars per mode under a selector (e.g. `:root`, `[data-theme="dark"]`).
- In `tokens.json` modes are expressed by splitting the semantic layer into
  per-mode branches if/when we introduce them (out of scope for v1).

## Figma ↔ code name mapping

- DTCG dotted path `color.brand.primary.500` ↔ Figma variable name `color/brand/primary/500`.
- CSS variable name: replace dots with dashes and prepend `--` → `--color-brand-primary-500`.
- Tailwind key: nested object under the relevant theme slot; e.g. `theme.colors.brand.primary.500`.

## What NOT to hand-edit

- `tailwind.config.ts` between `BEGIN GENERATED` / `END GENERATED`.
- `src/styles/tokens.css` (entirely generated).
- `tokens.lock.json` (updated by `scripts/ds/sync.ts --commit-lock`).

## When Figma and code disagree

Run `npm run ds:sync:dry`. If it reports conflicts, they're written to
`sync-conflict.md` — resolve by editing `tokens.json` to the value you want,
then run `npm run ds:sync` again.

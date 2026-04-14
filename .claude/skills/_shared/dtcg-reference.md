# DTCG quick reference

This project uses the **W3C Design Tokens Community Group** format
(<https://design-tokens.github.io/community-group/format/>). Every skill in
this repo consumes or produces DTCG-shaped JSON.

## Shape

A token is a leaf with `$value` and `$type`. Groups are objects; anything
prefixed with `$` is metadata.

```json
{
  "color": {
    "brand": {
      "primary": { "$type": "color", "$value": "#4f46e5" }
    },
    "semantic": {
      "accent": { "$type": "color", "$value": "{color.brand.primary}" }
    }
  }
}
```

## Types we use

| `$type`        | `$value` shape                            | Example                                  |
|----------------|-------------------------------------------|------------------------------------------|
| `color`        | hex / rgb / hsl string                    | `"#4f46e5"`                              |
| `dimension`    | numeric string with unit                  | `"16px"`, `"1.5rem"`                     |
| `fontFamily`   | string or string[]                        | `["Inter", "system-ui"]`                 |
| `fontWeight`   | number                                    | `500`                                    |
| `number`       | number                                    | `1.5`                                    |
| `duration`     | `"<n>ms"` or `"<n>s"`                     | `"120ms"`                                |
| `cubicBezier`  | `[x1, y1, x2, y2]`                        | `[0.2, 0, 0, 1]`                         |
| `shadow`       | `{ color, offsetX, offsetY, blur, spread }` | see tokens.json                        |

## Aliases

A value like `"{color.brand.primary}"` refers to another token by its dotted
path (from the tree root). `scripts/tokens.ts#flatten` resolves aliases
recursively; cycles or unresolved aliases throw.

## Naming conventions (project policy)

- Group by **layer**: primitives → semantic → component.
  - Primitives: `color.neutral.*`, `color.brand.*`
  - Semantic:   `color.semantic.{bg,fg,accent}.*`
  - Components: `color.button.primary.*` (only if we add component tokens later)
- Scales use numeric steps (`50, 100 … 900`) or size stops (`sm, md, lg, xl`).
- Figma variable names map 1:1: DTCG `color.brand.primary.500` ↔ Figma `color/brand/primary/500`.

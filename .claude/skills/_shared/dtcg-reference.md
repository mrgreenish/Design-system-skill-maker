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
      "primary": {
        "500": { "$type": "color", "$value": "#4f46e5" }
      }
    },
    "semantic": {
      "bg": {
        "default": { "$type": "color", "$value": "{color.neutral.0}" }
      }
    }
  }
}
```

## Types reference

| `$type`        | `$value` shape                                  | CSS output                              | Figma variable type |
|----------------|--------------------------------------------------|------------------------------------------|---------------------|
| `color`        | hex / rgba string                               | `#4f46e5`                               | `COLOR`             |
| `dimension`    | numeric string with unit (`px`, `rem`, `em`, `%`) | `"16px"`, `"1.5rem"`, `"-0.025em"`    | `FLOAT` (px stripped) |
| `fontFamily`   | string or string[]                              | `Inter, system-ui, sans-serif`          | `STRING`            |
| `fontWeight`   | number                                          | `500`                                   | `FLOAT`             |
| `number`       | number                                          | `1.5`                                   | `FLOAT`             |
| `duration`     | `"<n>ms"` or `"<n>s"`                           | `"120ms"`                               | `FLOAT` (ms stripped) |
| `cubicBezier`  | `[x1, y1, x2, y2]`                              | `cubic-bezier(0.2, 0, 0, 1)`           | ⚠️ manual (not a native Figma variable) |
| `shadow`       | `{ color, offsetX, offsetY, blur, spread, inset? }` | `0px 4px 8px 0px rgba(0,0,0,0.1)` | ⚠️ manual (not a native Figma variable) |

> **Manual-protected types**: `shadow` and `cubicBezier` cannot be represented
> as Figma variables. They appear in `.sync-plan.json` under `manual`, not
> `operations`. Changes to these tokens are surfaced as a checklist for the
> user to apply in Figma's Effects / Easing panel. They are never auto-deleted
> from `tokens.json`.

## Aliases

A value like `"{color.brand.primary.500}"` refers to another token by its
dotted path (from the tree root). `scripts/ds/tokens.ts#flatten` resolves
aliases recursively; cycles or unresolved aliases throw.

Alias tokens are **not de-aliased** by a figma-to-code sync. If Figma
diverges from the alias's resolved value, the sync warns the user to update
the alias target (the primitive token) instead.

## Token structure example (comprehensive)

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",

  "color": {
    "brand": {
      "primary": {
        "50":  { "$type": "color", "$value": "#eff6ff" },
        "500": { "$type": "color", "$value": "#3b82f6" },
        "600": { "$type": "color", "$value": "#2563eb" },
        "900": { "$type": "color", "$value": "#1e3a8a" }
      }
    },
    "neutral": {
      "0":   { "$type": "color", "$value": "#ffffff" },
      "50":  { "$type": "color", "$value": "#f8fafc" },
      "100": { "$type": "color", "$value": "#f1f5f9" },
      "500": { "$type": "color", "$value": "#64748b" },
      "900": { "$type": "color", "$value": "#0f172a" }
    },
    "semantic": {
      "bg":  { "default": { "$type": "color", "$value": "{color.neutral.0}" } },
      "fg":  { "default": { "$type": "color", "$value": "{color.neutral.900}" } },
      "border": { "default": { "$type": "color", "$value": "{color.neutral.200}" } }
    },
    "interactive": {
      "primary":  { "$type": "color", "$value": "{color.brand.primary.500}" },
      "hover":    { "$type": "color", "$value": "{color.brand.primary.600}" },
      "focus":    { "$type": "color", "$value": "{color.brand.primary.500}" },
      "disabled": { "$type": "color", "$value": "{color.neutral.300}" }
    },
    "status": {
      "error":   { "bg": { "$type": "color", "$value": "#fef2f2" }, "fg": { "$type": "color", "$value": "#dc2626" } },
      "success": { "bg": { "$type": "color", "$value": "#f0fdf4" }, "fg": { "$type": "color", "$value": "#16a34a" } },
      "warning": { "bg": { "$type": "color", "$value": "#fffbeb" }, "fg": { "$type": "color", "$value": "#d97706" } },
      "info":    { "bg": { "$type": "color", "$value": "#eff6ff" }, "fg": { "$type": "color", "$value": "#2563eb" } }
    }
  },

  "space": {
    "1": { "$type": "dimension", "$value": "4px" },
    "2": { "$type": "dimension", "$value": "8px" },
    "4": { "$type": "dimension", "$value": "16px" },
    "8": { "$type": "dimension", "$value": "32px" }
  },

  "radius": {
    "sm":   { "$type": "dimension", "$value": "4px" },
    "md":   { "$type": "dimension", "$value": "8px" },
    "full": { "$type": "dimension", "$value": "9999px" }
  },

  "font": {
    "family": {
      "sans": { "$type": "fontFamily", "$value": ["Inter", "system-ui", "sans-serif"] }
    },
    "size": {
      "sm": { "$type": "dimension", "$value": "14px" },
      "md": { "$type": "dimension", "$value": "16px" }
    },
    "weight": {
      "regular": { "$type": "fontWeight", "$value": 400 },
      "semibold": { "$type": "fontWeight", "$value": 600 }
    },
    "lineHeight": {
      "tight":   { "$type": "number", "$value": 1.2 },
      "relaxed": { "$type": "number", "$value": 1.6 }
    }
  },

  "letterSpacing": {
    "normal": { "$type": "dimension", "$value": "0em" },
    "wide":   { "$type": "dimension", "$value": "0.025em" }
  },

  "borderWidth": {
    "default": { "$type": "dimension", "$value": "1px" },
    "thick":   { "$type": "dimension", "$value": "2px" }
  },

  "opacity": {
    "disabled": { "$type": "number", "$value": 0.4 },
    "hover":    { "$type": "number", "$value": 0.08 }
  },

  "shadow": {
    "sm": {
      "$type": "shadow",
      "$value": { "color": "rgba(0,0,0,0.06)", "offsetX": "0px", "offsetY": "1px", "blur": "2px", "spread": "0px" }
    },
    "md": {
      "$type": "shadow",
      "$value": { "color": "rgba(0,0,0,0.10)", "offsetX": "0px", "offsetY": "4px", "blur": "8px", "spread": "0px" }
    }
  },

  "motion": {
    "duration": {
      "fast":   { "$type": "duration", "$value": "120ms" },
      "normal": { "$type": "duration", "$value": "200ms" }
    },
    "easing": {
      "standard": { "$type": "cubicBezier", "$value": [0.2, 0, 0, 1] }
    }
  },

  "breakpoint": {
    "sm":  { "$type": "dimension", "$value": "480px" },
    "md":  { "$type": "dimension", "$value": "768px" },
    "lg":  { "$type": "dimension", "$value": "1024px" },
    "xl":  { "$type": "dimension", "$value": "1280px" },
    "2xl": { "$type": "dimension", "$value": "1536px" }
  },

  "zIndex": {
    "dropdown": { "$type": "number", "$value": 10 },
    "sticky":   { "$type": "number", "$value": 20 },
    "modal":    { "$type": "number", "$value": 40 },
    "tooltip":  { "$type": "number", "$value": 60 }
  }
}
```

## Naming conventions (project policy)

- Group by **layer**: primitives → semantic → component.
  - Primitives: `color.neutral.*`, `color.brand.*`, `space.*`, `radius.*`, etc.
  - Semantic:   `color.semantic.{bg,fg,border,accent}.*`, `color.interactive.*`, `color.status.*`
  - Components: `color.button.primary.*` (only if we add component tokens later)
- Scales use numeric steps (`50, 100 … 900`) or size stops (`xs, sm, md, lg, xl`).
- Figma variable names map 1:1: DTCG `color.brand.primary.500` ↔ Figma `color/brand/primary/500`.
- CSS variable: `--color-brand-primary-500`
- Tailwind key: `colors.brand.primary.500`

## Figma-to-code sync behaviour per type

| Type         | Sync direction | Notes |
|--------------|---------------|-------|
| `color`      | Both ↔         | Full round-trip |
| `dimension`  | Both ↔         | Unit preserved via `figma-map.json` overrides |
| `fontFamily` | Both ↔         | Stored as STRING in Figma |
| `fontWeight` | Both ↔         | Stored as FLOAT in Figma |
| `number`     | Both ↔         | Stored as FLOAT in Figma |
| `duration`   | Both ↔         | Unit preserved via `figma-map.json` overrides |
| `shadow`     | Code → manual  | Figma variables can't represent shadows; appears in `.sync-plan.json` under `manual` |
| `cubicBezier`| Code → manual  | Figma variables can't represent easings; manual checklist |

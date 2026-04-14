# Token conventions (project policy)

These rules are enforced by the skills. When in doubt,
prefer these over what a given Figma file or code snippet happens to do.

## Layering

| Layer      | Pattern                                       | Edited by                       |
|------------|-----------------------------------------------|---------------------------------|
| Primitive  | `color.{hue}.{step}`, `color.neutral.{step}`, `space.{n}`, `radius.{size}`, `font.{family,size,weight,lineHeight}.*`, `letterSpacing.*`, `opacity.*`, `borderWidth.*`, `shadow.*` | designers (Figma is common input) |
| Semantic   | `color.semantic.{bg,fg,border,accent}.{state}`, `color.interactive.*`, `color.status.*` | designers + engineers together |
| Component  | _not in scope yet_                            | —                               |

Primitives should almost never alias; semantics should almost always alias a primitive.

## Complete token groups

### Color

```
color.brand.primary.{50..900}   — primary brand hue ramp
color.brand.secondary.{50..900} — secondary brand hue ramp (optional)
color.{hue}.{50..900}           — additional named hue ramps (green, red, blue, etc.)
color.neutral.{0..900}          — gray scale (0 = white, 900 = near black)

color.semantic.bg.{default,card,input,nav,overlay}
color.semantic.fg.{default,secondary,tertiary,placeholder,on-primary,on-error,on-success}
color.semantic.border.{default,input,strong,focus}
color.semantic.accent.default

color.interactive.primary       — CTA/primary button background (aliases color.brand.primary.*)
color.interactive.hover         — hover state background
color.interactive.active        — active/pressed state background
color.interactive.focus         — focus ring color (often a high-contrast blue for accessibility)
color.interactive.disabled      — disabled element fill
color.link.default              — inline link color (usually aliases interactive.primary)
color.link.visited              — visited link color

color.status.error.{bg,fg,border}
color.status.success.{bg,fg,border}
color.status.warning.{bg,fg,border}
color.status.info.{bg,fg,border}
```

### Space (dimensions with px unit)

```
space.0    = 0px
space.px   = 1px
space.0.5  = 2px
space.1    = 4px
space.1.5  = 6px
space.2    = 8px
space.2.5  = 10px
space.3    = 12px
space.4    = 16px
space.5    = 20px
space.6    = 24px
space.7    = 28px
space.8    = 32px
space.10   = 40px
space.12   = 48px
space.14   = 56px
space.16   = 64px
space.20   = 80px
space.24   = 96px
space.32   = 128px
```

Step choice is per-project. At minimum provide 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16.

### Radius (dimensions with px unit)

```
radius.none = 0px
radius.sm   = 2–4px   — minimal rounding
radius.md   = 6–8px   — standard buttons, cards
radius.lg   = 12–16px — prominent cards, dialogs
radius.xl   = 20–24px — large containers, modals
radius.2xl  = 28–32px — hero containers, featured media
radius.full = 9999px  — pill shapes, avatars
```

### Font

```
font.family.sans    fontFamily  — primary UI/body typeface
font.family.serif   fontFamily  — heading or editorial typeface (optional)
font.family.mono    fontFamily  — code/technical content

font.size.xs        dimension   — e.g. 11–12px
font.size.sm        dimension   — e.g. 13–14px
font.size.md        dimension   — e.g. 15–16px  (base body)
font.size.lg        dimension   — e.g. 18–20px
font.size.xl        dimension   — e.g. 22–24px
font.size.2xl       dimension   — e.g. 28–32px
font.size.3xl       dimension   — e.g. 36–40px
font.size.4xl       dimension   — e.g. 48px
font.size.5xl       dimension   — e.g. 60–64px  (display/hero)

font.weight.light   fontWeight  — 300
font.weight.regular fontWeight  — 400
font.weight.medium  fontWeight  — 500
font.weight.semibold fontWeight — 600
font.weight.bold    fontWeight  — 700

font.lineHeight.tight    number — 1.10–1.20  (headings)
font.lineHeight.snug     number — 1.25–1.30
font.lineHeight.normal   number — 1.40–1.45
font.lineHeight.relaxed  number — 1.50–1.60  (body)
font.lineHeight.loose    number — 1.70–1.80
```

### Letter spacing (dimension with em unit)

```
letterSpacing.tighter  — e.g. "-0.05em"  (tight display headings)
letterSpacing.tight    — e.g. "-0.025em"
letterSpacing.normal   — e.g. "0em"
letterSpacing.wide     — e.g. "0.025em"  (uppercase labels, captions)
letterSpacing.wider    — e.g. "0.05em"
letterSpacing.widest   — e.g. "0.1em"
```

Store as `dimension` type with em unit (e.g. `"$value": "-0.025em"`).

### Border width (dimension with px unit)

```
borderWidth.default — 1px  (standard borders, inputs, dividers)
borderWidth.thick   — 2px  (focus rings, active indicators)
borderWidth.heavy   — 4px  (decorative accents, progress bars)
```

### Opacity (number, 0–1)

```
opacity.disabled — 0.40–0.50  (disabled interactive elements)
opacity.hover    — 0.08–0.12  (hover overlay on solid backgrounds)
opacity.pressed  — 0.16–0.20  (active/pressed overlay)
opacity.overlay  — 0.40–0.60  (modal scrim)
```

Store as `number` type.

### Shadow (shadow composite)

```
shadow.none  — no shadow
shadow.xs    — barely visible lift (e.g. 0px 1px 2px 0px rgba(0,0,0,0.06))
shadow.sm    — subtle card shadow
shadow.md    — standard card shadow
shadow.lg    — floating panels, dropdowns
shadow.xl    — modals, overlays
shadow.inner — inset shadow (for inputs, sunken elements)
```

Store as `shadow` type: `{ "color", "offsetX", "offsetY", "blur", "spread", "inset?" }`.

### Motion

```
motion.duration.fast    duration — 80–120ms    (micro-interactions: toggles, ripples)
motion.duration.normal  duration — 150–200ms   (standard: menus, tooltips)
motion.duration.slow    duration — 250–350ms   (deliberate: page transitions, modals)
motion.duration.slower  duration — 400–500ms   (expressive: hero animations)

motion.easing.standard     cubicBezier — [0.2, 0, 0, 1]       (Material standard)
motion.easing.decelerate   cubicBezier — [0, 0, 0.2, 1]       (enter/appear)
motion.easing.accelerate   cubicBezier — [0.3, 0, 1, 1]       (exit/disappear)
motion.easing.bounce       cubicBezier — [0.34, 1.56, 0.64, 1] (springy)
```

### Breakpoint (dimension with px unit)

```
breakpoint.sm   — 480px  (large mobile)
breakpoint.md   — 768px  (tablet)
breakpoint.lg   — 1024px (desktop)
breakpoint.xl   — 1280px (wide)
breakpoint.2xl  — 1536px (ultrawide)
```

Store as `dimension` type. Tailwind maps these to `theme.screens`.

### Z-index (number)

```
zIndex.hide      — -1
zIndex.base      — 0
zIndex.raised    — 1
zIndex.dropdown  — 10
zIndex.sticky    — 20
zIndex.fixed     — 30
zIndex.modal     — 40
zIndex.popover   — 50
zIndex.tooltip   — 60
zIndex.toast     — 70
```

Store as `number` type.

## Modes (light/dark/themes)

- Modes are Figma variable "modes". On the code side we emit one set of
  CSS vars per mode under a selector (e.g. `:root`, `[data-theme="dark"]`).
- In `tokens.json` modes are expressed by splitting the semantic layer into
  per-mode branches if/when we introduce them (out of scope for v1).
- Dark-mode semantic values alias different primitives (e.g.
  `color.semantic.bg.default` aliases `color.neutral.900` in dark mode).

## Figma ↔ code name mapping

- DTCG dotted path `color.brand.primary.500` ↔ Figma variable name `color/brand/primary/500`.
- CSS variable name: replace dots with dashes and prepend `--` → `--color-brand-primary-500`.
- Tailwind key: nested object under the relevant theme slot; e.g. `theme.colors.brand.primary.500`.

## Tailwind mapping table

| DTCG group root  | Tailwind theme slot           |
|------------------|-------------------------------|
| `color`          | `theme.colors`                |
| `space`          | `theme.spacing`               |
| `radius`         | `theme.borderRadius`          |
| `font.family`    | `theme.fontFamily`            |
| `font.size`      | `theme.fontSize`              |
| `font.weight`    | `theme.fontWeight`            |
| `font.lineHeight`| `theme.lineHeight`            |
| `letterSpacing`  | `theme.letterSpacing`         |
| `borderWidth`    | `theme.borderWidth`           |
| `opacity`        | `theme.opacity`               |
| `shadow`         | `theme.boxShadow`             |
| `motion.duration`| `theme.transitionDuration`    |
| `motion.easing`  | `theme.transitionTimingFunction` |
| `breakpoint`     | `theme.screens`               |
| `zIndex`         | `theme.zIndex`                |

## What NOT to hand-edit

- `tailwind.config.ts` between `BEGIN GENERATED` / `END GENERATED`.
- `src/styles/tokens.css` (entirely generated).
- `tokens.lock.json` (updated by `scripts/ds/sync.ts --commit-lock`).

## When Figma and code disagree

Run `npm run ds:sync:dry`. If it reports conflicts, they're written to
`sync-conflict.md` — resolve by editing `tokens.json` to the value you want,
then run `npm run ds:sync` again.

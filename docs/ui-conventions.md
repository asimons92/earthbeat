# UI conventions

Earthbeat UI is **eggshell + black hairlines**: quiet, minimal, instrument-like. Avoid a “vibe coded” look (soft shadows, colored chrome, gradient washes, decorative skeuomorphism).

Reference sketch: `docs/earthbeat-ui-eggshell-minimal.png`.

## Tokens

Raw colors live in **one place only**:

`client/src/styles/tokens.css`

| Token | Role |
| --- | --- |
| `--bg` | App eggshell ground |
| `--bg-panel` | Sidebar / monitor strip |
| `--bg-node` | Node / control fill (white) |
| `--ink` | Primary text and hairlines |
| `--ink-muted` | Secondary labels |
| `--line` | Borders and strokes |
| `--line-muted` | Soft separators / grid |
| `--grid-dot` | Canvas dots |
| `--live` / `--destructive` | Live / error only |

Everywhere else (CSS, TSX styles, SVG props) must use `var(--…)`, `currentColor`, or `transparent`.

## Do

- Flat surfaces, 1px black/near-black borders
- One type pair (`--font-brand`, `--font-ui`)
- Color only for live/error state
- Prefer outline controls over filled accent blocks

## Do not

- Hex / `rgb()` / `hsl()` / `color-mix()` outside `tokens.css`
- Soft multi-layer shadows, glows, glass, neumorphism
- Palette utilities when Tailwind arrives (`bg-blue-500`, `text-zinc-400`, `bg-[#…]`)
- Purple gradients, terracotta-on-cream “AI landing page” tropes, emoji as UI chrome

## Enforcement

From `client/`:

```bash
pnpm lint
```

Runs:

1. **oxlint** — React/TS hygiene  
2. **stylelint** — `color-no-hex` + banned color functions except in `tokens.css`  
3. **check-ui-colors** — bans raw colors in `src/**/*.{ts,tsx}`

Agent guidance: `.cursor/rules/ui-conventions.mdc`.

## When Tailwind / shadcn land

Map theme CSS variables to these tokens (`--background` → `--bg`, `--foreground` → `--ink`, `--border` → `--line`, …). Then add a Tailwind palette / arbitrary-color ESLint (or oxlint) rule so semantic classes stay required. Do not introduce a second color source of truth.

# UI conventions

Earthbeat UI is **eggshell + black hairlines**: quiet, minimal, instrument-like. Avoid a “vibe coded” look (soft shadows, colored chrome, gradient washes, decorative skeuomorphism).

Reference sketch: `docs/earthbeat-ui-eggshell-minimal.png`.

## Stack

- **Tailwind CSS v4** via `@tailwindcss/vite`
- **shadcn/ui** (Radix Nova) under `client/src/components/ui`
- Token source of truth: `client/src/styles/tokens.css`

## Tokens

Raw colors live in **one place only**:

`client/src/styles/tokens.css`

Earthbeat names (`--bg`, `--ink`, `--line`, `--live`, …) and shadcn semantic names (`--background`, `--foreground`, `--border`, …) are defined there together.

Prefer Tailwind semantic classes:

| Class | Role |
| --- | --- |
| `bg-background` / `text-foreground` | App ground / ink |
| `bg-card` / `border-border` | Nodes / panels |
| `bg-muted` / `text-muted-foreground` | Secondary UI |
| `bg-primary` / `text-primary-foreground` | Primary actions |
| `text-destructive` / `border-destructive` | Error / danger |
| `text-live` (via `--color-live`) | Live indicator |

## Do

- Flat surfaces, 1px black/near-black borders
- One type pair (`--font-brand`, `--font-ui`)
- Color only for live/error state
- For app chrome (buttons, inputs, dialogs, menus, tabs, selects, etc.): use shadcn
  1. Reuse `client/src/components/ui/*` if present
  2. Otherwise `pnpm --dir client dlx shadcn@latest add <component>`
  3. Import from `@/components/ui/...`

Hand-build only instrument/canvas UI: React Flow nodes/edges, waveforms, palette icons, shell layout grid.

## Do not

- Hex / `rgb()` / `hsl()` / `oklch()` / `color-mix()` outside `tokens.css`
- Tailwind palette classes (`bg-zinc-50`, `text-blue-600`, …)
- Arbitrary colors (`bg-[#…]`, `text-[rgb(…)]`)
- Soft multi-layer shadows, glows, glass, neumorphism
- A second color theme (Geist defaults, purple presets, dark-mode palette) without updating tokens first
- Invent custom Button/Input/Dialog/Select/etc. when shadcn can provide them

## Enforcement

From `client/`:

```bash
pnpm lint
```

Runs:

1. **oxlint** — React/TS hygiene  
2. **stylelint** — `color-no-hex` + banned color functions except in `tokens.css`  
3. **check-ui-colors** — bans raw colors + Tailwind palette / arbitrary color utilities in `src/**/*.{ts,tsx}`

Agent guidance: `.cursor/rules/ui-conventions.mdc`.

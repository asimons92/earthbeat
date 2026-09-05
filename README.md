# Earthbeat

Earthbeat turns natural-world signal sources into sound through user-built audio patches.

A Patch is a saved graph of canvas nodes. You wire Connectors (natural-signal inputs), Modulators (channel-to-parameter maps), and Oscillators (sound nodes) on a React Flow canvas. React Flow edges are plain wires.

The first ConnectorKind (catalog entry for a natural-signal API) is `usgs_earthquakes`. Oscillator defaults use a sine waveform. The audio runtime is Elementary.

## Status

M2 is in place: an Express `server/` polls the USGS all_day feed and streams samples over SSE. The client maps a wired Connector through a Modulator into sine Oscillators and plays them with Elementary.

Auth and Postgres patch persistence are still ahead (M3). See `docs/PRD.md` for milestones and `docs/feature/runtime/` for M2 decisions.

## Requirements

You need Node.js 20 or newer and pnpm.

## Setup

1. Clone this repository.
2. Install workspace packages from the repository root:

```bash
pnpm install
```

## Run the app

From the repository root:

```bash
pnpm dev
```

That command starts the Vite client and the Express server together. Open the URL that the client terminal prints.

## Test and lint

Run tests:

```bash
pnpm test
```

Run lint (oxlint, stylelint, and project invariant scripts):

```bash
pnpm lint
```

Build the client:

```bash
pnpm build
```

## Repository layout

| Path | Role |
| --- | --- |
| `client/` | Vite React TypeScript app and canvas UI |
| `clay/` | Domain model and Clay generators |
| `docs/` | PRD, glossary, UI conventions, feature journals |
| `AGENTS.md` | Rules for agents that change product code |

Clay is the model-driven development tool for this repo. Edit `clay/model.json` (and generators under `clay/generators/`) for domain shape and catalog lists. Run `clay generate` after those edits. Do not hand-edit files listed under `.clay` → `generated_files`.

Dropdowns and palette labels come from the generated catalog at `client/src/generated/catalog.ts`. Import that catalog. Do not hand-write option arrays in React.

## Docs

| Doc | Content |
| --- | --- |
| `docs/PRD.md` | Product vision, MVP scope, milestones |
| `docs/glossary.md` | Shared nouns and verbs (Patch, Connector, Modulator, Oscillator) |
| `docs/ui-conventions.md` | Eggshell shell tokens and UI rules |
| `docs/feature/README.md` | Feature journal convention |
| `docs/earthbeat-ui-eggshell-minimal.png` | Primary shell layout reference |

## Development notes

Prefer property-based tests with `fast-check` for domain behavior. For canvas or shell wiring tests only, start the file with the `earthbeat-test: exception ui-surface` comment. See `.cursor/rules/adversarial-testing.mdc`.

If a feature journal folder exists under `docs/feature/<slug>/`, read every entry in it before you change that area. After a decision or non-trivial change, append a dated journal entry.

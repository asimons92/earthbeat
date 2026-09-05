# Agent guidance

Read these files before you change product behavior, domain shape, or UI nouns.

## Required reading

1. `docs/glossary.md` — shared nouns and verbs. Use Patch, not Pipeline. Use Connector, Modulator, and Oscillator for canvas nodes. React Flow edges are plain wires. Do not use Connection as a product noun.
2. `docs/PRD.md` — product vision, MVP scope, and the decision that write commands run in a database transaction.
3. `clay/model.json` — domain types, commands, and catalog seeds (for example `usgs_earthquakes` and sine Oscillator defaults).
4. `docs/feature/<slug>/` — feature journals (dated notes) for the area you are changing, when that folder exists. Convention: `docs/feature/README.md`.

## Feature journals

Feature journals are short dated markdown entries under `docs/feature/<slug>/`. Read matching journals before you change that feature. After a decision or non-trivial change, append a new entry (`YYYY-MM-DD-short-topic.md`). Do not rewrite old entries. Standing reference docs (glossary, PRD, UI conventions) stay at `docs/`, not under `docs/feature/`.

## UI references

1. `docs/earthbeat-ui-eggshell-minimal.png` — primary shell layout for the Vite client.
2. `docs/earthbeat-ui-op1-concept.png` — alternate visual concept. Prefer the eggshell layout unless the user asks otherwise.

## Clay and generated code

Earthbeat uses Clay for model-driven generation. The domain model and generators are the source of truth.

1. Change domain shape in `clay/model.json` (or Clay includes and mixins).
2. Change generated shape in `clay/generators/` templates and `generator.json`.
3. Run `clay generate` or Clay MCP `clay_generate` after model or template edits.
4. Do not hand-edit files listed under `.clay` → `generated_files`. Hooks block those edits on purpose.
5. Prefer Clay MCP tools when you query or update the model.

Cursor also loads `.cursor/rules/clay-mdd.mdc` for the same Clay rules.

## Model-driven UI

Dropdowns, create-nav labels, palette categories, and similar option lists must come from Clay, not from hand-written arrays in React.

1. Define lists in `clay/model.json` (`catalog.shell`, connector kinds, modulatable Oscillator fields, and related catalog seeds).
2. Run `clay generate` so Clay writes `client/src/generated/catalog.ts` (and other generated modules).
3. Import only from `@/generated/catalog` (or other paths under `client/src/generated/`).
4. Do not maintain a parallel hand-written `catalog.ts`.
5. `pnpm --dir client lint` runs `scripts/check-model-driven-ui.mjs`, which bans hand-rolled option arrays and non-generated catalog imports outside `client/src/generated/`.

Cursor also loads `.cursor/rules/model-driven-ui.mdc` for the same policy.

## App shell

The Vite React client lives in `client/`. From the repo root, run `pnpm dev` to start it. Play and LIVE controls are stubs until the runtime milestone.

## Testing

Earthbeat uses adversarial, property-based tests. Cursor loads `.cursor/rules/adversarial-testing.mdc`.

1. For a new feature or behavior change, write invariant and constraint tests first. Halt for human approval before any application implementation.
2. Prefer `fast-check` properties and model-based state machines over fixed example assertions.
3. Do not put hardcoded string, boolean, or number literals in assertion expected values. Use generators or factories.
4. For canvas or shell wiring tests only, start the file with `// earthbeat-test: exception ui-surface — <reason>`. That waives the `fast-check` import requirement, not the other bans.
5. Run `pnpm --dir client test` and `pnpm --dir client lint` after test changes. Lint includes `scripts/check-test-invariants.mjs`.

## Language

Project docs and agent replies follow Simple English. See `.cursor/rules/simple-english.mdc` and `.agents/skills/simple-english/` when that rule is active.

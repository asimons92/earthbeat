# Agent guidance

Read these files before you change product behavior, domain shape, or UI nouns.

## Required reading

1. `docs/glossary.md` — shared nouns and verbs. Use Patch, not Pipeline. Use Connection for the source node and Modulation for the graph edge.
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

## App shell

The Vite React client lives in `client/`. From the repo root, run `pnpm dev` to start it. Play and LIVE controls are stubs until the runtime milestone.

## Language

Project docs and agent replies follow Simple English. See `.cursor/rules/simple-english.mdc` and `.agents/skills/simple-english/` when that rule is active.

# Model-driven UI catalog

Date: 2026-09-04

## Decision

UI option lists (create nav, palette labels, patch tabs, connector channels, modulatable oscillator params) are defined in `clay/model.json` and emitted by the `ui-catalog` Clay generator into `client/src/generated/catalog.ts`. Client code imports that module only. Lint script `client/scripts/check-model-driven-ui.mjs` bans hand-rolled option arrays and non-generated catalog imports. Agent policy lives in `AGENTS.md` and `.cursor/rules/model-driven-ui.mdc`.

## Notes

The stub `api` generator remains under `clay/generators/api` but is not listed in `model.json` generators until its templates map Clay field types to valid TypeScript.

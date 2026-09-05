# UI surface exception hint

Date: 2026-09-04
Status: decided

## Context

Hard `fast-check` on every test file fights early canvas and shell work. Domain invariants still need the property default.

## Decision

Agents may waive the `fast-check` import with a first-line comment:

`// earthbeat-test: exception ui-surface — <reason>`

Use it only for React Flow chrome, app shell, and other render-or-wire surfaces. The comment does not waive tautology, snapshot, or hardcoded expected-value bans.

## Why

Early UI needs guardrails without forcing generators onto wiring checks. Domain and command logic keep the property default.

## Follow-up

Related: `2026-09-04-adversarial-property-testing.md`. See `.cursor/rules/adversarial-testing.mdc`.

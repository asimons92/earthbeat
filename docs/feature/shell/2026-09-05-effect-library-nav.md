# Effect Library nav

Date: 2026-09-05
Status: decided

## Context

Effects need the same discoverability as Connectors.

## Decision

`catalog.shell.navItems` includes Effect Library at `/effects` with `listSource: effectKinds`. Create-nav `addEffect` routes to that library. `LIBRARY_SOURCES` in `navItems.ts` includes `effectKinds`.

## Why

Model-driven shell lists stay consistent across Connector and Effect catalogs.

## Follow-up

None.

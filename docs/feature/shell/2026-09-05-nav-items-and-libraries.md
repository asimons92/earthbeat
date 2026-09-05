# Shell nav from Clay navItems

Date: 2026-09-05
Status: superseded

## Context

The shell header had create actions and auth labels from `catalog.shell`, but no primary nav. The client was a single page with no router. The product needed Connector Library and Patch Library as real routes.

## Decision

Primary nav comes from `catalog.shell.navItems` in `clay/model.json`. Each item has `key`, `label`, `path`, and `listSource`. Clay emits `shellNavItems` into `client/src/generated/catalog.ts`. The client uses `react-router-dom` with routes `/`, `/connectors`, `/connectors/:kindKey`, and `/patches`. The brand link opens the canvas. Domain types do not auto-appear in the nav.

## Why

Nav is a UI projection. Patch Library lists User Patches. Connector Library lists ConnectorKinds. Those list shapes differ, so an explicit shell list is clearer than tags on every Clay type.

## Follow-up

Placement moved to the left sidebar. See `2026-09-05-left-sidebar-nav.md`. Live NOAA CO-OPS poll for `noaa_coops_tides` is still open. See `../connector/2026-09-05-noaa-coops-tides-kind.md`.

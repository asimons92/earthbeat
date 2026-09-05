# Model-driven UI catalog for navItems

Date: 2026-09-05
Status: decided

## Context

`catalog.shell` already drove create actions, palette labels, and auth chrome. Libraries needed nav labels and paths without hand-rolled option arrays.

## Decision

Add `catalog.shell.navItems` and emit `shellNavItems` from the `ui-catalog` generator. Client chrome imports that list only. Lint still bans hand-rolled option arrays outside `client/src/generated/`.

## Why

Same rule as create-nav: Clay owns the list, the client maps it.

## Follow-up

Earlier catalog policy: `2026-09-04-clay-ui-catalog.md`. Shell routes: `../shell/2026-09-05-nav-items-and-libraries.md`.

# Canvas nav item

Date: 2026-09-05
Status: decided

## Context

Library routes had no explicit control to return to the canvas besides the brand link.

## Decision

Add a `canvas` entry to `catalog.shell.navItems` with path `/` and `listSource: none`. It is the first left-nav item. The Canvas `NavLink` uses `end` so only the index route is active.

## Why

Return to canvas belongs with the other primary destinations in the Clay-driven sidebar.

## Follow-up

Earlier left-nav placement: `2026-09-05-left-sidebar-nav.md`.

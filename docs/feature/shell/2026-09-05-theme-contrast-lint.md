# Theme contrast lint and button color inherit

Date: 2026-09-05
Status: decided

## Context

The ConnectorKind detail "Add to canvas" Button used the default filled primary variant. Unlayered CSS set `button { color: inherit }`, which beat Tailwind `@layer utilities` such as `text-primary-foreground`. The result was ink on ink (black text on a black primary fill in light mode).

## Decision

Move the button and select font reset into `@layer base` so utility text colors win. Use `variant="outline"` on the library Add to canvas control. Add `client/scripts/check-theme-contrast.mjs` to `pnpm lint`. That script checks WCAG AA contrast (4.5:1) for semantic surface and ink token pairs in `:root` and `.dark`.

## Why

Cascade order caused the bug. Token contrast checks catch paired tokens that are too close in both themes. Outline matches the other shell buttons.

## Follow-up

None.

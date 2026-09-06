# Surf n Turf starter shipped

Date: 2026-09-05
Status: decided

## Context

Constraint tests for the baked Surf n Turf starter were approved. Boot helpers still returned empty. Patch Library still required sign-in.

## Decision

`decideCanvasBoot` and `decideWorkingGraphSource` load the starter when there is no draft. Cold start and Patch Library open apply Surf n Turf through `loadStarter`. Patch Library lists starters for everyone and user Patches when signed in.

## Why

Matches the approved social loop: one-click starter without Google, draft still wins when present, Play stays manual.

## Follow-up

Supersedes the open note in `2026-09-05-surf-n-turf-baked-starter.md`. Share-by-link stays out of scope.

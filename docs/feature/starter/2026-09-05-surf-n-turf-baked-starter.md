# Surf n Turf starter constraints

Date: 2026-09-05
Status: superseded

## Context

Friends need a one-click Patch without a blank canvas. Prod Patch `da020f10` (name spooky) is the source graph: quakes, tides, and waves into Oscillators and Effects.

## Decision

Bake that graph as client starter Surf n Turf. Patch Library stays open without sign-in: list starters always, and list that userId Patches when signed in. Cold start with no browser draft loads the starter. An existing draft still wins. Play stays stopped until the user clicks Play.

## Why

A baked seed works for guests. Gating the library behind Google blocks the social loop. Draft-wins keeps in-progress work safe.

## Follow-up

Constraint tests lived in `client/src/starters/starterLibrary.test.ts` and boot rules in `client/src/persist/canvasDraft.test.ts`. Shipped in `2026-09-05-surf-n-turf-wired.md`.

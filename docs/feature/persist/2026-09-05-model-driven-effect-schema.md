# Model-driven Effect Zod schema

Date: 2026-09-05
Status: decided

## Context

`clay generate` skipped `router.ts` when Effect fields were added in the model because the router template hard-coded `effectSchema`. Types and schema already walked `Effect.fields`.

## Decision

Emit `effectSchema` from Clay `Effect` fields (minus graph node base fields) in `clay/generators/api/templates/router.ts`.

## Why

New Effect columns must reach Zod without a hand edit of the generated router.

## Follow-up

Consider the same pattern for Connector, Modulator, and Oscillator schemas.

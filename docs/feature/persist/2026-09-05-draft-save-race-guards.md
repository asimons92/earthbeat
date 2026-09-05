# Draft Save race guards

Date: 2026-09-05
Status: decided

## Context

`usePatchPersist` dropped the first edit after Save As via `ignoreNext`, left draft timers running after Save and load, marked concurrent edits clean after Save, and allowed Load or New during an in-flight Save. Draft writes were debounced with no flush on page leave. localStorage quota failures fell back to memory with no status.

## Decision

Cancel the draft timer on Save, Save As, load, New, and sign-out. Flush the draft on `pagehide` and `beforeunload`. Track a graph epoch so Save success marks clean only when the live Patch and epoch still match the Save target. Block Load, New, Save As, and Delete while Save is in flight. Suppress draft dirty marks with a programmatic graph fingerprint instead of a one-shot ignore flag. Surface durable draft write failures as `draft_error`. Remove corrupt drafts on read.

## Why

Browser draft durability and dirty prompts must match what the user edited. Database Save must not erase concurrent edits or stamp the wrong Patch.

## Follow-up

Constraint helpers live in `patchPersistRaces.ts`. Related: `2026-09-05-canvas-draft-vs-db-save.md`.

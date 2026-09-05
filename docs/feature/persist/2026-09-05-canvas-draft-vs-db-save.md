# Canvas draft vs database Save

Date: 2026-09-05
Status: decided

## Context

`PatchWorkspace` seeded a demo USGS and NOAA graph on every boot. Debounced autosave called `patch.replaceGraph` while the user edited an open Patch. That mixed sketching, refresh, and database save.

## Decision

Boot with no hard-coded demo graph. Restore a user-keyed browser draft when one exists. Otherwise start empty, same as New. Edits update the browser draft only. Explicit Save and Save As alone write the graph to the database. Debounced database autosave is removed. Library open loads from the database and replaces the working draft. Refresh restores the current draft. New clears the draft. Sign-out blanks the live canvas and keeps that user’s stored draft. Multi-tab uses last browser draft write wins. Save still uses `expectedVersion` conflicts.

Constraint surface: `client/src/persist/canvasDraft.ts` and `canvasDraft.test.ts`. React Flow and tRPC wiring are not done yet.

## Why

Sketching must feel local until Save. A refresh must not resurrect the demo seed. The database stays the durable Patch store.

## Follow-up

Wired in `usePatchPersist`, `PatchWorkspace`, and AppShell sign-out. See this entry for the decision.

# Unlisted share link

Date: 2026-09-25
Status: decided

## Context

A Patch belongs to one User. `patchGet` and `patchList` read only that User's rows. The product doc names a public read-only share link as later work. Co-editing one canvas is out of scope. Surf n Turf is a baked starter, not a share of a saved Patch.

## Decision

A saved Patch can carry one share token. A share token is an unguessable id, separate from the Patch id. Anyone with `/share/:token` can play the latest saved graph. A signed-in person can save a copy as a new Patch they own. Stop sharing or Delete clears the token. Publish and revoke do not change `Patch.version`. The pure rules live in `client/src/persist/shareSession.ts`. The constraint tests live in `client/src/persist/shareSession.test.ts`.

## Why

One token keeps private Patch ids private. A copy keeps ownership on `userId`, so the existing save path still applies. Leaving `version` unchanged keeps an open canvas autosave from fighting Share.

## Follow-up

Application code waits for approval of these tests. The next step is the Clay field and the four commands `publishShare`, `revokeShare`, `getByShareToken`, and `copyFromShare`. Postgres checks that need a database are not in this slice.

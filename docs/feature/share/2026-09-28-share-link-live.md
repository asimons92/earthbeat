# Share link is live

Date: 2026-09-28
Status: decided

## Context

The share rules in `client/src/persist/shareSession.ts` were approved. A Patch still belongs to one User. `patchGet` stays limited to that User.

## Decision

Patch stores an optional `shareToken`. `publishShare` and `revokeShare` change that token and leave `version` unchanged. `getByShareToken` is a public read of the name and graph. `copyFromShare` creates a new Patch for the signed-in User. The route is `/share/:token`. The canvas file action Share comes from the catalog. A shared visit does not write the browser draft or the owner Patch.

## Why

The approved tests already fixed the token, the copy, and the visit. The database and the screen now follow those rules.

## Follow-up

Postgres checks for these commands still need `RUN_DB_TESTS=1`. A later Connector that stores a secret in config must strip that field before `getByShareToken` returns the graph.

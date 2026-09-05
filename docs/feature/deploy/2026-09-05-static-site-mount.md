# Railway one-service build

Date: 2026-09-05
Status: decided

## Context

The one-service Railway layout was decided in `2026-09-05-one-railway-service.md`. Constraint tests in `server/src/staticSite.test.ts` were approved.

## Decision

`server/src/staticSite.ts` classifies `/api` versus SPA paths and resolves the Vite `client/dist` directory. Express mounts `express.static` and an SPA `index.html` fallback only when that directory resolves (production, or `CLIENT_DIST`). Root `pnpm build` builds client then server. Root `pnpm start` runs the server. `railway.toml` sets those build and start commands.

## Why

Same-origin static plus `/api` matches the relative client URLs. Keeping static off in development leaves the Vite proxy path unchanged.

## Follow-up

On Railway, add a Postgres plugin and set `DATABASE_URL`, `AUTH_MODE`, and related auth secrets. Optional `CLIENT_DIST` overrides the default `../client/dist` path from the server package cwd.

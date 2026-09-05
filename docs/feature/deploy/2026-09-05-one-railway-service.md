# One Railway service

Date: 2026-09-05
Status: decided

## Context

Earthbeat is a pnpm workspace with a Vite client and an Express server. The client calls relative `/api` paths through the Vite dev proxy. Local Postgres already runs via `docker-compose.yml`. There was no production host layout yet.

## Decision

The first Railway deploy is one service. That service builds the client and the server, then Express serves `client/dist` and keeps `/api` for health, auth, tRPC, and the earthquake stream. Railway Postgres supplies `DATABASE_URL`.

## Why

One public origin matches the relative `/api` client wiring and avoids a second CORS origin for the first ship. A later split into a static site plus API stays open if traffic or auth needs it.

## Follow-up

Constraint tests for path classification and client dist resolution live in `server/src/staticSite.test.ts` and wait for human approval before Express mount and root `build` / `start` scripts.

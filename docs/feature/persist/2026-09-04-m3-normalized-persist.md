# M3 normalized Patch persist

Date: 2026-09-04
Status: decided

## Context

M2 made a sounding canvas with in-memory React Flow state. PRD M3 requires save and load for a signed-in User.

## Decision

The saved artifact is a normalized domain graph in Postgres: User, Patch, Connector, Modulator, Oscillator, and Wire. Patch.version supports optimistic concurrency. Patch.replaceGraph replaces all nodes and Wires for one Patch inside a single database transaction. Patches are private to userId. Clay generators emit Drizzle schema, command handlers, and tRPC routers. Hand-written glue is limited to withTransaction, pool, Auth.js, and Express mount.

## Why

Normalized rows match the Clay model and keep mapping on Modulator nodes. Clay-first generation matches the model-driven rule. Transactions match the PRD mutation rule.

## Follow-up

Auth modes: Google OAuth in production, AUTH_MODE=local for development.

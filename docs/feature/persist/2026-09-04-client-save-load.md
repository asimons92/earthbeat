# Client save and load wired

Date: 2026-09-04
Status: decided

## Context

M3 server glue and Clay-generated tRPC were ready. The Vite client still used demo shellPatchTabs.

## Decision

The client uses a tRPC React client against the generated AppRouter. AUTH_MODE=local posts to /api/auth/local on boot. Patch list, create, load, Save, debounced autosave, and version conflict Reload use patch.list, patch.create, patch.get, and patch.replaceGraph. Domain maps through client/src/persist/graphMapper.ts.

## Why

This matches the M3 success path: save a sounding Patch, refresh, restore, and hear it again under a signed-in (or local) user.

## Follow-up

Start Docker Desktop, run docker compose up -d, then pnpm --dir server migrate before exercising save against Postgres. Google Auth.js mounts when AUTH_MODE=google.

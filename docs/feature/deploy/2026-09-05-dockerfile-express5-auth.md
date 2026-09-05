# Dockerfile deploy and Express 5 auth mount

Date: 2026-09-05
Status: decided

## Context

Railway Nixpacks baked service variables into ARG and ENV, which triggered SecretsUsedInArgOrEnv warnings for AUTH_SECRET and Google credentials. After Node 20 fixed the build, the container crashed because Express 5 rejects the bare path /api/auth/*.

## Decision

Build with a repo Dockerfile on Node 20 that never declares auth secrets as ARG or ENV. Mount Auth.js at /api/auth/{*authPath}. Railway injects DATABASE_URL and auth secrets only at runtime.

## Why

Dockerfile builds do not auto-copy Railway variables into image layers. Express 5 path-to-regexp requires a named splat.

## Follow-up

Confirm the next Railway deploy stays healthy on /api/health.

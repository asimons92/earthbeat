# Session bootstrap for local and Google

Date: 2026-09-05
Status: decided

## Context

usePatchPersist only POSTed /api/auth/local. That call returns 400 when AUTH_MODE=google, so sessionReady never became true and Save never armed.

## Decision

The client GETs /api/auth/session first. If a user id is present, persist is ready. If authMode is local and there is no user, it POSTs /api/auth/local. Otherwise it stays unauthenticated. user.upsertFromAuth is no longer a public tRPC procedure; Auth.js and local bootstrap call the handler in process only.

## Why

Session-first bootstrap works for both auth modes. Removing the public upsert closes an unauthenticated user-row write path.

## Follow-up

Add a Google sign-in control in the shell when AUTH_MODE=google and the session is empty.

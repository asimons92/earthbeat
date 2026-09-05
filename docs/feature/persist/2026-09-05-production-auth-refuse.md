# Production refuses local auth

Date: 2026-09-05
Status: decided

## Context

Review of unpushed commits found that AUTH_MODE defaults to local. A public Railway host would share one writable user across all visitors.

## Decision

When NODE_ENV=production, the server refuses to start unless AUTH_MODE=google and AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET are set. Development keeps AUTH_MODE=local.

## Why

A shared local user on a public host breaks Patch privacy. The refuse-to-start rule matches the earlier journal that Google is for production and local is for development.

## Follow-up

Set Railway env to AUTH_MODE=google plus secrets before the first production deploy. Client Google sign-in UI stays a later task.

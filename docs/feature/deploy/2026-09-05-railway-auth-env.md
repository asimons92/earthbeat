# Railway production auth env

Date: 2026-09-05
Status: decided

## Context

The one-service Railway deploy ships with NODE_ENV=production. Local auth must not run on that host.

## Decision

Railway must set AUTH_MODE=google, AUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET. The server exits on boot if production still uses local auth.

## Why

Production refuse-to-start for local auth is the hard gate from the persist auth review.

## Follow-up

Configure the Google OAuth callback to the Railway public origin.

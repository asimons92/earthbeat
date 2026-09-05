# Session route before Auth.js mount

Date: 2026-09-05
Status: decided

## Context

After the Google sign-in chrome shipped, production still hid the button. /api/health reported authMode google, but /api/auth/session returned Auth.js Bad request. The client left authMode at the default local, so decideAuthChrome stayed hidden.

## Decision

Register /api/auth/session and /api/auth/local before the Auth.js /api/auth/{*authPath} mount. If session still fails, the client reads authMode from /api/health so Sign in can appear.

## Why

Express matches routes in registration order. Auth.js owned every /api/auth path and blocked the Earthbeat session payload the shell needs.

## Follow-up

Hard refresh after the next deploy and confirm Sign in with Google appears.

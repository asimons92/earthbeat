# Auth.js mount without Express 5 splat

Date: 2026-09-05
Status: decided

## Context

Sign in with Google failed at CSRF load. Logs showed UnknownAction for /api/auth/csrf and env-url-basepath-redundant. The Express 5 mount /api/auth/{*authPath} broke @auth/express getBasePath, which expects classic mount path semantics.

## Decision

Mount Auth.js with app.use('/api/auth', ...) after the custom /session and /local routes. Keep AUTH_URL as the public origin only, with no /api/auth path. Callback remains {AUTH_URL}/api/auth/callback/google.

## Why

@auth/express rewrites basePath from req.baseUrl and req.params[0]. A named splat made action parsing use the full path and return Bad request for csrf, providers, and signin.

## Follow-up

On Railway, confirm AUTH_URL is https://earthbeat-production.up.railway.app with no path suffix, then retry Sign in.

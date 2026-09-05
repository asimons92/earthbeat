# Google sign-in shell control

Date: 2026-09-05
Status: decided

## Context

Production AUTH_MODE=google left sessionReady false with no way to start OAuth. Save only showed an alert.

## Decision

catalog.shell.authActions defines Sign in with Google and Sign out labels and Auth.js paths. The shell shows Sign in when authMode is google and the session is empty, and Sign out when signed in. The client POSTs with a CSRF token from /api/auth/csrf. Auth.js trustHost is enabled for Railway proxy hosts.

## Why

Users need a visible control to create a Google session before Patch persist works.

## Follow-up

Make sure AUTH_URL and the Google redirect URI match the Railway public origin.

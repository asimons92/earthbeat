# Server persist (M3)

## Postgres

Start Docker Desktop, then from the repo root run:

```
docker compose up -d
```

Copy `.env.example` to `.env` when you need local values. Default database URL is `postgres://earthbeat:earthbeat@localhost:5432/earthbeat`.

Create tables:

```
pnpm --dir server migrate
```

## Auth

`AUTH_MODE=local` (default in development) seeds one development user and does not need Google credentials.

`AUTH_MODE=google` mounts Auth.js at `/api/auth/*`. Set `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Google callback URL: `{origin}/api/auth/callback/google`.

When `NODE_ENV=production`, the server refuses to start unless `AUTH_MODE=google` and those secrets are set.

## API

tRPC lives at `/api/trpc` (Clay-generated router). USGS SSE stays at `/api/earthquakes/stream`.

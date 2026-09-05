# M2 USGS runtime and deferred Patch clock

Date: 2026-09-04
Status: decided

## Context

The canvas shell had a seeded Connector, Modulator, and Oscillator with stub Play controls. PRD milestone M2 is end-to-end sonification. Sibling PoC `earthbeat` used Express SSE and Elementary sine.

## Decision

M2 uses a thin Express `server/` that polls the USGS all_day GeoJSON feed and streams samples over SSE. The client keeps one shared EventSource while any Oscillator is playing. One Patch-level Elementary WebRenderer runs one sine voice per Oscillator. Incomplete upstream chains play resting Oscillator params. Complete chains apply linear Modulator mapping. Poll and playback rates come from catalog defaults (60000 ms, 4 Hz). Postgres, auth, tRPC, and Clay command codegen stay for M3.

Per-Oscillator Play and master Play or Stop control transport. LIVE turns on after a connected stream delivers at least one sample. Feed failures fall back to resting tone with reconnect backoff.

## Why

Server-mediated feeds match the PRD and avoid browser CORS and rate-limit issues. Shared stream and catalog rates keep the first cut small. Resting tone makes Play useful before the graph is fully wired.

## Follow-up

Future: Patch tempo toggle and option to quantize Connectors to a Patch clock. That will likely need a Patch transport state machine. Do not build it in M2.

Future waveforms: square, saw, noise. M2 is sine only.

Related: `docs/PRD.md` section 12.

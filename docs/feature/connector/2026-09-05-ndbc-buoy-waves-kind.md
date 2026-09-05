# NDBC buoy waves ConnectorKind

Date: 2026-09-05
Status: active

## Context

The catalog had USGS quakes (sparse events) and NOAA tides (slow continuous envelope). The next source needed mid-tempo musical motion. NDBC buoy waves expose significant wave height and dominant period from a public text feed.

## Decision

Seed `ndbc_buoy_waves` in `catalog.connectorKinds` with default station `46026`, modulatable channels `waveHeight` and `wavePeriod`, display channels `time` and `stationId`, and `defaultConfig.interpolate: true`. Live poll and scrub run on the server. SSE is `GET /api/waves/stream`. The client opens one EventSource per kind through `STREAM_BY_KIND`. Station picker stays out of scope.

## Why

Wave height and period sit in a musical mid range between quake hits and tide envelopes. Station `46026` stays near the San Francisco tides default so dual ocean patches stay coherent. A dedicated stream path matches the USGS and NOAA pattern without a generalized connector stream rewrite.

## Follow-up

Buoy picker and per-node poll overrides remain open. A shared scrub helper for tides and waves can wait. Related runtime note: `../runtime/2026-09-05-ndbc-wave-scrub-stream.md`.

# SWPC solar wind scrub stream

Date: 2026-09-22
Status: decided

## Context

`swpc_solar_wind` needs the same live path as NDBC waves. The server polls an external series. The client scrubs that series into a slow loop and fans samples to Oscillators by `kindKey`.

## Decision

`SolarWindStream` polls the RTSW wind file and the RTSW mag file about every 60 seconds. `mapSwpcSolarWind` joins active rows on UTC `time_tag` and `source`, drops null or non-finite speed, density, or Bz, and keeps about 24 hours. A timestamp with no offset is read as UTC. Each tick emits `series` on `GET /api/solar-wind/stream` behind the shared SSE connection gate. A failed fetch, an HTTP 429, or a join with zero rows keeps the previous series. The client samples `speed`, `density`, and `bz` with the same step and interpolate pair as tides and waves. The Connector Smooth control shows when the catalog kind has a boolean `defaultConfig.interpolate`.

## Why

One-minute samples need time compression to feel musical. A 120 second loop matches the tide envelope. Dual step and lerp values keep the Smooth control consistent with the ocean kinds. Per-kind SSE stays in place. A shared connector stream route stays deferred.

## Follow-up

Catalog seed: `../connector/2026-09-22-swpc-solar-wind-kind.md`.

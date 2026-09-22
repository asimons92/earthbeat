# SWPC solar wind ConnectorKind

Date: 2026-09-22
Status: decided

## Context

The catalog had USGS quakes, NOAA tides, and NDBC waves. The next source is space weather. NOAA SWPC retired the old `products/solar-wind` JSON files. The live files are the one-minute RTSW feeds.

## Decision

Seed `swpc_solar_wind` in `catalog.connectorKinds` with label Solar Wind. Modulatable channels are `speed` (`proton_speed`), `density` (`proton_density`), and `bz` (`bz_gsm`), in that order. Display channels are `time` and `source`. `defaultConfig` names `rtsw_wind_1m.json` and `rtsw_mag_1m.json` and sets `interpolate` true. `defaultLoopSeconds` is 120. `defaultPollIntervalMs` is 60000. The server keeps a row only when `active` is true and the wind source matches the magnetometer source. SSE is `GET /api/solar-wind/stream`. Spacecraft choice stays on the feed `active` flag.

## Why

Speed, density, and Bz give three different musical motions from one public feed with no API key. Speed is the first channel, so a new Wire autofills speed onto frequency. The RTSW files replace the retired seven-day products, which now return 404.

## Follow-up

A spacecraft picker stays out of scope. Surf N Turf does not gain a fourth voice. Related runtime note: `../runtime/2026-09-22-swpc-solar-wind-scrub-stream.md`.

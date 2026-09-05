# NOAA CO-OPS tides ConnectorKind

Date: 2026-09-05
Status: decided

## Context

The catalog had one ConnectorKind, `usgs_earthquakes`. M4 needs a second source. The product chose NOAA CO-OPS tides over solar flare data. API docs: https://api.tidesandcurrents.noaa.gov/api/prod/

## Decision

Seed `noaa_coops_tides` in `catalog.connectorKinds` with product `water_level`, default station `9414290`, and channels `waterLevel` (modulatable), `time`, and `stationId`. Default poll interval is 360000 ms. Instance defaults for station and product live in `defaultConfig` for a future poller. This pass ships catalog plus Connector Library UI only. There is no live poll or SSE yet.

## Why

CO-OPS water level matches the existing Tides palette category and gives a clear second natural-signal story. Catalog registration first keeps multi-kind UI honest without blocking on a new stream path.

## Follow-up

Add a server poller and sample stream for CO-OPS, then wire Elementary like USGS. Station picker UI stays out of scope until the poller exists. Related shell nav: `../shell/2026-09-05-nav-items-and-libraries.md`.

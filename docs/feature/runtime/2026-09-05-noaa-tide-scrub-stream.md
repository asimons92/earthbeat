# Live NOAA tide scrub stream

Date: 2026-09-05
Status: decided

## Context

`noaa_coops_tides` existed only as a catalog and library entry. USGS used a fast event queue over `/api/earthquakes/stream`. The product goal is one USGS chain and one NOAA chain playing at once, with NOAA as a slow tidal envelope rather than random bleeps.

## Decision

The server polls CO-OPS `water_level` about every six minutes for station `9414290`, keeps about 24 hours of points, and scrubs that series so one day loops in about 120 seconds at 1 Hz with linear interpolation. SSE is `GET /api/tides/stream`. USGS samples now include `kindKey: usgs_earthquakes`. The client opens one EventSource per ConnectorKind on the graph and applies each sample only to oscillators whose modulation chain matches that kind. The demo seed includes both chains.

## Why

Separate streams keep kind envelopes independent. Slow scrub matches tide rhythm without waiting on real time. Six-minute polls respect CO-OPS throttling guidance.

## Follow-up

Station picker and per-node config stay open. A generalized `/api/connectors/:kindKey/stream` can wait for a third source. Related catalog seed: `../connector/2026-09-05-noaa-coops-tides-kind.md`.

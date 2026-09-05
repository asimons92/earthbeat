# NDBC wave scrub stream

Date: 2026-09-05
Status: active

## Context

`ndbc_buoy_waves` needed the same live path as NOAA tides: poll an external series, scrub it into a slow audible loop, and fan samples to Oscillators by `kindKey`.

## Decision

`WaveStream` polls `https://www.ndbc.noaa.gov/data/realtime2/46026.txt` about every thirty minutes, keeps about 48 hours of rows with finite WVHT and DPD, and scrubs that series so one window loops in about 90 seconds at 1 Hz. Each tick emits interpolated and step values for `waveHeight` and `wavePeriod`. SSE is `GET /api/waves/stream` behind the shared SSE connection gate. The Connector Smooth toggle picks interpolated versus step on the client, same as tides.

## Why

Hourly buoy samples need time compression to feel musical. Dual step and lerp values keep Smooth behavior consistent with NOAA tides without changing USGS event playback.

## Follow-up

Generalized `/api/connectors/:kindKey/stream` stays deferred. Catalog seed: `../connector/2026-09-05-ndbc-buoy-waves-kind.md`.

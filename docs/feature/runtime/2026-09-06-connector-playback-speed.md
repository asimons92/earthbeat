# Connector playback speed

Date: 2026-09-06
Status: decided

## Context

Live ConnectorKinds share one process-wide SSE tempo. Patches using USGS Quakes, NOAA Tides, or NDBC Waves therefore sound alike. Domain already had unused `playbackHz` on Connector. Smooth interpolate showed per-node config on a shared feed.

## Decision

Add per-Connector `playbackSpeed` (unitless, default 1, clamp 0.25 to 16). Server polls and pushes series or queue snapshots over SSE; it stops sample tick timers. Client owns tempo: ocean kinds scrub with `defaultLoopSeconds / speed`; USGS paces with `defaultPlaybackHz * speed`. Voices key samples by Connector id. Stop freezes phase or cursor; series refresh keeps phase. Monitor stays one strip per kind and Channel at speed 1. Catalog exposes `defaultLoopSeconds` for tides and waves. Leave legacy `playbackHz` unused for now.

## Why

A multiplier is one control for all kinds. Client clocks let two nodes of the same kind diverge without reconnect fights. Monitor at default tempo stays readable when many Connectors run.

## Follow-up

Shipped: client-owned clocks, SSE `series`/`queue` snapshots, Connector `playbackSpeed` field, catalog `defaultLoopSeconds`, Monitor at speed 1. Constraint tests under `client/src/runtime/playbackSpeed.test.ts`, `connectorClock.test.ts`, and `connectorSamples.test.ts`.

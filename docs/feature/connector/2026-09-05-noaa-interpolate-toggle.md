# NOAA smooth interpolate toggle

Date: 2026-09-05
Status: decided

## Context

The NOAA tide scrub always linear-interpolated between adjacent water-level points. Users want a Connector control to choose smooth lerp or stepped holds.

## Decision

The tide SSE sample includes both `waterLevel` (lerped) and `waterLevelStep` (nearest point). NOAA Connector nodes carry `interpolate` (default true from catalog `defaultConfig`). The inspector shows a Smooth interpolate checkbox for `noaa_coops_tides` only. Voice resolve uses step when interpolate is off. The flag persists in Connector `config`.

## Why

Sending both values on one shared stream keeps per-node toggles without reconnecting SSE.

## Follow-up

USGS smoothing stays out of scope. Related live scrub: `../runtime/2026-09-05-noaa-tide-scrub-stream.md`.

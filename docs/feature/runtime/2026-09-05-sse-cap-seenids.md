# SSE connection cap and seenIds prune

Date: 2026-09-05
Status: decided

## Context

The USGS earthquake SSE endpoint was open with no connection cap. EarthquakeStream.seenIds grew without bound across daily feed cycles.

## Decision

The stream stays public. Concurrent /api/earthquakes/stream clients are capped (64). Over the cap returns 503. After each successful USGS refresh, seenIds drops ids that are neither in the latest feed nor in the playback queue.

## Why

USGS data is public, so auth adds little. Caps and prune stop listener and memory growth on a busy host.

## Follow-up

Tune the cap from metrics if Railway traffic needs a different limit.

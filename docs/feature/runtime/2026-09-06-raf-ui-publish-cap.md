# Frame loop publishes UI on a cap

Date: 2026-09-06
Status: decided

## Context

Per-Connector tempo advances on `requestAnimationFrame` (browser refresh callback). The first ship also called React `setState` and Monitor history append on every frame. That flooded the UI and filled history in about two seconds.

## Decision

Keep clock advance and voice apply on every animation frame. Coalesce overlapping voice applies so only one run is in flight. Publish React sample readouts at most about every 50 ms. Append Monitor history only when the USGS queue cursor moves or scrub phase crosses a bucket.

## Why

Smooth audio needs the frame clock. React and history do not.

## Follow-up

Helpers and tests live in `client/src/runtime/playbackPublish.ts`. Runtime wiring is in `usePatchRuntime.ts`.

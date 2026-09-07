# Transfer curve anchors sort by ascending X

Date: 2026-09-06
Status: decided

## Context

`transferCurveAnchors` placed knees as `inMin` then `inMax` in that field order. When the user set `inMin` above `inMax`, the SVG polyline walked backward through the slope and drew a Z. `mapRange` already supports inverted input ranges for audio.

## Decision

Place the two knee X values with `Math.min` and `Math.max` of `inMin` and `inMax`, so the polyline always runs left to right. Keep Y from `mapRange` with the original `inMin` and `inMax` so the slope direction still matches the map. Related entry: `2026-09-06-inspector-teach-the-map.md`.

## Why

A teach-the-map plot must show one transfer curve. Ascending X keeps clamp shelves and the linear segment legible when ranges are inverted.

## Follow-up

None.

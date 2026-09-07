# Transfer curve uses locked catalog axes

Date: 2026-09-06
Status: decided

## Context

The first teach-the-map plot padded its axes from the current in and out ranges. When the user moved those knobs, the axes moved with the curve, so the line shape looked almost unchanged.

## Decision

X locks to the selected Channel catalog mapHint (or min and max). Y locks to the selected target `modulationOutMin` and `modulationOutMax`. Soft pad applies to that lock once. The domain expands only when the live range or sample falls outside the padded lock. Related entry: `2026-09-06-inspector-teach-the-map.md`.

## Why

A stable frame makes range edits change the visible slope and clamp shelves. Catalog bounds match the usual mapping world for each Channel and target.

## Follow-up

If a user often maps far outside catalog hints, revisit whether expand-on-overflow feels too loose.

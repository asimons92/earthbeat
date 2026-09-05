# Monitor history respects Connector interpolate

Date: 2026-09-05
Status: decided

## Context

Monitor strip history called `channelFromSample` without the Connector Smooth interpolate flag. With interpolate off, the strip still plotted lerped `waterLevel` while the Modulator used stepped `waterLevelStep`.

## Decision

Each Monitor strip carries `interpolate` from its Connector. `appendSampleToHistory` passes that flag into `channelFromSample`, so the strip plots the same Channel value the Modulator reads.

## Why

The dual Monitor rule is that each strip plots the Channel the Modulator reads. The flag must travel with the strip, not stay only on voice resolve.

## Follow-up

None.

# Clamp audio Effect inspector knobs

Date: 2026-09-05
Status: decided

## Context

Distortion and Delay inspector number fields wrote raw `Number` values into node data. Out-of-range values showed in status while bake clamped later.

## Decision

Drive, Time ms, Feedback, and Mix onChange handlers run through `clampDrive`, `clampTimeMs`, `clampFeedback`, and `clampMix` before `patchEffect`.

## Why

Stored node data and node status must match the legal bake ranges.

## Follow-up

None.

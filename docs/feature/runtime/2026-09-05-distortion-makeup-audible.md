# Distortion makeup was inaudible

Date: 2026-09-05
Status: decided

## Context

Distortion used `tanh(drive * x) / drive`. At normal Oscillator gain about `0.2`, that makeup nearly undoes Drive, so the mix barely changed.

## Decision

Normalize with `tanh(drive * x) / tanh(drive)` instead. Full-scale stays near unity. The soft-clip curve stays audible.

## Why

Dividing by Drive restores the small-signal slope to about 1. Dividing by `tanh(Drive)` keeps the nonlinear shape.

## Follow-up

None.

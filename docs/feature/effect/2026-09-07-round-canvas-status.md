# Round Effect audio knobs on the canvas

Date: 2026-09-07
Status: decided

## Context

Distortion and Delay inspector knobs write long floats into Effect node data. Status lines showed those raw numbers. Oscillator and Modulator already round for display.

## Decision

Round Drive to one decimal, Time ms to whole milliseconds, and Feedback and Mix to two decimals via `roundDrive`, `roundTimeMs`, `roundFeedback`, and `roundMix`. Knob commits store the rounded values after clamp. `effectStatusLine` formats with those rounders. Effect nodes rebuild status from data unless the line is an audio FX issue (` — dry`).

## Why

Rounding matches each Effect knob readout and keeps canvas status readable.

## Follow-up

Related: `../oscillator/2026-09-07-round-canvas-hz.md`, `../modulator/2026-09-07-round-canvas-status.md`.

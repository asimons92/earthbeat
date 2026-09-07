# Round Oscillator Hertz on the canvas

Date: 2026-09-07
Status: decided

## Context

Log Frequency knobs write long floats into `frequencyHz`. Oscillator nodes showed that raw value in `status` as `… Hz`.

## Decision

Round Hertz to one decimal in `roundFrequencyHz` / `formatOscillatorHzStatus`. Frequency knob commits store the rounded value. Oscillator nodes reformat any status that ends with ` Hz` from `frequencyHz` so old float status strings stay clean. Load and create paths use the same formatter.

## Why

One decimal matches the Frequency knob readout and keeps canvas status readable.

## Follow-up

Related: `../shell/2026-09-06-inspector-rotary-knobs-shipped.md`.

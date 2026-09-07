# Round Modulator map bounds on the canvas

Date: 2026-09-07
Status: decided

## Context

Inspector knobs write long floats into Modulator in and out bounds. Node status showed those raw numbers. Oscillator Hertz already rounds for display.

## Decision

Round Modulator bounds to two decimals in `roundModulatorValue` / `formatModulatorStatus`. Knob commits store the rounded values. Modulator nodes reformat any status that contains `→` from the numeric bounds. Autofill, load, and inspector status use the same formatter. Ratio marks (`×`) appear only when the target is Frequency.

## Why

Two decimals match the Modulator knob readout and keep canvas status readable.

## Follow-up

Related: `../oscillator/2026-09-07-round-canvas-hz.md`.

# Oscillator waveforms square saw noise

Date: 2026-09-05
Status: decided

## Context

M2 shipped sine only. The Oscillator inspector showed waveform as read-only text. The Elementary voice always built phasor plus sin.

## Decision

Oscillator.waveform enum is sine, square, saw, and noise. Clay emits `oscillatorWaveforms` for the inspector Select. Square and saw use `el.blepsquare` and `el.blepsaw`. Noise uses `el.noise` and ignores frequencyHz for the audible source. Changing waveform on a playing voice rebuilds that voice. Default stays sine.

## Why

Users need more tone shapes for sonification without new node types. Band-limited blep oscillators keep audio-rate square and saw usable. White noise stays simple and still stores frequency for when the user switches back to a pitched shape.

## Follow-up

None for this milestone. Triangle, colored noise, and modulatable waveform stay out of scope.

Supersedes the “Future waveforms” note in `docs/feature/runtime/2026-09-04-m2-usgs-elementary.md`.

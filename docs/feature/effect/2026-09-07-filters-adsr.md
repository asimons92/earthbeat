# Filters and ADSR Effects

Date: 2026-09-07
Status: decided

## Context

Ambient patches need sharper, hit-like shapes without drums or MIDI. Elementary ships lowpass, highpass, bandpass, and ADSR.

## Decision

Add audio EffectKinds `lowpass`, `highpass`, `bandpass`, and `adsr`. Filters use Cutoff Hz and Q. ADSR uses Attack, Decay, Sustain, Release, and Gate. Defaults favor short hits with Gate at 0 until a Modulator opens it. Persist new fields on the shared Effect row.

## Why

The product stays inside natural-signal sound design. Envelopes need an explicit gate, not audio loudness.

## Follow-up

Modulator maps onto Effect params over the Effect mod handle. Live FX knobs use Elementary const refs.

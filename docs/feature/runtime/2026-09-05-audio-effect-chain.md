# Audio Effect chain in Elementary

Date: 2026-09-05
Status: superseded

Superseded by `2026-09-05-catalog-audio-fx-and-issue-cue.md` for catalog audio detection and illegal-chain canvas status. Empty-chain bake on failure and fingerprint rebuild stay.

## Context

Scale Snap changes Hertz in JavaScript before `setFrequency`. Distortion and Delay must change the Elementary tone after the Oscillator.

## Decision

Resolve each Oscillator outbound audio Effect chain in source-to-sink order. Bake the chain into `voice.tone` after gain. Rebuild the voice when waveform or FX fingerprint changes. Frequency and gain still use refs. Illegal fan-in or fan-out yields an empty chain for that voice.

## Why

Outbound audio topology is separate from inbound control walks. Baking keeps the mix a sum of finished voice tones.

## Follow-up

Use Elementary refs for live FX knobs if rebuild clicks. Shared Effect nodes across Oscillators stay deferred.

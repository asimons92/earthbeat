# Noise gain skips unmounted frequency ref

Date: 2026-09-05
Status: decided

## Context

A Modulator targeting Oscillator gain on a noise voice left amplitude at the resting gain. Live apply always called `setFrequency` before `setGain`. Noise builds `el.noise()` and never mounts the frequency `createRef`, so Elementary threw on the unmounted ref and gain never updated.

## Decision

`planVoiceParamApply` omits frequency when the waveform is frequency-independent. `usePatchRuntime` applies that plan before pushing refs. `audioEngine.setFrequency` also no-ops for unpitched waveforms as a second guard.

## Why

Gain modulation must reach the mounted gain ref even when frequency is unused. Skipping the dead frequency update keeps sample-driven amplitude working for noise.

## Follow-up

None for this fix. Envelope-style percussion (decay after each sample) stays out of scope.

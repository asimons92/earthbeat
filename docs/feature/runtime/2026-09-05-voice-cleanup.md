# Remove voices when Oscillators leave the graph

Date: 2026-09-05
Status: decided

## Context

Elementary voices stayed in the mix after a playing Oscillator was deleted from the canvas.

## Decision

planVoiceCleanup computes stop and remove sets. usePatchRuntime stops playing ids missing from the graph and calls audioEngine.removeVoice for every engine voice whose Oscillator is gone.

## Why

Dead tones must not keep sounding after the graph no longer contains that Oscillator.

## Follow-up

None.

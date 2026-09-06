# Oscillator title follows waveform

Date: 2026-09-05
Status: decided

## Context

New Oscillators hard-coded the canvas title as `Sine Tone`. Changing waveform in the inspector left that title unchanged, so the node name and the selected shape could disagree.

## Decision

`oscillatorLabel` builds the canvas title from the catalog `oscillatorWaveforms` entry for the selected key. Create and waveform change both call it. Numbering matches Connectors: the first Oscillator uses the bare label, later ones append a count.

## Why

The title is the only shape cue on the canvas when the inspector is closed. Catalog labels keep the UI model-driven and avoid a second hand-written name list.

## Follow-up

Related: `docs/feature/runtime/2026-09-05-oscillator-waveforms.md`.

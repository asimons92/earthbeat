# Inspector rotary knobs shipped

Date: 2026-09-06
Status: decided

## Context

Constraint tests for knob travel math were approved. Inspectors still used number inputs.

## Decision

Ship `knobValue.ts` (clamp, linear and log maps, norm nudge), a hand-built `Knob` ARIA slider with vertical drag and arrow keys, and wire it through `NodeInspector` for Connector playback speed, Modulator in or out bounds, Oscillator Frequency (log) and Gain, and audio Effect Drive, Time, Feedback, and Mix. Catalog or Effect clamp ranges lock travel. Modulator knobs stay disabled until channel or target locks exist.

## Why

Matches the agreed inspector instrument controls without a third-party knob package.

## Follow-up

Related decision: `2026-09-06-inspector-rotary-knobs.md`.

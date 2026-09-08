# Modulator to Effect params

Date: 2026-09-07
Status: decided

## Context

ADSR gate and other Effect knobs need Channel maps. Modulators only targeted Oscillator params.

## Decision

Allow Modulator wires into Effect handle `mod`. Signal path stays on handle `in`. Every continuous numeric Effect param is modulatable. Scale Snap tonic and scale stay inspector-only. Autofill target lists come from the wired Effect kind.

## Why

Pulse-style maps on Gate keep rhythm tied to natural signals. A separate mod handle keeps the one-inbound audio chain rule intact.

## Follow-up

None for this milestone.

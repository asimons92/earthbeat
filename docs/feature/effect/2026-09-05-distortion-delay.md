# Distortion and Delay Effects

Date: 2026-09-05
Status: decided

## Context

Scale Snap is a control Effect on the path into an Oscillator. Users also need audible saturation and echo. Elementary provides soft clip (`el.tanh`) and feedback delay (`el.delay`).

## Decision

Keep one Effect noun and Effect Library. Add `distortion` and `delay` EffectKinds with `transforms: ["audio"]`. Wire them Oscillator → audio Effect → audio Effect. Scale Snap stays on Modulator → Oscillator. Distortion uses Enable and Drive. Delay uses Enable, Time ms, Feedback, and Mix. Persist new fields on the same Effect row. Reject audio Effect fan-in and multi outbound audio chains for this milestone.

## Why

Audio FX and Hertz snaps are different jobs but share catalog discoverability. Elementary already ships the DSP primitives.

## Follow-up

Richer fan-in and fan-out. Reverb. Modulator → Effect param wires. Model-driven Zod for other graph node schemas besides Effect.

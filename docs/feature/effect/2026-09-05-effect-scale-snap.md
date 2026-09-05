# Effect node and Scale Snap

Date: 2026-09-05
Status: decided

## Context

Users need musical key without MIDI. Patch-level key was rejected in favor of a canvas Effect that snaps Hertz after Modulator mapping.

## Decision

Effect is a first-class canvas node. The first EffectKind is `scale_snap`. It stores tonic, named scale, enable (pedal bypass), and A4=440. Ordered Effect chains before an Oscillator are legal. Scale Snap transforms only `frequencyHz`. Gain Modulators wire the Oscillator directly. Monitor strips still plot raw Channel values. Equidistant snap ties round up to the higher pitch. Effect Library lives at `/effects`. Node remove controls ship in the same milestone.

## Why

Data mapping and musical constraint are different jobs. Elementary only takes Hertz, so snap math runs in JS before `setFrequency`.

## Follow-up

More EffectKinds can reuse the chain. Alternate temperaments and Patch-level key stay out of scope.

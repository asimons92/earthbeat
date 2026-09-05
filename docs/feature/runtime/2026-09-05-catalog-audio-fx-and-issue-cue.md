# Catalog-driven audio Effect detection and illegal-chain cue

Date: 2026-09-05
Status: decided

## Context

`isAudioEffectKindKey` compared literal `distortion` and `delay` keys while wire rules used catalog `transforms`. Illegal fan-in or fan-out still baked a dry Oscillator with no canvas cue.

## Decision

Detect audio EffectKinds with `getEffectKind` and `transforms` that include `audio`. Keep Distortion and Delay step builders keyed by kind for Elementary bake only. `audioFxIssueLabelsByNodeId` maps illegal outbound chains to a short status on the Oscillator and reachable audio Effects. `flowNodes` and the inspector show that status. The voice still uses an empty FX chain when resolve fails.

## Why

Wire rules and the FX walker must agree on which EffectKinds are audio. Users need a visible cue when a loaded graph cannot bake FX.

## Follow-up

Bake support for new catalog audio kinds beyond Distortion and Delay.

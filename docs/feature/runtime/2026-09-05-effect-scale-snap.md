# Scale Snap on voice Hertz

Date: 2026-09-05
Status: decided

## Context

Elementary voices take Hertz only. Musical key must apply after Modulator mapping.

## Decision

findVoiceGraph walks Effect chains into each Oscillator. resolveVoiceParams maps frequency and gain as before, then applies enabled Scale Snap Effects in source-to-sink order onto frequencyHz only. Monitor strips still use Channel values and ignore snapped Hertz. Equidistant ties round up.

## Why

Keeps data mapping and musical constraint separate while Elementary stays Hertz-only.

## Follow-up

None.

# Audio FX live refs

Date: 2026-09-07
Status: decided

## Context

Modulated Effect params change every sample. Rebuilding the Elementary graph on each change clicks and is too slow.

## Decision

Bake enabled audio FX steps with const refs for numeric params. Update refs through `setAudioFxParams` each voice tick. Keep the voice FX fingerprint as kind order plus enabled flags only.

## Why

Gate pulses and cutoff maps must move with Connector samples without a full render rebuild.

## Follow-up

Distortion makeup still uses the resting drive number when Drive is a live ref.

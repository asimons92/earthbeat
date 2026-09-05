# Effect fan-in and Scale Snap collection

Date: 2026-09-05
Status: decided

## Context

Backward Effect walks kept one inbound Modulator, so two Modulators into one Effect dropped a chain. Parallel Effect to Oscillator wiring was ignored when a frequency Modulator already wired the Oscillator. Scale degrees were hand-copied beside the Clay catalog. Unknown tonic or scale clamped Hertz. Every Effect kind was treated as Scale Snap.

## Decision

Walk forward from each Modulator through Effects to the Oscillator so shared Effect fan-in keeps every Modulator. Collect every Scale Snap Effect that reaches the Oscillator for frequency snap, including parallel and gain-path Effects. Drive scale degrees and tonics from the generated catalog. Pass through Hertz when tonic or scale is unknown. Ignore Effects whose `kindKey` is not `scale_snap`.

## Why

Wired graphs must modulate and snap as the canvas shows. Catalog and audible intervals must stay one source.

## Follow-up

Related: `../runtime/2026-09-05-effect-scale-snap.md`, `../effect/2026-09-05-effect-scale-snap.md`.

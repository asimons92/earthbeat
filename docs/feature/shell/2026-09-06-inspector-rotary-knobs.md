# Inspector rotary knobs

Date: 2026-09-06
Status: decided

## Context

Connector, Modulator, Oscillator, and Effect inspectors used shadcn `Input type="number"` for numeric parameters. Shadcn has no Knob. Oscillator Frequency (Hz) and Modulator in or out bounds had no inspector min or max. Catalog already lists Oscillator Frequency as 20 to 2000 Hz and Modulator bounds via channel mapHint (or min and max) and target modulationOut.

## Decision

Replace those number fields with a hand-built rotary knob (eggshell instrument control, ARIA slider). Use vertical drag, arrow-key nudges in norm space, and a live numeric readout. Lock each knob travel to catalog or Effect clamp ranges. Map Frequency on a log curve. Keep every other parameter linear. Allow In min to cross In max (and the out pair) so the Modulator map can invert. Pure value math lives in `client/src/components/knobValue.ts` and is proven before the React control.

## Why

Knobs match the instrument surface better than number entries. Catalog locks stop unbounded Frequency and Modulator ranges. Log Frequency keeps the musical middle near mid travel. Independent min and max knobs keep intentional inversion.

## Follow-up

Constraint tests are in `client/src/components/knobValue.test.ts`. Wait for human approval, then implement `knobValue.ts`, the Knob UI, and `NodeInspector` wiring.

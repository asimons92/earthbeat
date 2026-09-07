# Inspector teaches the map first

Date: 2026-09-06
Status: decided

## Context

Modulator mapping lives in input and output range fields on the inspector. Those numbers are hard to read without a picture. Two view jobs were on the table. Teach the map shows the rule that turns Channel values into Oscillator values as a curve or band, like a compressor graph in a DAW. Prove the sound shows the mapped signal over time, like a Monitor strip.

## Decision

Ship teach the map first in the Modulator inspector. The first view shows the transfer curve for the current input and output ranges, with a live Channel sample as a point on that curve when one exists. Frequency targets keep ratio units on the output axis. Prove the sound, a mapped-output time strip in the inspector, stays a later add and is not in the first layout.

## Why

Range fields answer "what do these numbers do?" before they answer "what is happening now?" A curve that moves when the user edits ranges makes the map legible. The bottom Monitor already covers live Channel history for complete chains, so a second time strip can wait.

## Follow-up

When prove the sound ships, add a mapped-output time strip beside or under the transfer curve. Keep edit-time Channel scrub distinct from Play-time live samples. Effects between Modulator and Oscillator can change what the user hears versus what the Modulator draws. Related: `../runtime/2026-09-04-frequency-ratio-modulation.md`, `../monitor/2026-09-05-dual-monitor-viz.md`.

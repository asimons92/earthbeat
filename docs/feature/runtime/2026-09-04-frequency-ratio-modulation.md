# Frequency modulation uses ratio range

Date: 2026-09-04
Status: decided

## Context

Absolute Modulator out ranges (110 to 880 Hz) recentered on the Oscillator base were hard to read. The product need is a range around the baseline.

## Decision

When a Modulator targets frequencyHz, outMin and outMax are multipliers of the Oscillator base frequency (default 0.5× to 4×). Audible Hz equals base times the mapped ratio. Missing channel values keep the base. Gain targets still use absolute out ranges. Catalog and Oscillator field metadata carry `modulationKind` plus default modulation out bounds. Inspector labels say Ratio min and Ratio max for frequency targets.

## Why

Ratios keep the Oscillator frequency as the clear baseline and make the Modulator span easy to reason about.

## Follow-up

Supersedes `2026-09-04-oscillator-base-frequency.md`.

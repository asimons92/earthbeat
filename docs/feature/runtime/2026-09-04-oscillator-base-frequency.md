# Oscillator frequency as audible base

Date: 2026-09-04
Status: superseded

## Context

M2 mapped Modulator outMin/outMax straight onto Oscillator frequency. The Oscillator frequencyHz field then did not change pitch while USGS samples drove frequency.

## Decision

Oscillator frequencyHz is the audible base. When a Modulator targets frequencyHz, the mapped out range is recentered on that base: audible Hz equals base plus (mapped absolute Hz minus the midpoint of outMin and outMax). A missing channel value keeps the base. Gain modulation still leaves frequency at the Oscillator base.

## Why

The Frequency control on the Oscillator must retune the tone even while the live feed is modulating pitch.

## Follow-up

Superseded by `2026-09-04-frequency-ratio-modulation.md`.

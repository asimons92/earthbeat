# Dual Monitor signal strips and audio scope

Date: 2026-09-05
Status: superseded

Superseded by `2026-09-05-dedupe-strips-by-kind-channel.md` for strip count and strip id. Audio scope and incomplete-chain rules stay.

## Context

The Monitor under the canvas showed a hard-coded sine SVG and a fake elapsed time. Play already streams USGS and NOAA samples and drives Elementary voices.

## Decision

While Play is on, the Monitor shows one strip per complete Connector to Modulator chain. Each strip plots the Channel the Modulator reads, scaled with that Modulator inMin and inMax, from a ring buffer of 120 points. A shared audio scope sits beside the strips and draws the Elementary mix through a Web Audio AnalyserNode. Elapsed time starts when the first Oscillator in the session begins Play.

Incomplete chains do not get a strip. Strip id is the Modulator node id.

## Why

The product story is natural data to sound. Side by side Channel history and the audible waveform make that link visible without a second surface.

## Follow-up

FFT display stays out of scope. Station picker stays out of scope.

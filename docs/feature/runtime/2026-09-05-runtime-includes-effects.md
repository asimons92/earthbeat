# Runtime includes Effect nodes

Date: 2026-09-05
Status: decided

## Context

Scale Snap did not change audible Hertz. Monitor strips vanished for chains that ran through an Effect. toRuntimeNodes dropped `effect` nodes before findVoiceGraph and listMonitorStrips ran.

## Decision

toRuntimeNodes keeps connector, modulator, effect, and oscillator. resolveVoiceParams reads samples by Connector kindKey so frequency and gain chains can use different feeds. applySamplesToVoices passes the full samples-by-kind map.

## Why

Effect chains only work when Effect nodes exist in the runtime graph.

## Follow-up

If you delete an Oscillator, incident Wires leave with it. Rewire Modulator or Effect into a new Oscillator for that strip to return.

# Effects in replaceGraph

Date: 2026-09-05
Status: decided

## Context

Patch.replaceGraph saved Connector, Modulator, Oscillator, and Wire only.

## Decision

replaceGraph and PatchWithGraph include an `effects` array. Postgres has an `effects` table. graphMapper round-trips Effect canvas nodes.

## Why

Effects are first-class domain nodes and must survive save and load with the rest of the Patch graph.

## Follow-up

None.

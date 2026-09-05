# Persist Effects in replaceGraph client calls

Date: 2026-09-05
Status: decided

## Context

Client saveNow, createPatch, and loadPatch omitted the `effects` array after Effect landed in the API. replaceGraph requires `effects`, so Patch create from the Effect Library could throw before addEffect ran, and saves dropped Effect nodes.

## Decision

usePatchPersist sends and loads `effects` with the rest of the graph. Effect and Connector library Add actions still place the node if create fails.

## Why

Effects must round-trip with the Patch or Add to canvas never finishes for signed-in users.

## Follow-up

None.

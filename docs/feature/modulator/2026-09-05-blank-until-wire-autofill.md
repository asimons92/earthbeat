# Blank Modulator until wire autofill

Date: 2026-09-05
Status: decided

## Context

`addModulator` in `client/src/workspace/PatchWorkspace.tsx` copied `modulatorDefaults` (`mag` → `frequencyHz`) at create time. The inspector already hid Channel until a Connector wire existed, so new nodes looked mapped before any wire.

## Decision

New Modulators use `blankModulatorData` with empty `channelKey` and `targetParam`. On connect, `autofillModulatorChannel` and `autofillModulatorTarget` in `client/src/catalog/modulatorMapping.ts` fill the first modulatable option when the key is empty or invalid for the wired side. A still-valid key stays put. Disconnect does not clear mapping. Runtime chains skip empty keys instead of falling back to `mag` / `frequencyHz`.

## Why

Create must stay unmapped until the graph gives a Connector and Oscillator context. Autofill on wire gives a usable start without inventing USGS magnitude on every new node.

## Follow-up

Catalog `modulatorDefaults` remain as documented USGS example bounds. Inspector label lookup still prefers USGS channel labels for manual edits.

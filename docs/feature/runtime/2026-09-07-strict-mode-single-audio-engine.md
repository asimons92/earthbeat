# Strict Mode single audio engine

Date: 2026-09-07
Status: decided

## Context

Stop silenced Oscillators on production but left a resting tone on localhost. React Strict Mode (development only) can double-run a setState updater. The updater had scheduled transport side effects that called ensureEngine twice, so two AudioContext graphs could start and Stop only cleared the one held in the ref.

## Decision

dispatchTransport reduces transport and schedules side effects outside setState. createSingletonAsync shares one in-flight createPatchAudioEngine across concurrent callers and disposes a create that finishes after clear. audioEngine.dispose disconnects the analyser and output node before the async rebuild and context close.

## Why

Localhost must match production Stop silence. One live audio engine must own every Oscillator voice so Stop can clear the mix.

## Follow-up

None.

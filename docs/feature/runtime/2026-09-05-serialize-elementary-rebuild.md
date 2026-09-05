# Serialize Elementary rebuild on Stop

Date: 2026-09-05
Status: superseded

## Context

Stop still left a resting Oscillator tone until refresh. Concurrent core.render calls could commit a stale mix after removeVoice had already rendered silence.

## Decision

audioEngine queues rebuilds on one promise chain. When transport is idle, clearAllVoices drops every voice and commits silence.

## Why

A later stale render must not restore a removed voice after Stop.

## Follow-up

Superseded by `2026-09-05-rebuild-queue-survives-failure.md` for rejected-render handling.

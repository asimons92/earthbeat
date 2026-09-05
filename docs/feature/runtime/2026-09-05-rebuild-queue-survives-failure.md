# Rebuild queue survives render failure

Date: 2026-09-05
Status: decided

## Context

`audioEngine` serialized `core.render` on a promise chain so Stop could not race a stale mix. A rejected render left that chain rejected, so later rebuilds never ran.

## Decision

`enqueueSerialTask` recovers after a rejected task, then runs the next rebuild. Stop can still commit silence after a failed render.

## Why

A single failed render must not leave Elementary playing while the engine thinks it is idle.

## Follow-up

Supersedes the failure mode in `2026-09-05-serialize-elementary-rebuild.md`.

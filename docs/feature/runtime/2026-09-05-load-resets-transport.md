# Load resets transport and purges idle voices

Date: 2026-09-05
Status: decided

## Context

Loading a saved Patch could leave a resting Oscillator tone audible. Play state stayed from the prior graph, and Elementary voices that were not in the playing set survived Stop because Stop only cleared that set.

## Decision

transportEventForPatchLoad emits stopAll. PatchWorkspace calls resetTransportForPatchLoad before loadPatch and conflict reload. planIdleEnginePurge removes every engine voice when transport is idle. planVoiceCleanup also removes any engine voice that is not both on the graph and in the playing set.

## Why

A loaded Patch must start silent. Stop must silence orphans, not only ids that just left the playing set.

## Follow-up

None.

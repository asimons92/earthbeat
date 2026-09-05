# Stop removes Elementary voices

Date: 2026-09-05
Status: decided

## Context

Clicking Stop cleared the shared stream (modulation stopped) but left a resting Oscillator tone audible. Mute via setVoiceAudible lost a race with an in-flight sample apply that unmuted at resting params after samples were cleared.

## Decision

planStoppedVoiceRemoval lists ids that left the playing set. usePatchRuntime calls audioEngine.removeVoice for those ids instead of mute-only. applySamplesToVoices uses filterLiveApplyTargets and canApplyVoice before ensureVoice, param writes, and unmute, and removes a voice if Stop won the race mid-apply.

## Why

Dead tones must not revive at base frequency after Stop. Removing the voice from the Elementary mix is stronger than gain zero when async apply can still run.

## Follow-up

None.

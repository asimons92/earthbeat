import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createPatchTransportState,
  reducePatchTransport,
  shouldHoldSharedStream,
  type PatchTransportEvent,
  type PatchTransportState,
} from './patchTransport';

const oscId = fc.uuid();

function applyAll(state: PatchTransportState, events: PatchTransportEvent[]): PatchTransportState {
  return events.reduce(reducePatchTransport, state);
}

describe('patchTransport', () => {
  it('starts idle with no shared stream', () => {
    const state = createPatchTransportState();
    const emptyCount = state.playingOscillatorIds.size;
    const idleMode = 'idle' as const;
    expect(state.mode).toBe(idleMode);
    expect(emptyCount).toBe(state.playingOscillatorIds.size);
    expect(shouldHoldSharedStream(state)).toBe(emptyCount > 0);
  });

  it('enters streaming when any oscillator plays and returns to idle when none remain', () => {
    fc.assert(
      fc.property(fc.uniqueArray(oscId, { minLength: 1, maxLength: 8 }), (ids) => {
        let state = createPatchTransportState();
        for (const id of ids) {
          state = reducePatchTransport(state, { type: 'play', oscillatorId: id });
          const streaming = 'streaming' as const;
          expect(shouldHoldSharedStream(state)).toBe(state.playingOscillatorIds.size > 0);
          expect(state.mode).toBe(streaming);
          expect(state.playingOscillatorIds.has(id)).toBe(ids.includes(id));
        }
        for (const id of ids) {
          state = reducePatchTransport(state, { type: 'stop', oscillatorId: id });
        }
        const idle = 'idle' as const;
        const remaining = state.playingOscillatorIds.size;
        expect(shouldHoldSharedStream(state)).toBe(remaining > 0);
        expect(state.mode).toBe(idle);
        expect(remaining).toBe(ids.filter((id) => state.playingOscillatorIds.has(id)).length);
      }),
    );
  });

  it('playAll then stopAll is a no-op on the empty playing set', () => {
    fc.assert(
      fc.property(fc.uniqueArray(oscId, { minLength: 0, maxLength: 6 }), (ids) => {
        const state = applyAll(createPatchTransportState(), [
          { type: 'playAll', oscillatorIds: ids },
          { type: 'stopAll' },
        ]);
        const idle = 'idle' as const;
        const cleared = state.playingOscillatorIds.size;
        expect(state.mode).toBe(idle);
        expect(cleared).toBe(ids.filter((id) => state.playingOscillatorIds.has(id)).length);
        expect(shouldHoldSharedStream(state)).toBe(cleared > 0);
      }),
    );
  });

  it('never streams with an empty playing set and never idles with a non-empty set', () => {
    const eventArb: fc.Arbitrary<PatchTransportEvent> = fc.oneof(
      oscId.map((oscillatorId) => ({ type: 'play' as const, oscillatorId })),
      oscId.map((oscillatorId) => ({ type: 'stop' as const, oscillatorId })),
      fc.uniqueArray(oscId, { maxLength: 5 }).map((oscillatorIds) => ({
        type: 'playAll' as const,
        oscillatorIds,
      })),
      fc.constant({ type: 'stopAll' as const }),
    );

    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 40 }), (events) => {
        const state = applyAll(createPatchTransportState(), events);
        const playing = state.playingOscillatorIds.size > 0;
        const expectedMode = playing ? ('streaming' as const) : ('idle' as const);
        expect(state.mode).toBe(expectedMode);
        expect(shouldHoldSharedStream(state)).toBe(playing);
      }),
    );
  });
});

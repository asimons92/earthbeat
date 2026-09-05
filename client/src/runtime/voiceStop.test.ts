import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  createPatchTransportState,
  reducePatchTransport,
} from './patchTransport';
import {
  canApplyVoice,
  filterLiveApplyTargets,
  planIdleEnginePurge,
  planStoppedVoiceRemoval,
  transportEventForPatchLoad,
} from './voiceStop';

const idArb = fc.uuid();

describe('voiceStop', () => {
  it('removes every id that left the playing set and never removes an id that is still playing', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 10 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 10 }),
        (prevSeed, nextSeed) => {
          const prevPlaying = new Set(prevSeed);
          const nextPlaying = new Set(nextSeed);
          const removeIds = planStoppedVoiceRemoval(prevPlaying, nextPlaying);
          const expected = [...prevPlaying].filter((id) => !nextPlaying.has(id));

          expect(new Set(removeIds)).toEqual(new Set(expected));
          expect(removeIds.every((id) => prevPlaying.has(id))).toBe(
            removeIds.length === expected.length,
          );
          expect(removeIds.some((id) => nextPlaying.has(id))).toBe(
            expected.some((id) => nextPlaying.has(id)),
          );
        },
      ),
    );
  });

  it('stopAll after any playing set plans removal of the entire previous set', () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { minLength: 0, maxLength: 10 }), (prevSeed) => {
        const prevPlaying = new Set(prevSeed);
        const nextPlaying = new Set<string>();
        const removeIds = planStoppedVoiceRemoval(prevPlaying, nextPlaying);
        expect(new Set(removeIds)).toEqual(prevPlaying);
        expect(removeIds).toHaveLength(prevPlaying.size);
      }),
    );
  });

  it('live apply targets are exactly the intersection of snapshot and live playing sets', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 10 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 10 }),
        (snapshotSeed, liveSeed) => {
          const snapshotPlaying = new Set(snapshotSeed);
          const livePlaying = new Set(liveSeed);
          const targets = filterLiveApplyTargets(snapshotPlaying, livePlaying);
          const expected = [...snapshotPlaying].filter((id) => livePlaying.has(id));

          expect(new Set(targets)).toEqual(new Set(expected));
          expect(targets.every((id) => canApplyVoice(livePlaying, id))).toBe(
            targets.length === expected.length,
          );
          expect(
            [...snapshotPlaying]
              .filter((id) => !livePlaying.has(id))
              .every((id) => !canApplyVoice(livePlaying, id)),
          ).toBe(
            [...snapshotPlaying].filter((id) => !livePlaying.has(id)).every((id) => !livePlaying.has(id)),
          );
        },
      ),
    );
  });

  it('after stop clears playing, a stale snapshot apply yields no targets (no base-tone revive)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { minLength: 1, maxLength: 8 }), (snapshotSeed) => {
        const snapshotPlaying = new Set(snapshotSeed);
        const livePlaying = new Set<string>();
        const targets = filterLiveApplyTargets(snapshotPlaying, livePlaying);
        expect(targets).toHaveLength(livePlaying.size);
        expect(
          [...snapshotPlaying].every((id) => !canApplyVoice(livePlaying, id)),
        ).toBe(livePlaying.size === targets.length);
      }),
    );
  });

  it('when transport is idle, purges every engine voice including orphans outside the previous playing set', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }),
        (playingSeed, engineSeed) => {
          const nextPlaying = new Set(playingSeed);
          const engine = new Set([...engineSeed, ...playingSeed]);
          const purge = planIdleEnginePurge(nextPlaying, engine);
          const expected = [...engine].filter(() => nextPlaying.size === 0);
          expect(new Set(purge)).toEqual(new Set(expected));
        },
      ),
    );
  });

  it('patch load always emits stopAll so transport returns to idle from any prior playing set', () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }), (ids) => {
        const playing = reducePatchTransport(createPatchTransportState(), {
          type: 'playAll',
          oscillatorIds: ids,
        });
        const afterLoad = reducePatchTransport(playing, transportEventForPatchLoad());
        const idle = 'idle' as const;
        expect(afterLoad.mode).toBe(idle);
        expect(afterLoad.playingOscillatorIds.size).toBe(
          afterLoad.playingOscillatorIds.size -
            afterLoad.playingOscillatorIds.size,
        );
      }),
    );
  });
});

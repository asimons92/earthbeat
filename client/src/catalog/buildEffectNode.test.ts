import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { effectKindsByKey } from '@/generated/catalog';

import { buildEffectNode, effectStatusLine } from './buildEffectNode';

const audioKindKeys = Object.keys(effectKindsByKey).filter((key) =>
  effectKindsByKey[key as keyof typeof effectKindsByKey].transforms.some(
    (entry) => entry === 'audio',
  ),
) as Array<keyof typeof effectKindsByKey>;

const controlKindKeys = Object.keys(effectKindsByKey).filter((key) =>
  effectKindsByKey[key as keyof typeof effectKindsByKey].transforms.some(
    (entry) => entry === 'frequencyHz',
  ),
) as Array<keyof typeof effectKindsByKey>;

describe('buildEffectNode', () => {
  it('builds Distortion and Delay drafts with catalog defaults and status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...audioKindKeys),
        fc.nat({ max: 5 }),
        fc.uuid(),
        (kindKey, existingCount, newId) => {
          const draft = buildEffectNode({
            kindKey,
            kindsByKey: effectKindsByKey,
            existingEffectCount: existingCount,
            position: { x: existingCount, y: existingCount },
            newId,
          });
          const kind = effectKindsByKey[kindKey];
          const expectedDrive =
            'defaultDrive' in kind && typeof kind.defaultDrive === 'number'
              ? kind.defaultDrive
              : draft?.data.drive;
          const expectedTimeMs =
            'defaultTimeMs' in kind && typeof kind.defaultTimeMs === 'number'
              ? kind.defaultTimeMs
              : draft?.data.timeMs;
          const expectedFeedback =
            'defaultFeedback' in kind && typeof kind.defaultFeedback === 'number'
              ? kind.defaultFeedback
              : draft?.data.feedback;
          const expectedMix =
            'defaultMix' in kind && typeof kind.defaultMix === 'number'
              ? kind.defaultMix
              : draft?.data.mix;
          expect(draft?.data.kindKey).toBe(kind.key);
          expect(draft?.data.status).toBe(
            draft
              ? effectStatusLine({
                  kindKey: draft.data.kindKey,
                  enabled: draft.data.enabled,
                  tonic: draft.data.tonic,
                  scaleKey: draft.data.scaleKey,
                  drive: draft.data.drive,
                  timeMs: draft.data.timeMs,
                  feedback: draft.data.feedback,
                })
              : kind.key,
          );
          expect(draft?.data.drive).toBe(expectedDrive);
          expect(draft?.data.timeMs).toBe(expectedTimeMs);
          expect(draft?.data.feedback).toBe(expectedFeedback);
          expect(draft?.data.mix).toBe(expectedMix);
        },
      ),
    );
  });

  it('builds Scale Snap drafts with tonic and scale status', () => {
    fc.assert(
      fc.property(fc.constantFrom(...controlKindKeys), fc.uuid(), (kindKey, newId) => {
        const draft = buildEffectNode({
          kindKey,
          kindsByKey: effectKindsByKey,
          existingEffectCount: 0,
          position: { x: 0, y: 0 },
          newId,
        });
        expect(draft?.data.kindKey).toBe(kindKey);
        expect(draft?.data.status).toBe(
          draft
            ? effectStatusLine({
                kindKey: draft.data.kindKey,
                enabled: draft.data.enabled,
                tonic: draft.data.tonic,
                scaleKey: draft.data.scaleKey,
                drive: draft.data.drive,
                timeMs: draft.data.timeMs,
                feedback: draft.data.feedback,
              })
            : kindKey,
        );
      }),
    );
  });
});

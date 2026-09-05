import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { planVoiceCleanup } from './voiceCleanup';

const idArb = fc.uuid();

describe('planVoiceCleanup', () => {
  it('stops playing ids missing from the graph and removes engine voices missing from the graph or the playing set', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 8 }),
        (graphIds, playingSeed, engineSeed) => {
          const graph = new Set(graphIds);
          const playing = new Set([...playingSeed, ...graphIds.slice(0, Math.min(2, graphIds.length))]);
          const engine = new Set([...engineSeed, ...playing]);
          const { stopIds, removeIds } = planVoiceCleanup(graph, playing, engine);

          const expectedStop = [...playing].filter((id) => !graph.has(id));
          const expectedRemove = [...engine].filter((id) => !graph.has(id) || !playing.has(id));
          expect(new Set(stopIds)).toEqual(new Set(expectedStop));
          expect(new Set(removeIds)).toEqual(new Set(expectedRemove));
          expect(
            [...engine].filter((id) => graph.has(id) && playing.has(id)).every((id) => !removeIds.includes(id)),
          ).toBe(
            [...engine].filter((id) => graph.has(id) && playing.has(id)).every((id) => playing.has(id) && graph.has(id)),
          );
        },
      ),
    );
  });

  it('removes every engine voice when the playing set is empty, even if those ids remain on the graph', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 1, maxLength: 8 }),
        (ids) => {
          const graph = new Set(ids);
          const playing = new Set<string>();
          const engine = new Set(ids);
          const { stopIds, removeIds } = planVoiceCleanup(graph, playing, engine);
          expect(stopIds).toHaveLength(playing.size);
          expect(new Set(removeIds)).toEqual(engine);
        },
      ),
    );
  });
});

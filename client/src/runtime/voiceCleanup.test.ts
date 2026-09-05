import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { planVoiceCleanup } from './voiceCleanup';

const idArb = fc.uuid();

describe('planVoiceCleanup', () => {
  it('stops playing ids missing from the graph and removes every engine voice missing from the graph', () => {
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
          const expectedRemove = [...engine].filter((id) => !graph.has(id));
          expect(new Set(stopIds)).toEqual(new Set(expectedStop));
          expect(new Set(removeIds)).toEqual(new Set(expectedRemove));
          expect(stopIds.every((id) => playing.has(id) && !graph.has(id))).toBe(
            stopIds.length === expectedStop.length,
          );
          expect(removeIds.every((id) => engine.has(id) && !graph.has(id))).toBe(
            removeIds.length === expectedRemove.length,
          );
        },
      ),
    );
  });
});

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { pruneSeenIds } from './pruneSeenIds.js';

const idArb = fc.uuid();

describe('pruneSeenIds', () => {
  it('drops ids absent from both feed and queue and keeps needed ids', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 12 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 12 }),
        fc.uniqueArray(idArb, { minLength: 0, maxLength: 12 }),
        (seenSeed, feedIds, queueIds) => {
          const seenIds = new Set(seenSeed);
          const feed = new Set(feedIds);
          const queue = new Set(queueIds);
          const needed = new Set([...feed, ...queue]);
          const before = new Set(seenIds);
          pruneSeenIds(seenIds, feed, queue);
          for (const id of seenIds) {
            expect(needed.has(id)).toBe(true);
          }
          for (const id of before) {
            if (needed.has(id)) {
              expect(seenIds.has(id)).toBe(true);
            } else {
              expect(seenIds.has(id)).toBe(false);
            }
          }
        },
      ),
    );
  });
});

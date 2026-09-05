import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ConnectorSample, UsgsConnectorSample } from './channelFromSample';
import type { MonitorStrip } from './monitorStrips';
import {
  appendSampleToHistory,
  emptySampleHistory,
  pruneSampleHistory,
} from './sampleHistory';

const usgsArb: fc.Arbitrary<UsgsConnectorSample> = fc.record({
  kindKey: fc.constant('usgs_earthquakes' as const),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  mag: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  depthKm: fc.option(fc.double({ min: 0, max: 700, noNaN: true }), { nil: null }),
  sig: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null }),
  place: fc.string(),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

function stripFor(
  id: string,
  kindKey: string,
  channelKey: string,
): MonitorStrip {
  return {
    id,
    kindKey,
    channelKey,
    inMin: 0,
    inMax: 10,
    label: id,
    connectorId: `c-${id}`,
    oscillatorId: `o-${id}`,
  };
}

describe('sampleHistory', () => {
  it('keeps length at min of append count and capacity', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('mag', 'depthKm', 'sig'),
        fc.integer({ min: 1, max: 40 }),
        fc.array(usgsArb, { minLength: 1, maxLength: 40 }),
        (stripId, channelKey, capacity, samples) => {
          const strips = [stripFor(stripId, 'usgs_earthquakes', channelKey)];
          let history = emptySampleHistory();
          let accepted = 0;
          for (const sample of samples) {
            const channelValue = sample[channelKey];
            if (channelValue != null && Number.isFinite(channelValue)) {
              accepted += 1;
            }
            history = appendSampleToHistory(history, strips, sample, capacity);
          }
          const length = history[stripId]?.length ?? 0;
          expect(length).toBe(Math.min(accepted, capacity));
        },
      ),
    );
  });

  it('prunes buffers for strip ids that left the graph', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 4 }),
        (ids, keepCount) => {
          const keepN = Math.min(keepCount, ids.length - 1);
          let history = emptySampleHistory();
          for (const id of ids) {
            history = {
              ...history,
              [id]: [1, 2, 3],
            };
          }
          const keepIds = ids.slice(0, keepN);
          const pruned = pruneSampleHistory(history, keepIds);
          expect(Object.keys(pruned).sort()).toEqual([...keepIds].sort());
          for (const id of keepIds) {
            expect(pruned[id]).toEqual(history[id]);
          }
        },
      ),
    );
  });

  it('ignores samples whose kindKey does not match the strip', () => {
    fc.assert(
      fc.property(fc.uuid(), usgsArb, (stripId, sample) => {
        const strips = [stripFor(stripId, 'noaa_coops_tides', 'waterLevel')];
        const history = appendSampleToHistory(emptySampleHistory(), strips, sample as ConnectorSample);
        const matching = strips.filter((strip) => strip.kindKey === sample.kindKey).length;
        expect(history[stripId]?.length ?? 0).toBe(matching);
      }),
    );
  });
});

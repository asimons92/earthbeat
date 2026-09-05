import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  connectorKindKeysFromNodes,
  streamUrlForKind,
  streamUrlsForKindKeys,
} from './streamUrls';

const knownKindArb = fc.constantFrom('usgs_earthquakes', 'noaa_coops_tides');

describe('streamUrls', () => {
  it('maps known kinds to dedicated SSE paths', () => {
    fc.assert(
      fc.property(knownKindArb, (kind) => {
        const url = streamUrlForKind(kind);
        const expected =
          kind === 'usgs_earthquakes'
            ? '/api/earthquakes/stream'
            : '/api/tides/stream';
        expect(url).toBe(expected);
      }),
    );
  });

  it('omits unknown kinds', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/).filter(
          (key) => key !== 'usgs_earthquakes' && key !== 'noaa_coops_tides',
        ),
        (key) => {
          const absent = undefined;
          expect(streamUrlForKind(key)).toBe(absent);
        },
      ),
    );
  });

  it('collects unique connector kind keys from nodes', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(knownKindArb, {
          minLength: 0,
          maxLength: 2,
        }),
        (keys) => {
          const nodes: Array<{
            type: string;
            data: Record<string, unknown>;
            id: string;
          }> = keys.map((kindKey, index) => ({
            type: 'connector',
            data: { kindKey },
            id: `c-${index}`,
          }));
          nodes.push({ type: 'oscillator', data: {}, id: 'o' });
          const found = connectorKindKeysFromNodes(nodes);
          expect([...found].sort()).toEqual([...keys].sort());
          const urls = streamUrlsForKindKeys(found);
          expect(urls.size).toBe(keys.length);
        },
      ),
    );
  });
});

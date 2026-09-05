import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { channelHistoryToSvgPath, timeDomainToSvgPath } from './audioScopePath';

const finiteArb = fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true });
const positiveSizeArb = fc.double({ min: 1, max: 800, noNaN: true, noDefaultInfinity: true });

function pathCoordsAreFinite(d: string): boolean {
  const tokens = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  return tokens.every((token) => Number.isFinite(Number(token)));
}

describe('audioScopePath', () => {
  it('returns a finite path for any finite time-domain buffer', () => {
    fc.assert(
      fc.property(
        fc.array(finiteArb, { minLength: 0, maxLength: 64 }),
        positiveSizeArb,
        positiveSizeArb,
        (samples, width, height) => {
          const path = timeDomainToSvgPath(samples, width, height);
          const inputsFinite = samples.every((value) => Number.isFinite(value));
          expect(path.length !== 0).toEqual(inputsFinite || samples.length === 0);
          expect(pathCoordsAreFinite(path)).toEqual(inputsFinite || samples.length === 0);
        },
      ),
    );
  });

  it('returns a finite path for any finite channel history', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }), {
          minLength: 0,
          maxLength: 64,
        }),
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        positiveSizeArb,
        positiveSizeArb,
        (values, inMin, inMax, width, height) => {
          const path = channelHistoryToSvgPath(values, inMin, inMax, width, height);
          const inputsFinite = values.every((value) => Number.isFinite(value));
          expect(path.length !== 0).toEqual(inputsFinite || values.length === 0);
          expect(pathCoordsAreFinite(path)).toEqual(inputsFinite || values.length === 0);
        },
      ),
    );
  });
});

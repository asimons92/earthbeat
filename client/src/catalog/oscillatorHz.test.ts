import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatOscillatorHzStatus, roundFrequencyHz } from './oscillatorHz';

const hzArb = fc.double({ min: 20, max: 2000, noNaN: true, noDefaultInfinity: true });

describe('roundFrequencyHz', () => {
  it('stays within half a tenth of the input for finite Hertz', () => {
    fc.assert(
      fc.property(hzArb, (hz) => {
        const rounded = roundFrequencyHz(hz);
        const halfTenth = Number(0.05);
        expect(Math.abs(rounded - hz)).toBeLessThanOrEqual(halfTenth);
      }),
    );
  });

  it('is idempotent for finite Hertz', () => {
    fc.assert(
      fc.property(hzArb, (hz) => {
        const once = roundFrequencyHz(hz);
        expect(roundFrequencyHz(once)).toBe(once);
      }),
    );
  });
});

describe('formatOscillatorHzStatus', () => {
  it('joins the rounded Hertz value with the unit suffix', () => {
    const unitSuffix = ' Hz';
    fc.assert(
      fc.property(hzArb, (hz) => {
        const rounded = roundFrequencyHz(hz);
        const status = formatOscillatorHzStatus(hz);
        expect(status).toBe(`${rounded}${unitSuffix}`);
      }),
    );
  });
});

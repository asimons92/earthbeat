import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  formatModulatorStatus,
  roundModulatorValue,
} from './modulatorDisplay';

const valueArb = fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true });
const targetArb = fc.constantFrom('frequencyHz', 'gain', 'other');

describe('roundModulatorValue', () => {
  it('stays within half a hundredth of the input for finite values', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const rounded = roundModulatorValue(value);
        const halfHundredth = Number(0.005);
        expect(Math.abs(rounded - value)).toBeLessThanOrEqual(halfHundredth);
      }),
    );
  });

  it('is idempotent for finite values', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const once = roundModulatorValue(value);
        expect(roundModulatorValue(once)).toBe(once);
      }),
    );
  });
});

describe('formatModulatorStatus', () => {
  it('joins rounded bounds and uses ratio marks only for frequencyHz', () => {
    const arrow = ' → ';
    const ratioMark = '×';
    fc.assert(
      fc.property(valueArb, valueArb, valueArb, valueArb, targetArb, (
        inMin,
        inMax,
        outMin,
        outMax,
        targetParam,
      ) => {
        const rInMin = roundModulatorValue(inMin);
        const rInMax = roundModulatorValue(inMax);
        const rOutMin = roundModulatorValue(outMin);
        const rOutMax = roundModulatorValue(outMax);
        const outRange =
          targetParam === 'frequencyHz'
            ? `${rOutMin}${ratioMark}–${rOutMax}${ratioMark}`
            : `${rOutMin}–${rOutMax}`;
        const expected = `${rInMin}–${rInMax}${arrow}${outRange}`;
        expect(
          formatModulatorStatus({ inMin, inMax, outMin, outMax, targetParam }),
        ).toBe(expected);
      }),
    );
  });
});

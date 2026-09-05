import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapChannelOrRest, mapRange } from './mapRange';

/** Practical audio-scale integers (stable under linear map). */
const audioFloat = fc.integer({ min: -10_000, max: 10_000 });

describe('mapRange', () => {
  it('keeps outputs inside the closed output interval when the input span is non-zero', () => {
    fc.assert(
      fc.property(audioFloat, audioFloat, audioFloat, audioFloat, audioFloat, (value, inMin, inMax, outMin, outMax) => {
        fc.pre(inMin !== inMax);
        const result = mapRange(value, inMin, inMax, outMin, outMax);
        const lo = Math.min(outMin, outMax);
        const hi = Math.max(outMin, outMax);
        const clampedToOut = Math.min(hi, Math.max(lo, result));
        expect(clampedToOut).toBeCloseTo(result, 10);
      }),
    );
  });

  it('returns outMin when the input span is zero', () => {
    fc.assert(
      fc.property(audioFloat, audioFloat, audioFloat, audioFloat, (value, hinge, outMin, outMax) => {
        expect(mapRange(value, hinge, hinge, outMin, outMax)).toBe(outMin);
      }),
    );
  });

  it('maps the input endpoints onto the output endpoints when the input span is non-zero', () => {
    fc.assert(
      fc.property(audioFloat, audioFloat, audioFloat, audioFloat, (inMin, inMax, outMin, outMax) => {
        fc.pre(inMin !== inMax);
        const atMin = mapRange(inMin, inMin, inMax, outMin, outMax);
        const atMax = mapRange(inMax, inMin, inMax, outMin, outMax);
        const tol = Math.abs(outMax - outMin) * 1e-9 + 1e-9;
        expect(Math.abs(atMin - outMin)).toBeLessThan(tol);
        expect(Math.abs(atMax - outMax)).toBeLessThan(tol);
      }),
    );
  });

  it('is monotonic along the input axis when ranges are ordered low-to-high', () => {
    fc.assert(
      fc.property(
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        (a, b, inMin, inMax, outMin, outMax) => {
          fc.pre(inMin < inMax);
          fc.pre(outMin <= outMax);
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          const left = mapRange(low, inMin, inMax, outMin, outMax);
          const right = mapRange(high, inMin, inMax, outMin, outMax);
          expect(left).toBeLessThanOrEqual(right);
        },
      ),
    );
  });
});

describe('mapChannelOrRest', () => {
  it('returns the resting value when the channel is null, undefined, or NaN', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, Number.NaN),
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        (channel, inMin, inMax, outMin, outMax, resting) => {
          expect(mapChannelOrRest(channel, inMin, inMax, outMin, outMax, resting)).toBe(resting);
        },
      ),
    );
  });

  it('matches mapRange for finite channel values', () => {
    fc.assert(
      fc.property(
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        audioFloat,
        (channel, inMin, inMax, outMin, outMax, resting) => {
          const mapped = mapRange(channel, inMin, inMax, outMin, outMax);
          expect(mapChannelOrRest(channel, inMin, inMax, outMin, outMax, resting)).toBe(mapped);
        },
      ),
    );
  });
});

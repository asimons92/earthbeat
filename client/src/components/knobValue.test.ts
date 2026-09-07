import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  clampKnobValue,
  nudgeKnob,
  normToValue,
  valueToNorm,
  type KnobCurve,
} from './knobValue';

/** Closed unit interval for knob travel (norm space). */
const NORM_LO = Number(0);
const NORM_HI = Number(1);
const NORM_MID = (NORM_LO + NORM_HI) / 2;

/** Catalog-like travel bands with enough span for float-stable maps. */
const MIN_SPAN = 1e-3;

const orderedFinitePair = fc
  .tuple(
    fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }),
  )
  .filter(([a, b]) => b - a >= MIN_SPAN)
  .map(([a, b]) => ({ min: a, max: b }));

const positiveOrderedPair = fc
  .tuple(
    fc.double({ min: 1e-3, max: 1e4, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 1e-3, max: 1e4, noNaN: true, noDefaultInfinity: true }),
  )
  .filter(([a, b]) => b - a >= MIN_SPAN)
  .map(([a, b]) => ({ min: a, max: b }));

const curveArb: fc.Arbitrary<KnobCurve> = fc.constantFrom('linear', 'log');

const nonFiniteRaw = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
);

describe('clampKnobValue', () => {
  it('keeps finite values already inside the closed travel band', () => {
    fc.assert(
      fc.property(
        orderedFinitePair.chain(({ min, max }) =>
          fc.tuple(
            fc.constant({ min, max }),
            fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([{ min, max }, inside]) => {
          expect(clampKnobValue(inside, min, max)).toBe(inside);
        },
      ),
    );
  });

  it('clamps finite values below min up to min and above max down to max', () => {
    fc.assert(
      fc.property(
        orderedFinitePair,
        fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        ({ min, max }, lowCandidate, highCandidate) => {
          fc.pre(lowCandidate < min);
          fc.pre(highCandidate > max);
          expect(clampKnobValue(lowCandidate, min, max)).toBe(min);
          expect(clampKnobValue(highCandidate, min, max)).toBe(max);
        },
      ),
    );
  });

  it('returns min when raw is not finite', () => {
    fc.assert(
      fc.property(orderedFinitePair, nonFiniteRaw, ({ min, max }, raw) => {
        expect(clampKnobValue(raw, min, max)).toBe(min);
      }),
    );
  });

  it('always lands inside the closed travel band for finite raw', () => {
    fc.assert(
      fc.property(
        orderedFinitePair,
        fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        ({ min, max }, raw) => {
          const clamped = clampKnobValue(raw, min, max);
          expect(clamped).toBeGreaterThanOrEqual(min);
          expect(clamped).toBeLessThanOrEqual(max);
        },
      ),
    );
  });
});

describe('valueToNorm / normToValue', () => {
  it('maps the travel endpoints to the unit-interval endpoints for linear and log', () => {
    fc.assert(
      fc.property(positiveOrderedPair, curveArb, ({ min, max }, curve) => {
        expect(valueToNorm(min, min, max, curve)).toBeCloseTo(NORM_LO, 8);
        expect(valueToNorm(max, min, max, curve)).toBeCloseTo(NORM_HI, 8);
        expect(normToValue(NORM_LO, min, max, curve)).toBeCloseTo(min, 8);
        expect(normToValue(NORM_HI, min, max, curve)).toBeCloseTo(max, 8);
      }),
    );
  });

  it('round-trips finite values inside the travel band for linear', () => {
    fc.assert(
      fc.property(
        orderedFinitePair.chain(({ min, max }) =>
          fc.tuple(
            fc.constant({ min, max }),
            fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([{ min, max }, value]) => {
          const back = normToValue(valueToNorm(value, min, max, 'linear'), min, max, 'linear');
          expect(back).toBeCloseTo(value, 8);
        },
      ),
    );
  });

  it('round-trips finite values inside the travel band for log', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair.chain(({ min, max }) =>
          fc.tuple(
            fc.constant({ min, max }),
            fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([{ min, max }, value]) => {
          const back = normToValue(valueToNorm(value, min, max, 'log'), min, max, 'log');
          expect(back).toBeCloseTo(value, 8);
        },
      ),
    );
  });

  it('places the geometric mean at mid travel for log', () => {
    fc.assert(
      fc.property(positiveOrderedPair, ({ min, max }) => {
        const geometricMean = Math.sqrt(min * max);
        const norm = valueToNorm(geometricMean, min, max, 'log');
        expect(norm).toBeCloseTo(NORM_MID, 8);
      }),
    );
  });

  it('is strictly increasing in value for rising norm when min is below max', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair,
        curveArb,
        fc.double({ min: NORM_LO, max: NORM_HI, noNaN: true }),
        fc.double({ min: NORM_LO, max: NORM_HI, noNaN: true }),
        ({ min, max }, curve, a, b) => {
          fc.pre(b - a >= MIN_SPAN);
          const lo = normToValue(a, min, max, curve);
          const hi = normToValue(b, min, max, curve);
          expect(hi).toBeGreaterThan(lo);
        },
      ),
    );
  });

  it('clamps norm outside the unit interval before converting', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair,
        curveArb,
        fc.double({ min: -10, max: 0, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 10, noNaN: true, noDefaultInfinity: true }),
        ({ min, max }, curve, below, above) => {
          fc.pre(below < NORM_LO);
          fc.pre(above > NORM_HI);
          expect(normToValue(below, min, max, curve)).toBeCloseTo(min, 8);
          expect(normToValue(above, min, max, curve)).toBeCloseTo(max, 8);
        },
      ),
    );
  });
});

describe('nudgeKnob', () => {
  it('leaves the value unchanged when deltaNorm is zero', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair.chain(({ min, max }) =>
          fc.tuple(
            fc.constant({ min, max }),
            curveArb,
            fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([{ min, max }, curve, value]) => {
          const zeroDelta = NORM_LO - NORM_LO;
          expect(nudgeKnob(value, min, max, curve, zeroDelta)).toBeCloseTo(value, 8);
        },
      ),
    );
  });

  it('raises the value when deltaNorm is positive and lowers it when negative', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair,
        curveArb,
        fc.double({ min: 1e-4, max: 0.4, noNaN: true }),
        ({ min, max }, curve, magnitude) => {
          const start = normToValue(NORM_MID, min, max, curve);
          const up = nudgeKnob(start, min, max, curve, magnitude);
          const down = nudgeKnob(start, min, max, curve, -magnitude);
          expect(up).toBeGreaterThan(start);
          expect(down).toBeLessThan(start);
        },
      ),
    );
  });

  it('always lands inside the closed travel band', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair.chain(({ min, max }) =>
          fc.tuple(
            fc.constant({ min, max }),
            curveArb,
            fc.double({ min, max, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([{ min, max }, curve, value, deltaNorm]) => {
          const next = nudgeKnob(value, min, max, curve, deltaNorm);
          expect(next).toBeGreaterThanOrEqual(min);
          expect(next).toBeLessThanOrEqual(max);
        },
      ),
    );
  });

  it('clamps sibling bounds independently so a higher raw stays at or above a lower raw', () => {
    fc.assert(
      fc.property(
        positiveOrderedPair,
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        ({ min, max }, rawHigh, rawLow) => {
          fc.pre(rawHigh > rawLow);
          const high = clampKnobValue(rawHigh, min, max);
          const low = clampKnobValue(rawLow, min, max);
          expect(high).toBeGreaterThanOrEqual(low);
        },
      ),
    );
  });
});

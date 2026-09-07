import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapRange } from './mapRange';
import {
  DOMAIN_PAD_FRACTION,
  modulatorTransferCurve,
  resolveAxisDomain,
  transferCurveAnchors,
  transferCurveDomains,
  transferCurveLivePoint,
  type AxisLock,
  type TransferCurveRanges,
} from './modulatorTransferCurve';

const finiteArb = fc.double({
  min: -1e3,
  max: 1e3,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Avoid denormals that collapse distinct mapped values onto one SVG pixel. */
const stableFiniteArb = fc
  .double({
    min: -1e3,
    max: 1e3,
    noNaN: true,
    noDefaultInfinity: true,
    minExcluded: false,
    maxExcluded: false,
  })
  .filter((n) => n === 0 || Math.abs(n) >= 1e-6);

const rangesArb = fc.record({
  inMin: stableFiniteArb,
  inMax: stableFiniteArb,
  outMin: stableFiniteArb,
  outMax: stableFiniteArb,
});

const lockArb: fc.Arbitrary<AxisLock> = fc
  .record({
    min: stableFiniteArb,
    max: stableFiniteArb,
  })
  .filter((lock) => Math.abs(lock.max - lock.min) >= 1e-3);

const plotSizeArb = fc.record({
  width: fc.integer({ min: 40, max: 400 }),
  height: fc.integer({ min: 40, max: 300 }),
});

function insideLock(lock: AxisLock, value: number): boolean {
  const lo = Math.min(lock.min, lock.max);
  const hi = Math.max(lock.min, lock.max);
  return value >= lo && value <= hi;
}

describe('transferCurveLivePoint', () => {
  it('yields no live point when the channel value is missing or NaN', () => {
    fc.assert(
      fc.property(rangesArb, fc.constantFrom(null, undefined, Number.NaN), (ranges, channel) => {
        expect(transferCurveLivePoint(channel, ranges)).toBeNull();
      }),
    );
  });

  it('matches mapRange for any finite channel value', () => {
    fc.assert(
      fc.property(rangesArb, finiteArb, (ranges, channelValue) => {
        const point = transferCurveLivePoint(channelValue, ranges);
        expect(point).not.toBeNull();
        expect(point!.x).toBe(channelValue);
        expect(point!.y).toBe(
          mapRange(
            channelValue,
            ranges.inMin,
            ranges.inMax,
            ranges.outMin,
            ranges.outMax,
          ),
        );
      }),
    );
  });

  it('clamps outside the input span the same way mapRange does', () => {
    fc.assert(
      fc.property(rangesArb, finiteArb, (ranges, channelValue) => {
        const lo = Math.min(ranges.inMin, ranges.inMax);
        const hi = Math.max(ranges.inMin, ranges.inMax);
        fc.pre(channelValue < lo || channelValue > hi);
        const point = transferCurveLivePoint(channelValue, ranges);
        expect(point!.y).toBe(
          mapRange(
            channelValue,
            ranges.inMin,
            ranges.inMax,
            ranges.outMin,
            ranges.outMax,
          ),
        );
      }),
    );
  });
});

describe('resolveAxisDomain', () => {
  it('keeps the padded lock when extras stay inside the lock', () => {
    fc.assert(
      fc.property(lockArb, stableFiniteArb, stableFiniteArb, (lock, a, b) => {
        fc.pre(insideLock(lock, a) && insideLock(lock, b));
        const alone = resolveAxisDomain(lock, [], DOMAIN_PAD_FRACTION);
        const withExtras = resolveAxisDomain(lock, [a, b], DOMAIN_PAD_FRACTION);
        expect(withExtras).toEqual(alone);
      }),
    );
  });

  it('expands only when an extra leaves the padded lock', () => {
    fc.assert(
      fc.property(lockArb, stableFiniteArb, (lock, extra) => {
        const padded = resolveAxisDomain(lock, [], DOMAIN_PAD_FRACTION);
        fc.pre(extra < padded.min || extra > padded.max);
        const domain = resolveAxisDomain(lock, [extra], DOMAIN_PAD_FRACTION);
        expect(domain.min).toBe(Math.min(padded.min, extra));
        expect(domain.max).toBe(Math.max(padded.max, extra));
      }),
    );
  });
});

describe('transferCurveDomains', () => {
  it('does not move X when in range stays inside the X lock', () => {
    fc.assert(
      fc.property(
        lockArb,
        lockArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        (xLock, yLock, inA, inB, inMax, outMin, outMax, channelValue) => {
          fc.pre(insideLock(xLock, inA) && insideLock(xLock, inB) && insideLock(xLock, inMax));
          fc.pre(insideLock(xLock, channelValue));
          fc.pre(insideLock(yLock, outMin) && insideLock(yLock, outMax));
          const base: TransferCurveRanges = {
            inMin: inA,
            inMax,
            outMin,
            outMax,
          };
          const moved: TransferCurveRanges = { ...base, inMin: inB };
          const options = { xLock, yLock, channelValue, padFraction: DOMAIN_PAD_FRACTION };
          expect(transferCurveDomains(base, options).xDomain).toEqual(
            transferCurveDomains(moved, options).xDomain,
          );
        },
      ),
    );
  });

  it('does not move Y when out range stays inside the Y lock', () => {
    fc.assert(
      fc.property(
        lockArb,
        lockArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        stableFiniteArb,
        (xLock, yLock, inMin, inMax, outA, outB, outMax) => {
          fc.pre(insideLock(xLock, inMin) && insideLock(xLock, inMax));
          fc.pre(insideLock(yLock, outA) && insideLock(yLock, outB) && insideLock(yLock, outMax));
          const base: TransferCurveRanges = {
            inMin,
            inMax,
            outMin: outA,
            outMax,
          };
          const moved: TransferCurveRanges = { ...base, outMin: outB };
          const options = { xLock, yLock, padFraction: DOMAIN_PAD_FRACTION };
          expect(transferCurveDomains(base, options).yDomain).toEqual(
            transferCurveDomains(moved, options).yDomain,
          );
        },
      ),
    );
  });
});

describe('transferCurveAnchors', () => {
  it('polyline Y at each X anchor matches mapRange', () => {
    fc.assert(
      fc.property(rangesArb, lockArb, lockArb, (ranges, xLock, yLock) => {
        const options = { xLock, yLock, padFraction: DOMAIN_PAD_FRACTION };
        const anchors = transferCurveAnchors(ranges, options);
        const { xDomain } = transferCurveDomains(ranges, options);
        const kneeLo = Math.min(ranges.inMin, ranges.inMax);
        const kneeHi = Math.max(ranges.inMin, ranges.inMax);
        const expectedXs = [xDomain.min, kneeLo, kneeHi, xDomain.max];
        expect(anchors.map((anchor) => anchor.x)).toEqual(expectedXs);
        for (const anchor of anchors) {
          expect(anchor.y).toBe(
            mapRange(
              anchor.x,
              ranges.inMin,
              ranges.inMax,
              ranges.outMin,
              ranges.outMax,
            ),
          );
        }
      }),
    );
  });

  it('keeps ascending X so inverted in ranges do not draw a Z', () => {
    fc.assert(
      fc.property(rangesArb, lockArb, lockArb, (ranges, xLock, yLock) => {
        const anchors = transferCurveAnchors(ranges, {
          xLock,
          yLock,
          padFraction: DOMAIN_PAD_FRACTION,
        });
        for (let i = 1; i < anchors.length; i += 1) {
          expect(anchors[i]!.x).toBeGreaterThanOrEqual(anchors[i - 1]!.x);
        }
      }),
    );
  });
});

describe('modulatorTransferCurve', () => {
  it('maps higher out to a smaller SVG Y (Y grows downward)', () => {
    fc.assert(
      fc.property(rangesArb, plotSizeArb, lockArb, lockArb, (ranges, size, xLock, yLock) => {
        fc.pre(ranges.outMin !== ranges.outMax);
        const geoLow = modulatorTransferCurve(ranges, {
          ...size,
          channelValue: ranges.inMin,
          xLock,
          yLock,
        });
        const geoHigh = modulatorTransferCurve(ranges, {
          ...size,
          channelValue: ranges.inMax,
          xLock,
          yLock,
        });
        const yAtInMin = mapRange(
          ranges.inMin,
          ranges.inMin,
          ranges.inMax,
          ranges.outMin,
          ranges.outMax,
        );
        const yAtInMax = mapRange(
          ranges.inMax,
          ranges.inMin,
          ranges.inMax,
          ranges.outMin,
          ranges.outMax,
        );
        fc.pre(Math.abs(yAtInMin - yAtInMax) > 1e-9);
        expect(geoLow.livePointSvg).not.toBeNull();
        expect(geoHigh.livePointSvg).not.toBeNull();
        expect(
          (yAtInMin - yAtInMax) * (geoLow.livePointSvg!.y - geoHigh.livePointSvg!.y),
        ).toBeLessThan(0);
      }),
    );
  });

  it('places a live SVG point only when the channel value is finite', () => {
    fc.assert(
      fc.property(rangesArb, plotSizeArb, finiteArb, (ranges, size, channelValue) => {
        const withPoint = modulatorTransferCurve(ranges, {
          ...size,
          channelValue,
        });
        const without = modulatorTransferCurve(ranges, {
          ...size,
          channelValue: null,
        });
        expect(withPoint.livePoint).not.toBeNull();
        expect(withPoint.livePointSvg).not.toBeNull();
        expect(without.livePoint).toBeNull();
        expect(without.livePointSvg).toBeNull();
      }),
    );
  });
});

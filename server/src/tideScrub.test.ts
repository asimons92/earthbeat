import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  advanceTidePhase,
  interpolateTidePhase,
  sampleTidePhase,
  seriesWaterLevelBounds,
  type TideSeriesPoint,
} from './tideScrub.js';

const levelArb = fc.double({ min: -3, max: 5, noNaN: true, noDefaultInfinity: true });
const timeArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

const pointArb: fc.Arbitrary<TideSeriesPoint> = fc.record({
  waterLevel: levelArb,
  time: timeArb,
});

const seriesArb = fc.array(pointArb, { minLength: 1, maxLength: 48 });

describe('sampleTidePhase', () => {
  it('returns a value inside the series min/max for any phase', () => {
    fc.assert(
      fc.property(seriesArb, fc.double({ min: -5, max: 5, noNaN: true }), (series, phase) => {
        const value = interpolateTidePhase(series, phase);
        const bounds = seriesWaterLevelBounds(series);
        expect(value).not.toBe(undefined);
        if (value === undefined || !bounds) return;
        const lo = Math.min(bounds.min, bounds.max);
        const hi = Math.max(bounds.min, bounds.max);
        expect(value).toBeGreaterThanOrEqual(lo);
        expect(value).toBeLessThanOrEqual(hi);
      }),
    );
  });

  it('is periodic with period 1 in phase', () => {
    fc.assert(
      fc.property(
        seriesArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: -3, max: 3 }),
        (series, phase, wraps) => {
          const a = interpolateTidePhase(series, phase);
          const b = interpolateTidePhase(series, phase + wraps);
          expect(a).toBeCloseTo(b as number, 10);
        },
      ),
    );
  });

  it('returns undefined for an empty series', () => {
    const empty: TideSeriesPoint[] = [];
    const absent = undefined;
    expect(interpolateTidePhase(empty, 0)).toBe(absent);
  });

  it('step mode returns an exact series point', () => {
    fc.assert(
      fc.property(seriesArb, fc.double({ min: 0, max: 1, noNaN: true }), (series, phase) => {
        const stepped = sampleTidePhase(series, phase, { interpolate: false });
        expect(series.some((point) => point.waterLevel === stepped)).toBe(
          stepped !== undefined,
        );
      }),
    );
  });

  it('lerp mode stays between the two adjacent point levels', () => {
    fc.assert(
      fc.property(
        fc.array(pointArb, { minLength: 2, maxLength: 24 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (series, phase) => {
          const lerped = sampleTidePhase(series, phase, { interpolate: true });
          expect(lerped).not.toBe(undefined);
          if (lerped === undefined) return;
          const wrapped = phase - Math.floor(phase);
          const scaled = wrapped * series.length;
          const index = Math.floor(scaled) % series.length;
          const nextIndex = (index + 1) % series.length;
          const a = series[index]!.waterLevel;
          const b = series[nextIndex]!.waterLevel;
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(lerped).toBeGreaterThanOrEqual(lo);
          expect(lerped).toBeLessThanOrEqual(hi);
        },
      ),
    );
  });
});

describe('advanceTidePhase', () => {
  it('stays in [0, 1) after advances', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: 1, max: 600, noNaN: true }),
        fc.nat({ max: 40 }),
        (phase, dt, loop, steps) => {
          let current = phase;
          for (let i = 0; i < steps; i += 1) {
            current = advanceTidePhase(current, dt, loop);
          }
          expect(current).toBeGreaterThanOrEqual(0);
          expect(current).toBeLessThan(1);
        },
      ),
    );
  });
});

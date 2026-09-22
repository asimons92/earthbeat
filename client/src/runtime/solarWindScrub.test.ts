import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  sampleSolarWindPhase,
  type SolarWindChannelKey,
  type SolarWindSeriesPoint,
} from './scrubSample';

const speedArb = fc.double({ min: 200, max: 1200, noNaN: true, noDefaultInfinity: true });
const densityArb = fc.double({ min: 0, max: 40, noNaN: true, noDefaultInfinity: true });
const bzArb = fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true });
const timeArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

const pointArb: fc.Arbitrary<SolarWindSeriesPoint> = fc.record({
  speed: speedArb,
  density: densityArb,
  bz: bzArb,
  source: fc.stringMatching(/^[A-Z][A-Z0-9]{1,7}$/),
  time: timeArb,
});

const seriesArb = fc.array(pointArb, { minLength: 1, maxLength: 48 });
const channelArb = fc.constantFrom('speed', 'density', 'bz') satisfies fc.Arbitrary<SolarWindChannelKey>;

function neighborsAt(length: number, phase: number): { index: number; nextIndex: number } {
  const wrapped = phase - Math.floor(phase);
  const scaled = wrapped * length;
  const index = Math.floor(scaled) % length;
  const nextIndex = (index + 1) % length;
  return { index, nextIndex };
}

describe('sampleSolarWindPhase', () => {
  it('reads the first point at phase 0 for step and interpolate', () => {
    fc.assert(
      fc.property(seriesArb, channelArb, (series, channel) => {
        const first = series[0]![channel];
        expect(sampleSolarWindPhase(series, 0, channel, { interpolate: false })).toBe(first);
        expect(sampleSolarWindPhase(series, 0, channel, { interpolate: true })).toBe(first);
      }),
    );
  });

  it('holds an exact series point in step mode', () => {
    fc.assert(
      fc.property(
        seriesArb,
        fc.double({ min: -2, max: 3, noNaN: true }),
        channelArb,
        (series, phase, channel) => {
          const stepped = sampleSolarWindPhase(series, phase, channel, { interpolate: false });
          const held = series.some((point) => point[channel] === stepped);
          expect(held).toBe(stepped !== undefined);
        },
      ),
    );
  });

  it('stays between the two neighboring points when interpolating', () => {
    fc.assert(
      fc.property(
        seriesArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        channelArb,
        (series, phase, channel) => {
          const value = sampleSolarWindPhase(series, phase, channel, { interpolate: true });
          const { index, nextIndex } = neighborsAt(series.length, phase);
          const lo = Math.min(series[index]![channel], series[nextIndex]![channel]);
          const hi = Math.max(series[index]![channel], series[nextIndex]![channel]);
          expect(value).toBeGreaterThanOrEqual(lo);
          expect(value).toBeLessThanOrEqual(hi);
        },
      ),
    );
  });

  it('is periodic with period 1 in phase', () => {
    fc.assert(
      fc.property(
        seriesArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: -3, max: 3 }),
        channelArb,
        (series, phase, wraps, channel) => {
          const a = sampleSolarWindPhase(series, phase, channel);
          const b = sampleSolarWindPhase(series, phase + wraps, channel);
          expect(a).toBeCloseTo(b as number, 10);
        },
      ),
    );
  });

  it('returns undefined for an empty series', () => {
    const empty: SolarWindSeriesPoint[] = [];
    const absent = undefined;
    expect(sampleSolarWindPhase(empty, 0, 'speed')).toBe(absent);
    expect(sampleSolarWindPhase(empty, 0, 'density')).toBe(absent);
    expect(sampleSolarWindPhase(empty, 0, 'bz')).toBe(absent);
  });
});

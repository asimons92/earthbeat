import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  advanceWavePhase,
  sampleWavePhase,
  seriesWaveChannelBounds,
  type WaveChannelKey,
  type WaveSeriesPoint,
} from './waveScrub.js';

const heightArb = fc.double({ min: 0, max: 12, noNaN: true, noDefaultInfinity: true });
const periodArb = fc.double({ min: 2, max: 20, noNaN: true, noDefaultInfinity: true });
const timeArb = fc.integer({ min: 0, max: 2_000_000_000_000 });

const pointArb: fc.Arbitrary<WaveSeriesPoint> = fc.record({
  waveHeight: heightArb,
  wavePeriod: periodArb,
  time: timeArb,
});

const seriesArb = fc.array(pointArb, { minLength: 1, maxLength: 48 });
const channelArb = fc.constantFrom('waveHeight', 'wavePeriod') satisfies fc.Arbitrary<WaveChannelKey>;

describe('sampleWavePhase', () => {
  it('returns a value inside the series min/max for any phase and channel', () => {
    fc.assert(
      fc.property(
        seriesArb,
        fc.double({ min: -5, max: 5, noNaN: true }),
        channelArb,
        (series, phase, channel) => {
          const value = sampleWavePhase(series, phase, channel, { interpolate: true });
          const bounds = seriesWaveChannelBounds(series, channel);
          expect(value).not.toBe(undefined);
          if (value === undefined || !bounds) return;
          const lo = Math.min(bounds.min, bounds.max);
          const hi = Math.max(bounds.min, bounds.max);
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
          const a = sampleWavePhase(series, phase, channel);
          const b = sampleWavePhase(series, phase + wraps, channel);
          expect(a).toBeCloseTo(b as number, 10);
        },
      ),
    );
  });

  it('returns undefined for an empty series', () => {
    const empty: WaveSeriesPoint[] = [];
    const absent = undefined;
    expect(sampleWavePhase(empty, 0, 'waveHeight')).toBe(absent);
    expect(sampleWavePhase(empty, 0, 'wavePeriod')).toBe(absent);
  });

  it('step mode returns an exact series point for both channels', () => {
    fc.assert(
      fc.property(seriesArb, fc.double({ min: 0, max: 1, noNaN: true }), channelArb, (
        series,
        phase,
        channel,
      ) => {
        const stepped = sampleWavePhase(series, phase, channel, { interpolate: false });
        expect(series.some((point) => point[channel] === stepped)).toBe(stepped !== undefined);
      }),
    );
  });

  it('lerp mode stays between the two adjacent point values', () => {
    fc.assert(
      fc.property(
        fc.array(pointArb, { minLength: 2, maxLength: 24 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        channelArb,
        (series, phase, channel) => {
          const lerped = sampleWavePhase(series, phase, channel, { interpolate: true });
          expect(lerped).not.toBe(undefined);
          if (lerped === undefined) return;
          const wrapped = phase - Math.floor(phase);
          const scaled = wrapped * series.length;
          const index = Math.floor(scaled) % series.length;
          const nextIndex = (index + 1) % series.length;
          const a = series[index]![channel];
          const b = series[nextIndex]![channel];
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          expect(lerped).toBeGreaterThanOrEqual(lo);
          expect(lerped).toBeLessThanOrEqual(hi);
        },
      ),
    );
  });
});

describe('advanceWavePhase', () => {
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
            current = advanceWavePhase(current, dt, loop);
          }
          expect(current).toBeGreaterThanOrEqual(0);
          expect(current).toBeLessThan(1);
        },
      ),
    );
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  channelFromSample,
  type ConnectorSample,
  type NdbcWaveConnectorSample,
  type NoaaConnectorSample,
  type UsgsConnectorSample,
} from './channelFromSample';

const usgsArb: fc.Arbitrary<UsgsConnectorSample> = fc.record({
  kindKey: fc.constant('usgs_earthquakes' as const),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  mag: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  depthKm: fc.option(fc.double({ min: 0, max: 700, noNaN: true }), { nil: null }),
  sig: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null }),
  place: fc.string(),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

const noaaArb: fc.Arbitrary<NoaaConnectorSample> = fc.record({
  kindKey: fc.constant('noaa_coops_tides' as const),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  stationId: fc.stringMatching(/^[0-9]{7}$/),
  waterLevel: fc.option(fc.double({ min: -3, max: 5, noNaN: true }), { nil: null }),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

const ndbcArb: fc.Arbitrary<NdbcWaveConnectorSample> = fc.record({
  kindKey: fc.constant('ndbc_buoy_waves' as const),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  stationId: fc.stringMatching(/^[0-9]{5}$/),
  waveHeight: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  wavePeriod: fc.option(fc.double({ min: 2, max: 20, noNaN: true }), { nil: null }),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

const sampleArb: fc.Arbitrary<ConnectorSample> = fc.oneof(usgsArb, noaaArb, ndbcArb);
const unknownKeyArb = fc
  .stringMatching(/^[a-z]{3,12}$/)
  .filter(
    (key) =>
      key !== 'mag' &&
      key !== 'depthKm' &&
      key !== 'sig' &&
      key !== 'waterLevel' &&
      key !== 'waveHeight' &&
      key !== 'wavePeriod',
  );

describe('channelFromSample', () => {
  it('returns null for unknown channel keys', () => {
    fc.assert(
      fc.property(sampleArb, unknownKeyArb, (sample, key) => {
        const absent = null;
        expect(channelFromSample(sample, key)).toBe(absent);
      }),
    );
  });

  it('round-trips known USGS channels from the sample', () => {
    fc.assert(
      fc.property(usgsArb, fc.constantFrom('mag', 'depthKm', 'sig'), (sample, key) => {
        const value = channelFromSample(sample, key);
        expect(value).toBe(sample[key]);
      }),
    );
  });

  it('round-trips waterLevel from NOAA samples', () => {
    fc.assert(
      fc.property(noaaArb, (sample) => {
        expect(channelFromSample(sample, 'waterLevel')).toBe(sample.waterLevel);
      }),
    );
  });

  it('uses waterLevelStep when interpolate is off', () => {
    fc.assert(
      fc.property(
        noaaArb.chain((sample) =>
          fc.record({
            sample: fc.constant(sample),
            step: fc.double({ min: -3, max: 5, noNaN: true }),
          }),
        ),
        ({ sample, step }) => {
          const withStep = { ...sample, waterLevelStep: step };
          expect(channelFromSample(withStep, 'waterLevel', { interpolate: false })).toBe(step);
          expect(channelFromSample(withStep, 'waterLevel', { interpolate: true })).toBe(
            sample.waterLevel,
          );
        },
      ),
    );
  });

  it('round-trips waveHeight and wavePeriod from NDBC samples', () => {
    fc.assert(
      fc.property(ndbcArb, fc.constantFrom('waveHeight', 'wavePeriod'), (sample, key) => {
        expect(channelFromSample(sample, key)).toBe(sample[key]);
      }),
    );
  });

  it('uses wave step channels when interpolate is off', () => {
    fc.assert(
      fc.property(
        ndbcArb.chain((sample) =>
          fc.record({
            sample: fc.constant(sample),
            heightStep: fc.double({ min: 0, max: 10, noNaN: true }),
            periodStep: fc.double({ min: 2, max: 20, noNaN: true }),
          }),
        ),
        ({ sample, heightStep, periodStep }) => {
          const withStep = {
            ...sample,
            waveHeightStep: heightStep,
            wavePeriodStep: periodStep,
          };
          expect(channelFromSample(withStep, 'waveHeight', { interpolate: false })).toBe(
            heightStep,
          );
          expect(channelFromSample(withStep, 'wavePeriod', { interpolate: false })).toBe(
            periodStep,
          );
          expect(channelFromSample(withStep, 'waveHeight', { interpolate: true })).toBe(
            sample.waveHeight,
          );
          expect(channelFromSample(withStep, 'wavePeriod', { interpolate: true })).toBe(
            sample.wavePeriod,
          );
        },
      ),
    );
  });
});

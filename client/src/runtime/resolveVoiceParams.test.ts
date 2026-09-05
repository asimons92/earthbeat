import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapRange } from './mapRange';
import {
  modulateFrequencyFromBase,
  resolveVoiceParams,
  type EarthquakeSample,
} from './resolveVoiceParams';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';

const idArb = fc.uuid();
const sampleArb = fc.record({
  kindKey: fc.constant('usgs_earthquakes' as const),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  mag: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  depthKm: fc.option(fc.double({ min: 0, max: 700, noNaN: true }), { nil: null }),
  sig: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null }),
  place: fc.string(),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
}) satisfies fc.Arbitrary<EarthquakeSample>;

const audioHz = fc.integer({ min: 40, max: 2000 });
const ratioArb = fc.double({ min: 0.1, max: 8, noNaN: true, noDefaultInfinity: true });

describe('modulateFrequencyFromBase', () => {
  it('returns the base frequency when the channel is missing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, Number.NaN),
        audioHz,
        audioHz,
        ratioArb,
        ratioArb,
        audioHz,
        (channel, inMin, inMax, ratioMin, ratioMax, base) => {
          expect(modulateFrequencyFromBase(channel, inMin, inMax, ratioMin, ratioMax, base)).toBe(
            base,
          );
        },
      ),
    );
  });

  it('multiplies the base by the mapped ratio', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        audioHz,
        audioHz,
        ratioArb,
        ratioArb,
        audioHz,
        (channel, inMin, inMax, ratioMin, ratioMax, base) => {
          fc.pre(inMin !== inMax);
          const freq = modulateFrequencyFromBase(channel, inMin, inMax, ratioMin, ratioMax, base);
          const ratio = mapRange(channel, inMin, inMax, ratioMin, ratioMax);
          const minHz = 20;
          const expected = Math.max(minHz, base * ratio);
          expect(freq).toBe(expected);
        },
      ),
    );
  });

  it('scales audible Hz in proportion to the base for a fixed channel and ratios', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        audioHz,
        audioHz,
        ratioArb,
        ratioArb,
        audioHz,
        audioHz,
        (channel, inMin, inMax, ratioMin, ratioMax, baseA, baseB) => {
          fc.pre(inMin !== inMax);
          fc.pre(baseA > 0 && baseB > 0);
          const freqA = modulateFrequencyFromBase(channel, inMin, inMax, ratioMin, ratioMax, baseA);
          const freqB = modulateFrequencyFromBase(channel, inMin, inMax, ratioMin, ratioMax, baseB);
          const ratio = mapRange(channel, inMin, inMax, ratioMin, ratioMax);
          const minHz = 20;
          fc.pre(baseA * ratio >= minHz && baseB * ratio >= minHz);
          expect(freqA / baseA).toBeCloseTo(freqB / baseB, 10);
        },
      ),
    );
  });
});

describe('resolveVoiceParams', () => {
  it('returns resting oscillator params when the chain is incomplete', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.double({ min: 40, max: 800, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        sampleArb,
        (oscId, frequencyHz, gain, sample) => {
          const nodes: RuntimeNode[] = [
            {
              id: oscId,
              type: 'oscillator',
              data: { frequencyHz, gain, waveform: 'sine' },
            },
          ];
          const edges: RuntimeEdge[] = [];
          const params = resolveVoiceParams(nodes, edges, oscId, sample);
          expect(params.frequencyHz).toBe(frequencyHz);
          expect(params.gain).toBe(gain);
          expect(params.modulated).toBe(edges.length > 0);
        },
      ),
    );
  });

  it('multiplies oscillator frequencyHz by the mapped ratio for mag→frequencyHz', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        sampleArb,
        audioHz,
        (connId, modId, oscId, sample, restingFreq) => {
          fc.pre(new Set([connId, modId, oscId]).size === 3);
          const restingGain = 0.2;
          const inMin = 1;
          const inMax = 8;
          const outMin = 0.5;
          const outMax = 4;
          const nodes: RuntimeNode[] = [
            { id: connId, type: 'connector', data: { kindKey: 'usgs_earthquakes' } },
            {
              id: modId,
              type: 'modulator',
              data: {
                channelKey: 'mag',
                targetParam: 'frequencyHz',
                inMin,
                inMax,
                outMin,
                outMax,
              },
            },
            {
              id: oscId,
              type: 'oscillator',
              data: { frequencyHz: restingFreq, gain: restingGain, waveform: 'sine' },
            },
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: connId, target: modId },
            { id: 'b', source: modId, target: oscId },
          ];
          const params = resolveVoiceParams(nodes, edges, oscId, sample);
          const expectedFreq = modulateFrequencyFromBase(
            sample.mag,
            inMin,
            inMax,
            outMin,
            outMax,
            restingFreq,
          );
          expect(params.modulated).toBe(Boolean(sample));
          expect(params.gain).toBe(restingGain);
          expect(params.frequencyHz).toBe(expectedFreq);
        },
      ),
    );
  });

  it('ignores a sample whose kindKey does not match the connector', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        sampleArb,
        fc.record({
          kindKey: fc.constant('noaa_coops_tides' as const),
          id: fc.string({ minLength: 1, maxLength: 12 }),
          stationId: fc.stringMatching(/^[0-9]{7}$/),
          waterLevel: fc.option(fc.double({ min: -2, max: 4, noNaN: true }), { nil: null }),
          time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
        }),
        audioHz,
        (connId, modId, oscId, usgsSample, noaaSample, restingFreq) => {
          fc.pre(new Set([connId, modId, oscId]).size === 3);
          const restingGain = 0.2;
          const nodes: RuntimeNode[] = [
            { id: connId, type: 'connector', data: { kindKey: 'usgs_earthquakes' } },
            {
              id: modId,
              type: 'modulator',
              data: {
                channelKey: 'mag',
                targetParam: 'frequencyHz',
                inMin: 1,
                inMax: 8,
                outMin: 0.5,
                outMax: 4,
              },
            },
            {
              id: oscId,
              type: 'oscillator',
              data: { frequencyHz: restingFreq, gain: restingGain, waveform: 'sine' },
            },
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: connId, target: modId },
            { id: 'b', source: modId, target: oscId },
          ];
          const withUsgs = resolveVoiceParams(nodes, edges, oscId, usgsSample);
          const withNoaa = resolveVoiceParams(nodes, edges, oscId, noaaSample);
          const resting = false;
          expect(withNoaa.frequencyHz).toBe(restingFreq);
          expect(withNoaa.modulated).toBe(resting);
          expect(withUsgs.frequencyHz).toBe(
            modulateFrequencyFromBase(usgsSample.mag, 1, 8, 0.5, 4, restingFreq),
          );
        },
      ),
    );
  });
});

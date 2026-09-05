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
  id: fc.string({ minLength: 1, maxLength: 12 }),
  mag: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
  depthKm: fc.option(fc.double({ min: 0, max: 700, noNaN: true }), { nil: null }),
  sig: fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null }),
  place: fc.string(),
  time: fc.integer({ min: 0, max: 2_000_000_000_000 }),
}) satisfies fc.Arbitrary<EarthquakeSample>;

const audioHz = fc.integer({ min: 40, max: 2000 });

describe('modulateFrequencyFromBase', () => {
  it('returns the base frequency when the channel is missing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, Number.NaN),
        audioHz,
        audioHz,
        audioHz,
        audioHz,
        audioHz,
        (channel, inMin, inMax, outMin, outMax, base) => {
          expect(modulateFrequencyFromBase(channel, inMin, inMax, outMin, outMax, base)).toBe(base);
        },
      ),
    );
  });

  it('shifts the mapped absolute Hz by the same delta as the base frequency', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        audioHz,
        audioHz,
        audioHz,
        audioHz,
        audioHz,
        audioHz,
        (channel, inMin, inMax, outMin, outMax, baseA, baseB) => {
          fc.pre(inMin !== inMax);
          const freqA = modulateFrequencyFromBase(channel, inMin, inMax, outMin, outMax, baseA);
          const freqB = modulateFrequencyFromBase(channel, inMin, inMax, outMin, outMax, baseB);
          const mapped = mapRange(channel, inMin, inMax, outMin, outMax);
          const mid = (outMin + outMax) / 2;
          const unclampedA = baseA + (mapped - mid);
          const unclampedB = baseB + (mapped - mid);
          const minHz = 20;
          const expectA = Math.max(minHz, unclampedA);
          const expectB = Math.max(minHz, unclampedB);
          expect(freqA).toBe(expectA);
          expect(freqB).toBe(expectB);
          expect(freqB - freqA).toBe(expectB - expectA);
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

  it('uses oscillator frequencyHz as the base when mag modulates frequencyHz', () => {
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
          const outMin = 110;
          const outMax = 880;
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
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapChannelOrRest } from './mapRange';
import { resolveVoiceParams, type EarthquakeSample } from './resolveVoiceParams';
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

  it('matches mapChannelOrRest for mag→frequencyHz on a complete chain', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, sampleArb, (connId, modId, oscId, sample) => {
        fc.pre(new Set([connId, modId, oscId]).size === 3);
        const restingFreq = 220;
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
        const expectedFreq = mapChannelOrRest(
          sample.mag,
          inMin,
          inMax,
          outMin,
          outMax,
          restingFreq,
        );
        const expectModulated = Boolean(sample);
        expect(params.modulated).toBe(expectModulated);
        expect(params.gain).toBe(restingGain);
        expect(params.frequencyHz).toBe(expectedFreq);
      }),
    );
  });
});

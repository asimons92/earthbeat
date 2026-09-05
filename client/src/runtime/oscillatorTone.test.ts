import { el, isNode } from '@elemaudio/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  OSCILLATOR_WAVEFORM_KEYS,
  buildOscillatorTone,
  elemNodeHash,
  oscillatorWaveformUsesFrequency,
  planVoiceEnsure,
  resolveOscillatorWaveform,
  type OscillatorWaveformKey,
} from './oscillatorTone';

const waveformKeyArb = fc.constantFrom(...OSCILLATOR_WAVEFORM_KEYS);
const unknownWaveformArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((value) => !(OSCILLATOR_WAVEFORM_KEYS as readonly string[]).includes(value));

const defaultWaveform = OSCILLATOR_WAVEFORM_KEYS[0];
const alternateWaveform = OSCILLATOR_WAVEFORM_KEYS[1];

const createPlan = planVoiceEnsure(undefined, defaultWaveform);
const reusePlan = planVoiceEnsure(defaultWaveform, defaultWaveform);
const rebuildPlan = planVoiceEnsure(defaultWaveform, alternateWaveform);

function freqMarker(tag: string, hz: number) {
  return el.const({ key: tag, value: hz });
}

describe('resolveOscillatorWaveform', () => {
  it('returns every catalog key unchanged', () => {
    fc.assert(
      fc.property(waveformKeyArb, (key) => {
        expect(resolveOscillatorWaveform(key)).toBe(key);
      }),
    );
  });

  it('falls unknown strings back to the default waveform', () => {
    fc.assert(
      fc.property(unknownWaveformArb, (raw) => {
        expect(resolveOscillatorWaveform(raw)).toBe(defaultWaveform);
      }),
    );
  });
});

describe('buildOscillatorTone', () => {
  it('produces a defined ElemNode for every catalog waveform', () => {
    fc.assert(
      fc.property(waveformKeyArb, fc.integer({ min: 20, max: 2000 }), (key, hz) => {
        const tone = buildOscillatorTone(key, freqMarker(`f-${key}`, hz));
        expect(isNode(tone)).toBe(isNode(el.const({ value: hz })));
      }),
    );
  });

  it('falls unknown waveforms back to the default tone graph', () => {
    fc.assert(
      fc.property(unknownWaveformArb, fc.integer({ min: 20, max: 2000 }), (raw, hz) => {
        const marker = freqMarker('fallback-freq', hz);
        const unknownTone = buildOscillatorTone(raw, marker);
        const defaultTone = buildOscillatorTone(defaultWaveform, marker);
        expect(elemNodeHash(unknownTone)).toBe(elemNodeHash(defaultTone));
      }),
    );
  });

  it('wires frequency into pitched tones and ignores it for unpitched tones', () => {
    fc.assert(
      fc.property(
        waveformKeyArb,
        fc.integer({ min: 40, max: 800 }),
        fc.integer({ min: 801, max: 2000 }),
        (key, hzA, hzB) => {
          const toneA = buildOscillatorTone(key, freqMarker('freq-a', hzA));
          const toneB = buildOscillatorTone(key, freqMarker('freq-b', hzB));
          const hashA = elemNodeHash(toneA);
          const hashB = elemNodeHash(toneB);
          const hashesMatch = hashA === hashB;
          expect(hashesMatch).toBe(!oscillatorWaveformUsesFrequency(key));
        },
      ),
    );
  });
});

describe('planVoiceEnsure', () => {
  it('creates when no voice exists', () => {
    fc.assert(
      fc.property(waveformKeyArb, (requested) => {
        expect(planVoiceEnsure(undefined, requested)).toBe(createPlan);
      }),
    );
  });

  it('reuses when the resolved waveform matches', () => {
    fc.assert(
      fc.property(waveformKeyArb, (key) => {
        const existing: OscillatorWaveformKey = key;
        expect(planVoiceEnsure(existing, existing)).toBe(reusePlan);
      }),
    );
  });

  it('rebuilds when resolved waveforms differ', () => {
    fc.assert(
      fc.property(waveformKeyArb, waveformKeyArb, (existing, requested) => {
        fc.pre(resolveOscillatorWaveform(existing) !== resolveOscillatorWaveform(requested));
        expect(planVoiceEnsure(existing, requested)).toBe(rebuildPlan);
      }),
    );
  });

  it('treats unknown requested waveforms as the default for reuse or rebuild', () => {
    fc.assert(
      fc.property(waveformKeyArb, unknownWaveformArb, (existing, unknown) => {
        const plan = planVoiceEnsure(existing, unknown);
        const expected =
          resolveOscillatorWaveform(existing) === defaultWaveform ? reusePlan : rebuildPlan;
        expect(plan).toBe(expected);
      }),
    );
  });
});

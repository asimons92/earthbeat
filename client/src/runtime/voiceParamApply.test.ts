import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  OSCILLATOR_WAVEFORM_KEYS,
  oscillatorWaveformUsesFrequency,
  resolveOscillatorWaveform,
} from './oscillatorTone';
import { planVoiceParamApply } from './voiceParamApply';

const waveformKeyArb = fc.constantFrom(...OSCILLATOR_WAVEFORM_KEYS);
const hzArb = fc.double({ min: 20, max: 2000, noNaN: true });
const gainArb = fc.double({ min: 0, max: 1, noNaN: true });

describe('planVoiceParamApply', () => {
  it('always plans a gain update for every waveform', () => {
    fc.assert(
      fc.property(waveformKeyArb, hzArb, gainArb, (waveform, frequencyHz, gain) => {
        const plan = planVoiceParamApply(waveform, frequencyHz, gain);
        expect(plan.gain).toBe(gain);
      }),
    );
  });

  it('omits frequency when the waveform does not mount a frequency ref', () => {
    fc.assert(
      fc.property(waveformKeyArb, hzArb, gainArb, (waveform, frequencyHz, gain) => {
        const plan = planVoiceParamApply(waveform, frequencyHz, gain);
        const usesFrequency = oscillatorWaveformUsesFrequency(resolveOscillatorWaveform(waveform));
        expect(plan.frequencyHz === null).toBe(!usesFrequency);
        const expectedFrequency = usesFrequency ? frequencyHz : plan.frequencyHz;
        expect(plan.frequencyHz).toBe(expectedFrequency);
      }),
    );
  });

  it('keeps gain planned for every frequency-independent waveform', () => {
    const unpitched = OSCILLATOR_WAVEFORM_KEYS.filter(
      (key) => !oscillatorWaveformUsesFrequency(key),
    );
    fc.assert(
      fc.property(fc.constantFrom(...unpitched), hzArb, gainArb, (waveform, frequencyHz, gain) => {
        const plan = planVoiceParamApply(waveform, frequencyHz, gain);
        expect(plan.frequencyHz === null).toBe(
          !oscillatorWaveformUsesFrequency(resolveOscillatorWaveform(waveform)),
        );
        expect(plan.gain).toBe(gain);
      }),
    );
  });
});

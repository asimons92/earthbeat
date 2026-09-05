import {
  oscillatorWaveformUsesFrequency,
  resolveOscillatorWaveform,
} from './oscillatorTone';

export type VoiceParamApplyPlan = {
  /** Hertz to push, or null when the voice does not mount a frequency ref. */
  frequencyHz: number | null;
  gain: number;
};

/**
 * Decide which live voice params to push after resolveVoiceParams.
 * Noise (and any frequency-independent waveform) must skip frequency updates:
 * Elementary rejects setProps on refs that were never rendered into the graph.
 */
export function planVoiceParamApply(
  waveform: string,
  frequencyHz: number,
  gain: number,
): VoiceParamApplyPlan {
  const resolved = resolveOscillatorWaveform(waveform);
  return {
    frequencyHz: oscillatorWaveformUsesFrequency(resolved) ? frequencyHz : null,
    gain,
  };
}

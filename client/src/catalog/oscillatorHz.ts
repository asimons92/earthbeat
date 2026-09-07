/** Round and format Oscillator Hertz for canvas status and knob commits. */

const HZ_DECIMALS = 1;
const HZ_FACTOR = 10 ** HZ_DECIMALS;

/** Round Hertz to one decimal so log-knob floats stay readable on the canvas. */
export function roundFrequencyHz(frequencyHz: number): number {
  if (!Number.isFinite(frequencyHz)) return frequencyHz;
  return Math.round(frequencyHz * HZ_FACTOR) / HZ_FACTOR;
}

/** Canvas / status line for an Oscillator resting frequency. */
export function formatOscillatorHzStatus(frequencyHz: number): string {
  return `${roundFrequencyHz(frequencyHz)} Hz`;
}

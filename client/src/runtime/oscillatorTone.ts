import { el, isNode, type ElemNode } from '@elemaudio/core';

/** Legal Oscillator waveform keys (must match Clay Oscillator.waveform enum). */
export const OSCILLATOR_WAVEFORM_KEYS = ['sine', 'square', 'saw', 'noise'] as const;

export type OscillatorWaveformKey = (typeof OSCILLATOR_WAVEFORM_KEYS)[number];

const WAVEFORM_SET: ReadonlySet<string> = new Set(OSCILLATOR_WAVEFORM_KEYS);

/** Waveforms that ignore frequencyHz for the audible source (white noise). */
const FREQUENCY_INDEPENDENT: ReadonlySet<OscillatorWaveformKey> = new Set(
  OSCILLATOR_WAVEFORM_KEYS.filter((key) => key === 'noise'),
);

export function resolveOscillatorWaveform(raw: string): OscillatorWaveformKey {
  if (WAVEFORM_SET.has(raw)) {
    return raw as OscillatorWaveformKey;
  }
  return OSCILLATOR_WAVEFORM_KEYS[0];
}

export function oscillatorWaveformUsesFrequency(key: OscillatorWaveformKey): boolean {
  return !FREQUENCY_INDEPENDENT.has(key);
}

export type VoiceEnsurePlan = 'create' | 'reuse' | 'rebuild';

/**
 * Decide whether ensureVoice can keep the existing Elementary voice or must rebuild.
 * Compares resolved waveform keys and optional audio FX fingerprints.
 */
export function planVoiceEnsure(
  existingWaveform: string | undefined,
  requestedWaveform: string,
  existingFxFingerprint: string = '',
  requestedFxFingerprint: string = '',
): VoiceEnsurePlan {
  const next = resolveOscillatorWaveform(requestedWaveform);
  if (existingWaveform === undefined) {
    return 'create';
  }
  if (
    resolveOscillatorWaveform(existingWaveform) === next &&
    existingFxFingerprint === requestedFxFingerprint
  ) {
    return 'reuse';
  }
  return 'rebuild';
}

/**
 * Pure Elementary tone for one Oscillator waveform.
 * Pitched shapes take `freqHzNode` in Hz. Noise ignores it.
 */
export function buildOscillatorTone(waveform: string, freqHzNode: ElemNode): ElemNode {
  const resolved = resolveOscillatorWaveform(waveform);
  switch (resolved) {
    case 'square':
      return el.blepsquare(freqHzNode);
    case 'saw':
      return el.blepsaw(freqHzNode);
    case 'noise':
      return el.noise();
    case 'sine':
      return el.sin(el.mul(2 * Math.PI, el.phasor(freqHzNode)));
  }
}

/** Stable hash for property tests (ElemNode graphs only). */
export function elemNodeHash(node: ElemNode): number {
  if (!isNode(node)) {
    return Number(node);
  }
  return node.hash;
}

/** Equal-temperament scale snap for ScaleSnap Effects (A4 reference). */

import { scaleSnapScales, scaleSnapTonics } from '@/generated/catalog';

export const MIN_AUDIBLE_HZ = 20;

export const TONIC_PITCH_CLASSES: Readonly<Record<string, number>> = Object.fromEntries(
  scaleSnapTonics.map((tonic, index) => [tonic.key, index]),
);

/** Scale intervals from Clay catalog (same source as inspector labels). */
export const SCALE_DEGREES: Readonly<Record<string, readonly number[]>> = Object.fromEntries(
  scaleSnapScales.map((scale) => [scale.key, scale.degrees]),
);

export type ScaleSnapParams = {
  enabled: boolean;
  tonic: string;
  scaleKey: string;
  a4Hz: number;
};

export function midiFromHz(frequencyHz: number, a4Hz: number): number {
  return 69 + 12 * Math.log2(frequencyHz / a4Hz);
}

export function hzFromMidi(midi: number, a4Hz: number): number {
  return a4Hz * 2 ** ((midi - 69) / 12);
}

export function pitchClassForTonic(tonic: string): number | undefined {
  return TONIC_PITCH_CLASSES[tonic];
}

export function degreesForScale(scaleKey: string): readonly number[] | undefined {
  return SCALE_DEGREES[scaleKey];
}

/** Build allowed pitch classes for a tonic and scale degree list. */
export function allowedPitchClasses(tonicPc: number, scaleDegrees: readonly number[]): Set<number> {
  return new Set(scaleDegrees.map((degree) => (tonicPc + degree) % 12));
}

/**
 * Snap Hertz to the nearest equal-temperament pitch in tonic+scale.
 * Equidistant ties round up (higher pitch).
 */
export function snapFrequencyToScale(
  frequencyHz: number,
  params: ScaleSnapParams,
): number {
  if (!params.enabled) {
    return frequencyHz;
  }
  if (!Number.isFinite(frequencyHz)) {
    return frequencyHz;
  }

  const tonicPc = pitchClassForTonic(params.tonic);
  const degrees = degreesForScale(params.scaleKey);
  if (tonicPc === undefined || !degrees || degrees.length === 0) {
    // Unknown tonic/scale: leave Hertz unchanged (fail open).
    return frequencyHz;
  }

  const a4Hz = params.a4Hz > 0 ? params.a4Hz : 440;
  const workingHz = Math.max(MIN_AUDIBLE_HZ, frequencyHz);
  const continuousMidi = midiFromHz(workingHz, a4Hz);
  const allowed = allowedPitchClasses(tonicPc, degrees);

  let bestMidi: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  const searchLo = Math.floor(continuousMidi) - 24;
  const searchHi = Math.ceil(continuousMidi) + 24;

  for (let midi = searchLo; midi <= searchHi; midi++) {
    const pc = ((midi % 12) + 12) % 12;
    if (!allowed.has(pc)) continue;
    const candidateHz = hzFromMidi(midi, a4Hz);
    if (candidateHz < MIN_AUDIBLE_HZ) continue;
    const dist = Math.abs(midi - continuousMidi);
    if (bestMidi === null || dist < bestDist - 1e-12) {
      bestDist = dist;
      bestMidi = midi;
    } else if (Math.abs(dist - bestDist) <= 1e-12 && midi > bestMidi) {
      bestMidi = midi;
    }
  }

  if (bestMidi === null) {
    return Math.max(MIN_AUDIBLE_HZ, frequencyHz);
  }
  return hzFromMidi(bestMidi, a4Hz);
}

/** Apply ScaleSnap Effects in source-to-sink order onto Hertz. */
export function applyScaleSnapChain(
  frequencyHz: number,
  effects: readonly ScaleSnapParams[],
): number {
  let hz = frequencyHz;
  for (const effect of effects) {
    hz = snapFrequencyToScale(hz, effect);
  }
  return hz;
}

/** Bake Distortion and Delay into an Elementary tone graph. */

import { el, type ElemNode } from '@elemaudio/core';

import type { AudioFxStep } from './audioFxChain';
import {
  clampDrive,
  clampFeedback,
  clampMix,
  clampTimeMs,
  DELAY_MAX_SECONDS,
} from './audioFxParams';

function applyDistortion(input: ElemNode, drive: number): ElemNode {
  const g = clampDrive(drive);
  const wet = el.tanh(el.mul(g, input));
  // Normalize by tanh(drive) so full-scale stays near unity while the curve stays audible.
  // Dividing by drive itself undoes the effect for quiet Oscillator gains.
  return el.mul(1 / Math.tanh(g), wet);
}

function applyDelay(
  input: ElemNode,
  timeMs: number,
  feedback: number,
  mix: number,
  sampleRateHz: number,
): ElemNode {
  const ms = clampTimeMs(timeMs);
  const fb = clampFeedback(feedback);
  const wetAmt = clampMix(mix);
  const dryAmt = 1 - wetAmt;
  const size = Math.max(1, Math.ceil(sampleRateHz * DELAY_MAX_SECONDS));
  const delayed = el.delay(
    { size },
    el.ms2samps(ms),
    fb,
    input,
  );
  return el.add(el.mul(dryAmt, input), el.mul(wetAmt, delayed));
}

/**
 * Wrap a dry gained Oscillator tone with ordered audio Effect steps.
 * Bypassed steps leave the signal unchanged.
 */
export function applyAudioFxChain(
  dryTone: ElemNode,
  steps: AudioFxStep[],
  sampleRateHz: number = 48000,
): ElemNode {
  let tone = dryTone;
  for (const step of steps) {
    if (!step.enabled) continue;
    if (step.kind === 'distortion') {
      tone = applyDistortion(tone, step.drive);
    } else {
      tone = applyDelay(tone, step.timeMs, step.feedback, step.mix, sampleRateHz);
    }
  }
  return tone;
}

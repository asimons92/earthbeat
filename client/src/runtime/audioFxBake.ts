/** Bake Distortion, Delay, filters, and ADSR into an Elementary tone graph. */

import { el, type ElemNode } from '@elemaudio/core';

import type { AudioFxStep } from './audioFxChain';
import {
  clampAttackSec,
  clampCutoffHz,
  clampDecaySec,
  clampDrive,
  clampFeedback,
  clampGate,
  clampMix,
  clampQ,
  clampReleaseSec,
  clampSustain,
  clampTimeMs,
  DELAY_MAX_SECONDS,
} from './audioFxParams';

/** Optional live const refs keyed by `${stepId}:${param}`. */
export type AudioFxParamRefs = Map<string, ElemNode>;

export function audioFxRefKey(stepId: string, param: string): string {
  return `${stepId}:${param}`;
}

function paramNode(
  refs: AudioFxParamRefs | undefined,
  stepId: string,
  param: string,
  value: number,
): ElemNode {
  const fromRef = refs?.get(audioFxRefKey(stepId, param));
  if (fromRef) return fromRef;
  // Numbers are legal ElemNode children. Avoid keyed consts here so bake tests
  // and one-shot graphs keep distinct hashes when values change.
  return value;
}

function applyDistortion(
  input: ElemNode,
  stepId: string,
  drive: number,
  refs?: AudioFxParamRefs,
): ElemNode {
  const g = paramNode(refs, stepId, 'drive', clampDrive(drive));
  const wet = el.tanh(el.mul(g, input));
  // Makeup uses the resting drive number so the graph stays stable when drive is a ref.
  const makeup = 1 / Math.tanh(clampDrive(drive));
  return el.mul(makeup, wet);
}

function applyDelay(
  input: ElemNode,
  stepId: string,
  timeMs: number,
  feedback: number,
  mix: number,
  sampleRateHz: number,
  refs?: AudioFxParamRefs,
): ElemNode {
  const ms = paramNode(refs, stepId, 'timeMs', clampTimeMs(timeMs));
  const fb = paramNode(refs, stepId, 'feedback', clampFeedback(feedback));
  const wetAmt = paramNode(refs, stepId, 'mix', clampMix(mix));
  const dryAmt = el.sub(1, wetAmt);
  const size = Math.max(1, Math.ceil(sampleRateHz * DELAY_MAX_SECONDS));
  const delayed = el.delay({ size }, el.ms2samps(ms), fb, input);
  return el.add(el.mul(dryAmt, input), el.mul(wetAmt, delayed));
}

function applyFilter(
  mode: 'lowpass' | 'highpass' | 'bandpass',
  input: ElemNode,
  stepId: string,
  cutoffHz: number,
  q: number,
  sampleRateHz: number,
  refs?: AudioFxParamRefs,
): ElemNode {
  const fc = paramNode(
    refs,
    stepId,
    'cutoffHz',
    clampCutoffHz(cutoffHz, sampleRateHz),
  );
  const qNode = paramNode(refs, stepId, 'q', clampQ(q));
  if (mode === 'lowpass') return el.lowpass(fc, qNode, input);
  if (mode === 'highpass') return el.highpass(fc, qNode, input);
  return el.bandpass(fc, qNode, input);
}

function applyAdsr(
  input: ElemNode,
  stepId: string,
  attackSec: number,
  decaySec: number,
  sustain: number,
  releaseSec: number,
  gate: number,
  refs?: AudioFxParamRefs,
): ElemNode {
  const a = paramNode(refs, stepId, 'attackSec', clampAttackSec(attackSec));
  const d = paramNode(refs, stepId, 'decaySec', clampDecaySec(decaySec));
  const s = paramNode(refs, stepId, 'sustain', clampSustain(sustain));
  const r = paramNode(refs, stepId, 'releaseSec', clampReleaseSec(releaseSec));
  const g = paramNode(refs, stepId, 'gate', clampGate(gate));
  return el.mul(input, el.adsr(a, d, s, r, g));
}

/**
 * Wrap a dry gained Oscillator tone with ordered audio Effect steps.
 * Bypassed steps leave the signal unchanged.
 */
export function applyAudioFxChain(
  dryTone: ElemNode,
  steps: AudioFxStep[],
  sampleRateHz: number = 48000,
  refs?: AudioFxParamRefs,
): ElemNode {
  let tone = dryTone;
  for (const step of steps) {
    if (!step.enabled) continue;
    if (step.kind === 'distortion') {
      tone = applyDistortion(tone, step.id, step.drive, refs);
    } else if (step.kind === 'delay') {
      tone = applyDelay(
        tone,
        step.id,
        step.timeMs,
        step.feedback,
        step.mix,
        sampleRateHz,
        refs,
      );
    } else if (
      step.kind === 'lowpass' ||
      step.kind === 'highpass' ||
      step.kind === 'bandpass'
    ) {
      tone = applyFilter(
        step.kind,
        tone,
        step.id,
        step.cutoffHz,
        step.q,
        sampleRateHz,
        refs,
      );
    } else if (step.kind === 'adsr') {
      tone = applyAdsr(
        tone,
        step.id,
        step.attackSec,
        step.decaySec,
        step.sustain,
        step.releaseSec,
        step.gate,
        refs,
      );
    }
  }
  return tone;
}

/** Resolve Connector → Modulator → Effect (mod handle) into live AudioFxStep params. */

import { channelFromSample, type ConnectorSample } from './channelFromSample';
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
} from './audioFxParams';
import { mapChannelOrRest } from './mapRange';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';
import type { EarthquakeSample, SamplesByConnector } from './resolveVoiceParams';
import { isModTargetHandle } from '@/workspace/patchWireRules';

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normalizeSample(
  sample: SamplesByConnector[string] | null | undefined,
): ConnectorSample | null {
  if (!sample) return null;
  if (
    sample.kindKey === 'noaa_coops_tides' ||
    sample.kindKey === 'usgs_earthquakes' ||
    sample.kindKey === 'ndbc_buoy_waves'
  ) {
    return sample as ConnectorSample;
  }
  const legacy = sample as EarthquakeSample;
  return {
    kindKey: 'usgs_earthquakes',
    id: legacy.id,
    mag: legacy.mag,
    depthKm: legacy.depthKm,
    sig: legacy.sig,
    place: legacy.place,
    time: legacy.time,
  };
}

type EffectModChain = {
  effectId: string;
  targetParam: string;
  channelKey: string;
  connector: RuntimeNode;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
};

function listEffectModChains(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
): EffectModChain[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chains: EffectModChain[] = [];

  for (const edge of edges) {
    if (!isModTargetHandle(edge.targetHandle)) continue;
    const effect = byId.get(edge.target);
    const modulator = byId.get(edge.source);
    if (!effect || effect.type !== 'effect') continue;
    if (!modulator || modulator.type !== 'modulator') continue;

    const intoMod = edges.find((candidate) => candidate.target === modulator.id);
    if (!intoMod) continue;
    const connector = byId.get(intoMod.source);
    if (!connector || connector.type !== 'connector') continue;

    const targetParam = asString(modulator.data.targetParam, '');
    const channelKey = asString(modulator.data.channelKey, '');
    if (targetParam.length === 0 || channelKey.length === 0) continue;

    chains.push({
      effectId: effect.id,
      targetParam,
      channelKey,
      connector,
      inMin: asNumber(modulator.data.inMin, 0),
      inMax: asNumber(modulator.data.inMax, 1),
      outMin: asNumber(modulator.data.outMin, 0),
      outMax: asNumber(modulator.data.outMax, 1),
    });
  }

  return chains;
}

function mappedParamValue(
  chain: EffectModChain,
  samplesByConnector: SamplesByConnector,
  resting: number,
): number {
  const raw = samplesByConnector[chain.connector.id];
  const sample = normalizeSample(raw);
  if (!sample) return resting;
  const connectorKind = asString(chain.connector.data.kindKey, '');
  if (connectorKind.length === 0 || sample.kindKey !== connectorKind) {
    return resting;
  }
  const channelValue = channelFromSample(sample, chain.channelKey, {
    interpolate:
      typeof chain.connector.data.interpolate === 'boolean'
        ? chain.connector.data.interpolate
        : true,
  });
  return mapChannelOrRest(
    channelValue,
    chain.inMin,
    chain.inMax,
    chain.outMin,
    chain.outMax,
    resting,
  );
}

function applyParamToStep(
  step: AudioFxStep,
  param: string,
  value: number,
  sampleRateHz: number,
): AudioFxStep {
  if (step.kind === 'distortion' && param === 'drive') {
    return { ...step, drive: clampDrive(value) };
  }
  if (step.kind === 'delay') {
    if (param === 'timeMs') return { ...step, timeMs: clampTimeMs(value) };
    if (param === 'feedback') return { ...step, feedback: clampFeedback(value) };
    if (param === 'mix') return { ...step, mix: clampMix(value) };
  }
  if (
    (step.kind === 'lowpass' || step.kind === 'highpass' || step.kind === 'bandpass') &&
    (param === 'cutoffHz' || param === 'q')
  ) {
    if (param === 'cutoffHz') {
      return { ...step, cutoffHz: clampCutoffHz(value, sampleRateHz) };
    }
    return { ...step, q: clampQ(value) };
  }
  if (step.kind === 'adsr') {
    if (param === 'attackSec') return { ...step, attackSec: clampAttackSec(value) };
    if (param === 'decaySec') return { ...step, decaySec: clampDecaySec(value) };
    if (param === 'sustain') return { ...step, sustain: clampSustain(value) };
    if (param === 'releaseSec') return { ...step, releaseSec: clampReleaseSec(value) };
    if (param === 'gate') return { ...step, gate: clampGate(value) };
  }
  return step;
}

function restingParam(step: AudioFxStep, param: string): number | null {
  if (step.kind === 'distortion' && param === 'drive') return step.drive;
  if (step.kind === 'delay') {
    if (param === 'timeMs') return step.timeMs;
    if (param === 'feedback') return step.feedback;
    if (param === 'mix') return step.mix;
  }
  if (step.kind === 'lowpass' || step.kind === 'highpass' || step.kind === 'bandpass') {
    if (param === 'cutoffHz') return step.cutoffHz;
    if (param === 'q') return step.q;
  }
  if (step.kind === 'adsr') {
    if (param === 'attackSec') return step.attackSec;
    if (param === 'decaySec') return step.decaySec;
    if (param === 'sustain') return step.sustain;
    if (param === 'releaseSec') return step.releaseSec;
    if (param === 'gate') return step.gate;
  }
  return null;
}

/**
 * Overlay Modulator → Effect maps onto resting audio FX steps.
 * Unknown target params for a step kind are ignored.
 */
export function applyEffectModulationToSteps(
  steps: AudioFxStep[],
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  samplesByConnector: SamplesByConnector,
  sampleRateHz: number = 48000,
): AudioFxStep[] {
  const chains = listEffectModChains(nodes, edges);
  if (chains.length === 0) return steps;

  return steps.map((step) => {
    let next = step;
    for (const chain of chains) {
      if (chain.effectId !== step.id) continue;
      const resting = restingParam(next, chain.targetParam);
      if (resting === null) continue;
      const mapped = mappedParamValue(chain, samplesByConnector, resting);
      next = applyParamToStep(next, chain.targetParam, mapped, sampleRateHz);
    }
    return next;
  });
}

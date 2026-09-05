import { mapChannelOrRest, mapRange } from './mapRange';
import { findModulationChain, type RuntimeEdge, type RuntimeNode } from './modulationChain';

export type EarthquakeSample = {
  id: string;
  mag: number | null;
  depthKm: number | null;
  sig: number | null;
  place: string;
  time: number;
};

export type VoiceParams = {
  frequencyHz: number;
  gain: number;
  modulated: boolean;
};

const MIN_AUDIBLE_HZ = 20;

function channelFromSample(sample: EarthquakeSample, channelKey: string): number | null {
  if (channelKey === 'mag') return sample.mag;
  if (channelKey === 'depthKm') return sample.depthKm;
  if (channelKey === 'sig') return sample.sig;
  return null;
}

/**
 * Map a channel onto a ratio range, then multiply the Oscillator base frequency.
 * outMin/outMax are multipliers (for example 0.5 to 4), not absolute Hz.
 */
export function modulateFrequencyFromBase(
  channelValue: number | null | undefined,
  inMin: number,
  inMax: number,
  ratioMin: number,
  ratioMax: number,
  baseFrequencyHz: number,
): number {
  if (channelValue === null || channelValue === undefined || Number.isNaN(channelValue)) {
    return baseFrequencyHz;
  }
  const ratio = mapRange(channelValue, inMin, inMax, ratioMin, ratioMax);
  return Math.max(MIN_AUDIBLE_HZ, baseFrequencyHz * ratio);
}

export function resolveVoiceParams(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
  sample: EarthquakeSample | null,
): VoiceParams {
  const chain = findModulationChain(nodes, edges, oscillatorId);
  const oscData = chain.oscillator.data;
  const restingFreq =
    typeof oscData.frequencyHz === 'number' ? oscData.frequencyHz : 220;
  const restingGain = typeof oscData.gain === 'number' ? oscData.gain : 0.2;

  if (!chain.complete || !sample) {
    return { frequencyHz: restingFreq, gain: restingGain, modulated: false };
  }

  const channelValue = channelFromSample(sample, chain.channelKey);

  if (chain.targetParam === 'gain') {
    const mappedGain = mapChannelOrRest(
      channelValue,
      chain.inMin,
      chain.inMax,
      chain.outMin,
      chain.outMax,
      restingGain,
    );
    return { frequencyHz: restingFreq, gain: mappedGain, modulated: true };
  }

  const frequencyHz = modulateFrequencyFromBase(
    channelValue,
    chain.inMin,
    chain.inMax,
    chain.outMin,
    chain.outMax,
    restingFreq,
  );

  return { frequencyHz, gain: restingGain, modulated: true };
}

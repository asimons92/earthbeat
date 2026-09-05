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
 * Map a channel onto absolute outMin/outMax, then recenter so the Oscillator
 * frequencyHz is the audible base (midpoint of the Modulator out range).
 */
export function modulateFrequencyFromBase(
  channelValue: number | null | undefined,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  baseFrequencyHz: number,
): number {
  if (channelValue === null || channelValue === undefined || Number.isNaN(channelValue)) {
    return baseFrequencyHz;
  }
  const mapped = mapRange(channelValue, inMin, inMax, outMin, outMax);
  const mid = (outMin + outMax) / 2;
  return Math.max(MIN_AUDIBLE_HZ, baseFrequencyHz + (mapped - mid));
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

import { mapChannelOrRest } from './mapRange';
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

function channelFromSample(sample: EarthquakeSample, channelKey: string): number | null {
  if (channelKey === 'mag') return sample.mag;
  if (channelKey === 'depthKm') return sample.depthKm;
  if (channelKey === 'sig') return sample.sig;
  return null;
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
  const mapped = mapChannelOrRest(
    channelValue,
    chain.inMin,
    chain.inMax,
    chain.outMin,
    chain.outMax,
    chain.targetParam === 'gain' ? restingGain : restingFreq,
  );

  if (chain.targetParam === 'gain') {
    return { frequencyHz: restingFreq, gain: mapped, modulated: true };
  }

  return { frequencyHz: mapped, gain: restingGain, modulated: true };
}

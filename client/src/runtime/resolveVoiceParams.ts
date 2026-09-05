import { mapChannelOrRest, mapRange } from './mapRange';
import { findModulationChain, type RuntimeEdge, type RuntimeNode } from './modulationChain';
import {
  channelFromSample,
  type ConnectorSample,
  type UsgsConnectorSample,
} from './channelFromSample';

export type { ConnectorSample, NoaaConnectorSample, UsgsConnectorSample } from './channelFromSample';
export { channelFromSample } from './channelFromSample';

/** Legacy USGS sample without kindKey; normalize to UsgsConnectorSample. */
export type EarthquakeSample = Omit<UsgsConnectorSample, 'kindKey'> & {
  kindKey?: 'usgs_earthquakes';
};

export type VoiceParams = {
  frequencyHz: number;
  gain: number;
  modulated: boolean;
};

const MIN_AUDIBLE_HZ = 20;

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

function normalizeSample(sample: ConnectorSample | EarthquakeSample | null): ConnectorSample | null {
  if (!sample) return null;
  if (sample.kindKey === 'noaa_coops_tides' || sample.kindKey === 'usgs_earthquakes') {
    return sample as ConnectorSample;
  }
  return {
    kindKey: 'usgs_earthquakes',
    id: sample.id,
    mag: sample.mag,
    depthKm: sample.depthKm,
    sig: sample.sig,
    place: sample.place,
    time: sample.time,
  };
}

export function resolveVoiceParams(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
  sample: ConnectorSample | EarthquakeSample | null,
): VoiceParams {
  const chain = findModulationChain(nodes, edges, oscillatorId);
  const oscData = chain.oscillator.data;
  const restingFreq =
    typeof oscData.frequencyHz === 'number' ? oscData.frequencyHz : 220;
  const restingGain = typeof oscData.gain === 'number' ? oscData.gain : 0.2;
  const resting = { frequencyHz: restingFreq, gain: restingGain, modulated: false };

  if (!chain.complete || !sample) {
    return resting;
  }

  const normalized = normalizeSample(sample);
  if (!normalized) return resting;

  const connectorKind =
    typeof chain.connector.data.kindKey === 'string' ? chain.connector.data.kindKey : '';
  if (connectorKind.length === 0 || normalized.kindKey !== connectorKind) {
    return resting;
  }

  const channelValue = channelFromSample(normalized, chain.channelKey, {
    interpolate:
      typeof chain.connector.data.interpolate === 'boolean'
        ? chain.connector.data.interpolate
        : true,
  });

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

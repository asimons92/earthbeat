import { mapChannelOrRest, mapRange } from './mapRange';
import {
  findVoiceGraph,
  type RuntimeEdge,
  type RuntimeNode,
} from './modulationChain';
import {
  channelFromSample,
  type ConnectorSample,
  type UsgsConnectorSample,
} from './channelFromSample';
import { applyScaleSnapChain, MIN_AUDIBLE_HZ } from './scaleSnap';

export type { ConnectorSample, NoaaConnectorSample, NdbcWaveConnectorSample, UsgsConnectorSample } from './channelFromSample';
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

export type SamplesByKind = Partial<Record<string, ConnectorSample | EarthquakeSample>>;

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
  if (
    sample.kindKey === 'noaa_coops_tides' ||
    sample.kindKey === 'usgs_earthquakes' ||
    sample.kindKey === 'ndbc_buoy_waves'
  ) {
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

function samplesMapFrom(
  sampleOrMap: SamplesByKind | ConnectorSample | EarthquakeSample | null,
): SamplesByKind {
  if (!sampleOrMap) return {};
  const asRecord = sampleOrMap as Record<string, unknown>;
  const looksLikeSingleSample =
    typeof asRecord.id === 'string' &&
    !('usgs_earthquakes' in asRecord) &&
    !('noaa_coops_tides' in asRecord) &&
    !('ndbc_buoy_waves' in asRecord);
  if (looksLikeSingleSample) {
    const normalized = normalizeSample(sampleOrMap as ConnectorSample | EarthquakeSample);
    if (!normalized) return {};
    return { [normalized.kindKey]: normalized };
  }
  return sampleOrMap as SamplesByKind;
}

function mapChainChannel(
  chain: {
    connector: RuntimeNode;
    channelKey: string;
  },
  sample: ConnectorSample,
): { matched: boolean; channelValue: number | null } {
  const connectorKind =
    typeof chain.connector.data.kindKey === 'string' ? chain.connector.data.kindKey : '';
  if (connectorKind.length === 0 || sample.kindKey !== connectorKind) {
    return { matched: false, channelValue: null };
  }
  return {
    matched: true,
    channelValue: channelFromSample(sample, chain.channelKey, {
      interpolate:
        typeof chain.connector.data.interpolate === 'boolean'
          ? chain.connector.data.interpolate
          : true,
    }),
  };
}

function sampleForConnector(
  chain: { connector: RuntimeNode },
  samplesByKind: SamplesByKind,
): ConnectorSample | null {
  const kindKey =
    typeof chain.connector.data.kindKey === 'string' ? chain.connector.data.kindKey : '';
  if (kindKey.length === 0) return null;
  return normalizeSample(samplesByKind[kindKey] ?? null);
}

export function resolveVoiceParams(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
  sampleOrMap: SamplesByKind | ConnectorSample | EarthquakeSample | null,
): VoiceParams {
  const graph = findVoiceGraph(nodes, edges, oscillatorId);
  const oscData = graph.oscillator.data;
  const restingFreq =
    typeof oscData.frequencyHz === 'number' ? oscData.frequencyHz : 220;
  const restingGain = typeof oscData.gain === 'number' ? oscData.gain : 0.2;

  let frequencyHz = restingFreq;
  let gain = restingGain;
  let modulated = false;

  const samplesByKind = samplesMapFrom(sampleOrMap);

  if (graph.frequencyChain) {
    const sample = sampleForConnector(graph.frequencyChain, samplesByKind);
    if (sample) {
      const mapped = mapChainChannel(graph.frequencyChain, sample);
      if (mapped.matched) {
        frequencyHz = modulateFrequencyFromBase(
          mapped.channelValue,
          graph.frequencyChain.inMin,
          graph.frequencyChain.inMax,
          graph.frequencyChain.outMin,
          graph.frequencyChain.outMax,
          restingFreq,
        );
        modulated = true;
      }
    }
  }

  if (graph.gainChain) {
    const sample = sampleForConnector(graph.gainChain, samplesByKind);
    if (sample) {
      const mapped = mapChainChannel(graph.gainChain, sample);
      if (mapped.matched) {
        gain = mapChannelOrRest(
          mapped.channelValue,
          graph.gainChain.inMin,
          graph.gainChain.inMax,
          graph.gainChain.outMin,
          graph.gainChain.outMax,
          restingGain,
        );
        modulated = true;
      }
    }
  }

  frequencyHz = applyScaleSnapChain(frequencyHz, graph.frequencyEffects);

  return { frequencyHz, gain, modulated };
}

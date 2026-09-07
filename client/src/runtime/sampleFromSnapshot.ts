/** Build ConnectorSample values from SSE snapshots and client clocks. */

import type {
  ConnectorSample,
  NdbcWaveConnectorSample,
  NoaaConnectorSample,
  UsgsConnectorSample,
} from './channelFromSample';
import {
  sampleTideSeriesLevel,
  sampleWaveSeriesChannel,
  seriesAnchorTime,
  type TideSeriesPoint,
  type WaveSeriesPoint,
} from './scrubSample';

export type UsgsQueueSnapshot = {
  kindKey: 'usgs_earthquakes';
  items: UsgsConnectorSample[];
};

export type TideSeriesSnapshot = {
  kindKey: 'noaa_coops_tides';
  stationId: string;
  points: TideSeriesPoint[];
};

export type WaveSeriesSnapshot = {
  kindKey: 'ndbc_buoy_waves';
  stationId: string;
  points: WaveSeriesPoint[];
};

export type KindSnapshot =
  | UsgsQueueSnapshot
  | TideSeriesSnapshot
  | WaveSeriesSnapshot;

export function isUsgsQueueSnapshot(value: unknown): value is UsgsQueueSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as { kindKey?: unknown; items?: unknown };
  return record.kindKey === 'usgs_earthquakes' && Array.isArray(record.items);
}

export function isTideSeriesSnapshot(value: unknown): value is TideSeriesSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as { kindKey?: unknown; points?: unknown };
  return record.kindKey === 'noaa_coops_tides' && Array.isArray(record.points);
}

export function isWaveSeriesSnapshot(value: unknown): value is WaveSeriesSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as { kindKey?: unknown; points?: unknown };
  return record.kindKey === 'ndbc_buoy_waves' && Array.isArray(record.points);
}

export function sampleFromUsgsQueue(
  snapshot: UsgsQueueSnapshot,
  cursor: number,
): UsgsConnectorSample | null {
  if (snapshot.items.length === 0) return null;
  const index = ((cursor % snapshot.items.length) + snapshot.items.length) % snapshot.items.length;
  return snapshot.items[index] ?? null;
}

export function sampleFromTideSeries(
  snapshot: TideSeriesSnapshot,
  phase: number,
): NoaaConnectorSample | null {
  if (snapshot.points.length === 0) return null;
  const waterLevel = sampleTideSeriesLevel(snapshot.points, phase, true);
  const waterLevelStep = sampleTideSeriesLevel(snapshot.points, phase, false);
  const time = seriesAnchorTime(
    snapshot.points.map((point) => point.time),
    phase,
  );
  return {
    kindKey: 'noaa_coops_tides',
    id: `scrub-${snapshot.stationId}-${Math.floor(phase * 1000)}`,
    stationId: snapshot.stationId,
    waterLevel: waterLevel ?? null,
    waterLevelStep: waterLevelStep ?? null,
    time,
  };
}

export function sampleFromWaveSeries(
  snapshot: WaveSeriesSnapshot,
  phase: number,
): NdbcWaveConnectorSample | null {
  if (snapshot.points.length === 0) return null;
  const waveHeight = sampleWaveSeriesChannel(snapshot.points, phase, 'waveHeight', true);
  const waveHeightStep = sampleWaveSeriesChannel(snapshot.points, phase, 'waveHeight', false);
  const wavePeriod = sampleWaveSeriesChannel(snapshot.points, phase, 'wavePeriod', true);
  const wavePeriodStep = sampleWaveSeriesChannel(snapshot.points, phase, 'wavePeriod', false);
  const time = seriesAnchorTime(
    snapshot.points.map((point) => point.time),
    phase,
  );
  return {
    kindKey: 'ndbc_buoy_waves',
    id: `scrub-${snapshot.stationId}-${Math.floor(phase * 1000)}`,
    stationId: snapshot.stationId,
    waveHeight: waveHeight ?? null,
    waveHeightStep: waveHeightStep ?? null,
    wavePeriod: wavePeriod ?? null,
    wavePeriodStep: wavePeriodStep ?? null,
    time,
  };
}

export function sampleFromKindSnapshot(
  snapshot: KindSnapshot,
  clock: { mode: 'scrub'; phase: number } | { mode: 'queue'; cursor: number },
): ConnectorSample | null {
  if (snapshot.kindKey === 'usgs_earthquakes') {
    if (clock.mode !== 'queue') return null;
    return sampleFromUsgsQueue(snapshot, clock.cursor);
  }
  if (clock.mode !== 'scrub') return null;
  if (snapshot.kindKey === 'noaa_coops_tides') {
    return sampleFromTideSeries(snapshot, clock.phase);
  }
  return sampleFromWaveSeries(snapshot, clock.phase);
}

/** Client-side scrub sampling for tide and wave series snapshots. */

export type TideSeriesPoint = {
  waterLevel: number;
  time: number;
};

export type WaveSeriesPoint = {
  waveHeight: number;
  wavePeriod: number;
  time: number;
};

function wrappedPhaseIndex(seriesLength: number, phase: number): {
  index: number;
  nextIndex: number;
  t: number;
} {
  const wrapped = phase - Math.floor(phase);
  const scaled = wrapped * seriesLength;
  const index = Math.floor(scaled) % seriesLength;
  const nextIndex = (index + 1) % seriesLength;
  const t = scaled - Math.floor(scaled);
  return { index, nextIndex, t };
}

export function sampleTideSeriesLevel(
  series: readonly TideSeriesPoint[],
  phase: number,
  interpolate: boolean,
): number | undefined {
  if (series.length === 0) return undefined;
  if (series.length === 1) return series[0]!.waterLevel;
  const { index, nextIndex, t } = wrappedPhaseIndex(series.length, phase);
  const a = series[index]!.waterLevel;
  if (!interpolate) return a;
  const b = series[nextIndex]!.waterLevel;
  return a + (b - a) * t;
}

export function sampleWaveSeriesChannel(
  series: readonly WaveSeriesPoint[],
  phase: number,
  channel: 'waveHeight' | 'wavePeriod',
  interpolate: boolean,
): number | undefined {
  if (series.length === 0) return undefined;
  if (series.length === 1) return series[0]![channel];
  const { index, nextIndex, t } = wrappedPhaseIndex(series.length, phase);
  const a = series[index]![channel];
  if (!interpolate) return a;
  const b = series[nextIndex]![channel];
  return a + (b - a) * t;
}

export function seriesAnchorTime(
  times: readonly number[],
  phase: number,
): number {
  if (times.length === 0) return Date.now();
  const wrapped = phase - Math.floor(phase);
  const index = Math.min(
    times.length - 1,
    Math.floor(wrapped * times.length),
  );
  return times[Math.max(0, index)] ?? times[0]!;
}

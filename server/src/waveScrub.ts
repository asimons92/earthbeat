/** Pure helpers: scrub a buoy wave series by phase in [0, 1). */

export type WaveSeriesPoint = {
  waveHeight: number;
  wavePeriod: number;
  time: number;
};

export type WaveSampleMode = {
  /** When true, linear-interpolate between adjacent points. When false, hold the current point. */
  interpolate: boolean;
};

export type WaveChannelKey = 'waveHeight' | 'wavePeriod';

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

/**
 * Sample one numeric channel for phase in [0, 1).
 * interpolate true: linear blend between adjacent points.
 * interpolate false: hold the current point (step).
 */
export function sampleWavePhase(
  series: readonly WaveSeriesPoint[],
  phase: number,
  channel: WaveChannelKey,
  mode: WaveSampleMode = { interpolate: true },
): number | undefined {
  if (series.length === 0) return undefined;
  if (series.length === 1) return series[0]![channel];

  const { index, nextIndex, t } = wrappedPhaseIndex(series.length, phase);
  const a = series[index]![channel];
  if (!mode.interpolate) return a;
  const b = series[nextIndex]![channel];
  return a + (b - a) * t;
}

/** Advance phase by dtSeconds over a full-loop duration of loopSeconds. */
export function advanceWavePhase(phase: number, dtSeconds: number, loopSeconds: number): number {
  if (!(loopSeconds > 0)) return phase - Math.floor(phase);
  const next = phase + dtSeconds / loopSeconds;
  return next - Math.floor(next);
}

export function seriesWaveChannelBounds(
  series: readonly WaveSeriesPoint[],
  channel: WaveChannelKey,
): { min: number; max: number } | undefined {
  if (series.length === 0) return undefined;
  let min = series[0]![channel];
  let max = series[0]![channel];
  for (const point of series) {
    const value = point[channel];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

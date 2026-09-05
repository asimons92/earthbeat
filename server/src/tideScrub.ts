/** Pure helpers: scrub a water-level series by phase in [0, 1). */

export type TideSeriesPoint = {
  waterLevel: number;
  time: number;
};

export type TideSampleMode = {
  /** When true, linear-interpolate between adjacent points. When false, hold the current point. */
  interpolate: boolean;
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

/**
 * Sample waterLevel for phase in [0, 1).
 * interpolate true: linear blend between adjacent points.
 * interpolate false: hold the current point (step).
 */
export function sampleTidePhase(
  series: readonly TideSeriesPoint[],
  phase: number,
  mode: TideSampleMode = { interpolate: true },
): number | undefined {
  if (series.length === 0) return undefined;
  if (series.length === 1) return series[0]!.waterLevel;

  const { index, nextIndex, t } = wrappedPhaseIndex(series.length, phase);
  const a = series[index]!.waterLevel;
  if (!mode.interpolate) return a;
  const b = series[nextIndex]!.waterLevel;
  return a + (b - a) * t;
}

/** @deprecated Prefer sampleTidePhase with interpolate mode. */
export function interpolateTidePhase(
  series: readonly TideSeriesPoint[],
  phase: number,
): number | undefined {
  return sampleTidePhase(series, phase, { interpolate: true });
}

/** Advance phase by dtSeconds over a full-loop duration of loopSeconds. */
export function advanceTidePhase(phase: number, dtSeconds: number, loopSeconds: number): number {
  if (!(loopSeconds > 0)) return phase - Math.floor(phase);
  const next = phase + dtSeconds / loopSeconds;
  return next - Math.floor(next);
}

export function seriesWaterLevelBounds(
  series: readonly TideSeriesPoint[],
): { min: number; max: number } | undefined {
  if (series.length === 0) return undefined;
  let min = series[0]!.waterLevel;
  let max = series[0]!.waterLevel;
  for (const point of series) {
    if (point.waterLevel < min) min = point.waterLevel;
    if (point.waterLevel > max) max = point.waterLevel;
  }
  return { min, max };
}

/** Pure SVG path builder for AnalyserNode time-domain snapshots. */

/**
 * Map a float time-domain buffer (−1..1) to an SVG path in a viewBox of width×height.
 * Empty or all-non-finite buffers yield a flat midline.
 */
export function timeDomainToSvgPath(
  samples: ArrayLike<number>,
  width: number,
  height: number,
): string {
  const mid = height / 2;
  if (samples.length === 0 || width <= 0 || height <= 0) {
    return `M0 ${mid} L${Math.max(width, 0)} ${mid}`;
  }

  const last = samples.length - 1;
  let d = '';
  for (let i = 0; i < samples.length; i++) {
    const raw = samples[i]!;
    const yNorm = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
    const x = last === 0 ? 0 : (i / last) * width;
    const y = mid - yNorm * mid;
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  return d;
}

/**
 * Map a Channel history series into an SVG path using inMin/inMax for the Y scale.
 */
export function channelHistoryToSvgPath(
  values: readonly number[],
  inMin: number,
  inMax: number,
  width: number,
  height: number,
): string {
  const mid = height / 2;
  if (values.length === 0 || width <= 0 || height <= 0) {
    return `M0 ${mid} L${Math.max(width, 0)} ${mid}`;
  }

  const span = inMax - inMin;
  const last = values.length - 1;
  let d = '';
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    let yNorm = 0;
    if (Number.isFinite(value) && span !== 0) {
      yNorm = ((value - inMin) / span) * 2 - 1;
      yNorm = Math.max(-1, Math.min(1, yNorm));
    } else if (Number.isFinite(value) && span === 0) {
      yNorm = 0;
    }
    const x = last === 0 ? 0 : (i / last) * width;
    const y = mid - yNorm * mid;
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  return d;
}

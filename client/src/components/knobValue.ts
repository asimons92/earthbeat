/** Pure knob travel math: clamp, linear/log norm maps, and norm-space nudge. */

export type KnobCurve = 'linear' | 'log';

export function clampKnobValue(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) return min;
  if (raw < min) return min;
  if (raw > max) return max;
  return raw;
}

function clampNorm(norm: number): number {
  if (!Number.isFinite(norm)) return 0;
  if (norm < 0) return 0;
  if (norm > 1) return 1;
  return norm;
}

function resolveCurve(min: number, max: number, curve: KnobCurve): KnobCurve {
  if (curve === 'log' && !(min > 0 && max > min)) return 'linear';
  return curve;
}

/**
 * Map a value in [min, max] onto the closed unit interval.
 * Log uses natural log so the geometric mean sits at mid travel.
 */
export function valueToNorm(
  value: number,
  min: number,
  max: number,
  curve: KnobCurve,
): number {
  const resolved = resolveCurve(min, max, curve);
  const v = clampKnobValue(value, min, max);
  if (min === max) return 0;
  if (!(min < max)) return 0;
  if (resolved === 'log') {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    if (!(logMin < logMax)) return 0;
    return (Math.log(v) - logMin) / (logMax - logMin);
  }
  return (v - min) / (max - min);
}

/** Map a unit-interval norm back into [min, max]. Norm outside [0, 1] is clamped. */
export function normToValue(
  norm: number,
  min: number,
  max: number,
  curve: KnobCurve,
): number {
  const resolved = resolveCurve(min, max, curve);
  const t = clampNorm(norm);
  if (!(min < max)) return min;
  let mapped: number;
  if (resolved === 'log') {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    if (!(logMin < logMax)) return min;
    mapped = Math.exp(logMin + t * (logMax - logMin));
  } else {
    mapped = min + t * (max - min);
  }
  return clampKnobValue(mapped, min, max);
}

/**
 * Move a knob by a signed delta in norm space, then clamp.
 * Vertical drag and keyboard arrows both call this.
 */
export function nudgeKnob(
  value: number,
  min: number,
  max: number,
  curve: KnobCurve,
  deltaNorm: number,
): number {
  if (!Number.isFinite(deltaNorm) || deltaNorm === 0) {
    return clampKnobValue(value, min, max);
  }
  const current = valueToNorm(value, min, max, curve);
  return normToValue(current + deltaNorm, min, max, curve);
}

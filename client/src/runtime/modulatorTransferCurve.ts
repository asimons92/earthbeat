import { mapRange } from './mapRange';

/** Soft pad on a locked catalog span so clamp shelves stay visible at the edges. */
export const DOMAIN_PAD_FRACTION = 0.2;

export type TransferCurveRanges = {
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
};

export type AxisLock = {
  min: number;
  max: number;
};

export type TransferCurvePoint = {
  x: number;
  y: number;
};

export type TransferCurveDomainOptions = {
  /** Catalog Channel mapHint (or min/max). Axes stay put while ranges stay inside. */
  xLock?: AxisLock | null;
  /** Catalog target modulationOut bounds. */
  yLock?: AxisLock | null;
  channelValue?: number | null;
  padFraction?: number;
};

export type TransferCurveGeometry = {
  xDomain: { min: number; max: number };
  yDomain: { min: number; max: number };
  /** Data-space polyline: left shelf, inMin, inMax, right shelf. */
  anchors: TransferCurvePoint[];
  /** Same anchors in SVG pixel space (Y down). */
  polyline: TransferCurvePoint[];
  livePoint: TransferCurvePoint | null;
  livePointSvg: TransferCurvePoint | null;
  xTicks: number[];
  yTicks: number[];
};

function finiteSpan(a: number, b: number): number {
  const span = Math.abs(b - a);
  if (span > 0 && Number.isFinite(span)) return span;
  const fallback = Math.max(Math.abs(a), Math.abs(b), 1);
  return fallback;
}

function padDomain(
  low: number,
  high: number,
  padFraction: number,
): { min: number; max: number } {
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  const pad = finiteSpan(lo, hi) * padFraction;
  return { min: lo - pad, max: hi + pad };
}

function finiteExtras(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (value): value is number =>
      value !== null && value !== undefined && Number.isFinite(value),
  );
}

/**
 * Build one axis domain. With a lock, pad the lock once and expand only when
 * extras fall outside so normal knob moves keep the frame still.
 */
export function resolveAxisDomain(
  lock: AxisLock | null | undefined,
  extras: Array<number | null | undefined>,
  padFraction: number = DOMAIN_PAD_FRACTION,
): { min: number; max: number } {
  const finite = finiteExtras(extras);
  if (lock != null && Number.isFinite(lock.min) && Number.isFinite(lock.max)) {
    const padded = padDomain(lock.min, lock.max, padFraction);
    if (finite.length === 0) return padded;
    return {
      min: Math.min(padded.min, ...finite),
      max: Math.max(padded.max, ...finite),
    };
  }
  if (finite.length === 0) {
    return padDomain(0, 1, padFraction);
  }
  if (finite.length === 1) {
    return padDomain(finite[0]!, finite[0]!, padFraction);
  }
  return padDomain(Math.min(...finite), Math.max(...finite), padFraction);
}

/** Axis domains from catalog locks, expanded only when ranges leave the lock. */
export function transferCurveDomains(
  ranges: TransferCurveRanges,
  options: TransferCurveDomainOptions = {},
): { xDomain: { min: number; max: number }; yDomain: { min: number; max: number } } {
  const padFraction = options.padFraction ?? DOMAIN_PAD_FRACTION;
  return {
    xDomain: resolveAxisDomain(
      options.xLock,
      [ranges.inMin, ranges.inMax, options.channelValue],
      padFraction,
    ),
    yDomain: resolveAxisDomain(
      options.yLock,
      [ranges.outMin, ranges.outMax],
      padFraction,
    ),
  };
}

/**
 * Live sample in data space, or null when the channel value is missing.
 * Y always equals mapRange for a finite channel value.
 */
export function transferCurveLivePoint(
  channelValue: number | null | undefined,
  ranges: TransferCurveRanges,
): TransferCurvePoint | null {
  if (channelValue === null || channelValue === undefined || Number.isNaN(channelValue)) {
    return null;
  }
  return {
    x: channelValue,
    y: mapRange(
      channelValue,
      ranges.inMin,
      ranges.inMax,
      ranges.outMin,
      ranges.outMax,
    ),
  };
}

/**
 * Four data-space anchors for the clamp shelves and linear segment.
 * Knees are sorted by ascending X so inverted inMin/inMax still draw one
 * left-to-right transfer curve (no Z). Y at each X equals mapRange.
 */
export function transferCurveAnchors(
  ranges: TransferCurveRanges,
  options: TransferCurveDomainOptions = {},
): TransferCurvePoint[] {
  const { xDomain } = transferCurveDomains(ranges, options);
  const kneeLo = Math.min(ranges.inMin, ranges.inMax);
  const kneeHi = Math.max(ranges.inMin, ranges.inMax);
  const xs = [xDomain.min, kneeLo, kneeHi, xDomain.max];
  return xs.map((x) => ({
    x,
    y: mapRange(x, ranges.inMin, ranges.inMax, ranges.outMin, ranges.outMax),
  }));
}

function dataToSvgX(
  x: number,
  xDomain: { min: number; max: number },
  width: number,
): number {
  const span = xDomain.max - xDomain.min;
  if (span === 0) return width / 2;
  return ((x - xDomain.min) / span) * width;
}

/** SVG Y grows downward, so higher out maps to a smaller pixel Y. */
function dataToSvgY(
  y: number,
  yDomain: { min: number; max: number },
  height: number,
): number {
  const span = yDomain.max - yDomain.min;
  if (span === 0) return height / 2;
  return ((yDomain.max - y) / span) * height;
}

function tickValues(domain: { min: number; max: number }): number[] {
  return [domain.min, (domain.min + domain.max) / 2, domain.max];
}

/**
 * Full plot geometry for the Modulator transfer curve SVG.
 */
export function modulatorTransferCurve(
  ranges: TransferCurveRanges,
  options: {
    width: number;
    height: number;
    channelValue?: number | null;
    xLock?: AxisLock | null;
    yLock?: AxisLock | null;
    padFraction?: number;
  },
): TransferCurveGeometry {
  const domainOptions: TransferCurveDomainOptions = {
    xLock: options.xLock,
    yLock: options.yLock,
    channelValue: options.channelValue,
    padFraction: options.padFraction,
  };
  const { xDomain, yDomain } = transferCurveDomains(ranges, domainOptions);
  const anchors = transferCurveAnchors(ranges, domainOptions);
  const livePoint = transferCurveLivePoint(options.channelValue, ranges);

  const toSvg = (point: TransferCurvePoint): TransferCurvePoint => ({
    x: dataToSvgX(point.x, xDomain, options.width),
    y: dataToSvgY(point.y, yDomain, options.height),
  });

  return {
    xDomain,
    yDomain,
    anchors,
    polyline: anchors.map(toSvg),
    livePoint,
    livePointSvg: livePoint ? toSvg(livePoint) : null,
    xTicks: tickValues(xDomain),
    yTicks: tickValues(yDomain),
  };
}

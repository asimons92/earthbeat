/** Linear map from an input range onto an output range with clamp. */

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMin === inMax) {
    return outMin;
  }
  const tRaw = (value - inMin) / (inMax - inMin);
  const t = Math.min(1, Math.max(0, tRaw));
  return outMin + t * (outMax - outMin);
}

/**
 * Map a sample channel onto a target param, or return resting when the channel is missing.
 */
export function mapChannelOrRest(
  channelValue: number | null | undefined,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  resting: number,
): number {
  if (channelValue === null || channelValue === undefined || Number.isNaN(channelValue)) {
    return resting;
  }
  return mapRange(channelValue, inMin, inMax, outMin, outMax);
}

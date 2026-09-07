/**
 * Per-Connector playback speed (unitless multiplier of catalog tempo).
 */

export const PLAYBACK_SPEED_MIN = 0.25;
export const PLAYBACK_SPEED_MAX = 16;
export const PLAYBACK_SPEED_DEFAULT = 1;

/** Clamp and coerce raw node data to a finite speed in [MIN, MAX]. */
export function normalizePlaybackSpeed(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return PLAYBACK_SPEED_DEFAULT;
  }
  if (raw < PLAYBACK_SPEED_MIN) return PLAYBACK_SPEED_MIN;
  if (raw > PLAYBACK_SPEED_MAX) return PLAYBACK_SPEED_MAX;
  return raw;
}

/**
 * Scrub loop length in seconds for ocean ConnectorKinds.
 * Catalog default divided by normalized playbackSpeed.
 */
export function effectiveLoopSeconds(
  defaultLoopSeconds: number,
  playbackSpeed: unknown,
): number {
  return defaultLoopSeconds / normalizePlaybackSpeed(playbackSpeed);
}

/**
 * USGS queue emission rate in hits per second.
 * Catalog defaultPlaybackHz multiplied by normalized playbackSpeed.
 */
export function effectivePlaybackHz(
  defaultPlaybackHz: number,
  playbackSpeed: unknown,
): number {
  return defaultPlaybackHz * normalizePlaybackSpeed(playbackSpeed);
}

/** Monitor strips always walk the feed at catalog tempo. */
export function monitorPlaybackSpeed(): number {
  return PLAYBACK_SPEED_DEFAULT;
}

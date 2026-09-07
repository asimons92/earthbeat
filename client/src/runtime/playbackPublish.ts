/**
 * Decide when the playback frame loop may touch React or Monitor history.
 * Clocks and voice params stay on every animation frame.
 */

/** Minimum wall time between React sample publishes (about 20 Hz). */
export const UI_PUBLISH_INTERVAL_MS = 50;

/** Scrub history steps per full loop (matches MONITOR_HISTORY_CAPACITY). */
export const SCRUB_HISTORY_BUCKETS = 120;

/** True when enough wall time passed since the last UI publish. */
export function shouldPublishUiAt(
  nowMs: number,
  lastPublishMs: number | null,
  intervalMs: number = UI_PUBLISH_INTERVAL_MS,
): boolean {
  if (!(intervalMs > 0)) return true;
  if (lastPublishMs === null) return true;
  if (!(nowMs >= lastPublishMs)) return true;
  return nowMs - lastPublishMs >= intervalMs;
}

export type MonitorHistoryKey =
  | { mode: 'queue'; cursor: number }
  | { mode: 'scrub'; phaseBucket: number };

/** Map scrub phase in [0, 1) to a stable history bucket. */
export function scrubPhaseBucket(
  phase: number,
  buckets: number = SCRUB_HISTORY_BUCKETS,
): number {
  if (!(buckets > 0) || !Number.isFinite(phase)) return 0;
  const wrapped = phase - Math.floor(phase);
  const safeWrapped = wrapped < 1 ? wrapped : 0;
  return Math.min(buckets - 1, Math.floor(safeWrapped * buckets));
}

export function monitorHistoryKeyFromClock(
  clock: { mode: 'queue'; cursor: number } | { mode: 'scrub'; phase: number },
): MonitorHistoryKey {
  if (clock.mode === 'queue') {
    return { mode: 'queue', cursor: clock.cursor };
  }
  return { mode: 'scrub', phaseBucket: scrubPhaseBucket(clock.phase) };
}

/**
 * Append Monitor history only when the queue cursor moves or the scrub
 * phase crosses a bucket. Stops duplicate USGS samples every animation frame.
 */
export function shouldAppendMonitorHistory(
  previous: MonitorHistoryKey | undefined,
  next: MonitorHistoryKey,
): boolean {
  if (previous === undefined) return true;
  if (previous.mode !== next.mode) return true;
  if (previous.mode === 'queue' && next.mode === 'queue') {
    return previous.cursor !== next.cursor;
  }
  if (previous.mode === 'scrub' && next.mode === 'scrub') {
    return previous.phaseBucket !== next.phaseBucket;
  }
  return true;
}

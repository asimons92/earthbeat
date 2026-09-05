/** Ring buffers of Channel values for Monitor strips. */

import { channelFromSample, type ConnectorSample } from './channelFromSample';
import type { MonitorStrip } from './monitorStrips';

export const MONITOR_HISTORY_CAPACITY = 120;

export type SampleHistoryState = Record<string, number[]>;

export function emptySampleHistory(): SampleHistoryState {
  return {};
}

/** Drop strips that left the graph; keep buffers for remaining strip ids. */
export function pruneSampleHistory(
  history: SampleHistoryState,
  stripIds: Iterable<string>,
): SampleHistoryState {
  const keep = new Set(stripIds);
  const next: SampleHistoryState = {};
  for (const id of keep) {
    if (id in history) {
      next[id] = history[id]!;
    }
  }
  return next;
}

/**
 * Append one sample into every strip whose Connector kind matches.
 * Skips null Channel values. Caps each buffer at capacity.
 */
export function appendSampleToHistory(
  history: SampleHistoryState,
  strips: MonitorStrip[],
  sample: ConnectorSample,
  capacity: number = MONITOR_HISTORY_CAPACITY,
): SampleHistoryState {
  let changed = false;
  const next: SampleHistoryState = { ...history };
  for (const strip of strips) {
    if (strip.kindKey !== sample.kindKey) continue;
    const value = channelFromSample(sample, strip.channelKey);
    if (value == null || !Number.isFinite(value)) continue;
    const prev = next[strip.id] ?? [];
    const appended = prev.length >= capacity ? [...prev.slice(1), value] : [...prev, value];
    next[strip.id] = appended;
    changed = true;
  }
  return changed ? next : history;
}

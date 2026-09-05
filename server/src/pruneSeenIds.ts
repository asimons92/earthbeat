/**
 * Drop seen earthquake ids that are no longer in the latest feed and not in the playback queue.
 */
export function pruneSeenIds(
  seenIds: Set<string>,
  feedIds: Iterable<string>,
  queueIds: Iterable<string>,
): void {
  const keep = new Set<string>();
  for (const id of feedIds) keep.add(id);
  for (const id of queueIds) keep.add(id);
  for (const id of [...seenIds]) {
    if (!keep.has(id)) seenIds.delete(id);
  }
}

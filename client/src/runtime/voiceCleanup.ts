/**
 * Voices whose Oscillator left the graph must leave the Elementary mix.
 * Playing ids missing from the graph must stop first.
 */
export function planVoiceCleanup(
  graphOscillatorIds: ReadonlySet<string>,
  playingIds: ReadonlySet<string>,
  engineVoiceIds: ReadonlySet<string>,
): { stopIds: string[]; removeIds: string[] } {
  const stopIds: string[] = [];
  for (const id of playingIds) {
    if (!graphOscillatorIds.has(id)) stopIds.push(id);
  }
  const removeIds: string[] = [];
  for (const id of engineVoiceIds) {
    if (!graphOscillatorIds.has(id)) removeIds.push(id);
  }
  return { stopIds, removeIds };
}

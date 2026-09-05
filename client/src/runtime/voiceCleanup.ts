/**
 * Voices whose Oscillator left the graph must leave the Elementary mix.
 * Playing ids missing from the graph must stop first.
 * Engine voices that are not in the playing set are orphans and must leave too;
 * otherwise Stop (which only clears the playing set) cannot silence them.
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
    if (!graphOscillatorIds.has(id) || !playingIds.has(id)) removeIds.push(id);
  }
  return { stopIds, removeIds };
}

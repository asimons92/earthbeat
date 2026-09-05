/**
 * Stop must remove Elementary voices from the mix.
 * Mute-only loses a race with an in-flight sample apply that can unmute at
 * resting (base) Oscillator params after the shared stream is cleared.
 */

/** Oscillator ids that left the playing set and must leave the engine mix. */
export function planStoppedVoiceRemoval(
  prevPlaying: ReadonlySet<string>,
  nextPlaying: ReadonlySet<string>,
): string[] {
  const removeIds: string[] = [];
  for (const id of prevPlaying) {
    if (!nextPlaying.has(id)) removeIds.push(id);
  }
  return removeIds;
}

/**
 * An apply pass may start from a snapshot of playing ids.
 * Before ensureVoice, setFrequency, setGain, or unmute, the id must still be playing.
 */
export function filterLiveApplyTargets(
  snapshotPlaying: ReadonlySet<string>,
  livePlaying: ReadonlySet<string>,
): string[] {
  return [...snapshotPlaying].filter((id) => livePlaying.has(id));
}

/** True only while this Oscillator is still in the transport playing set. */
export function canApplyVoice(
  livePlaying: ReadonlySet<string>,
  oscillatorId: string,
): boolean {
  return livePlaying.has(oscillatorId);
}

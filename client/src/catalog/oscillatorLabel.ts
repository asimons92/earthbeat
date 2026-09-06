export type OscillatorWaveformEntry = {
  key: string;
  label: string;
};

/**
 * Canvas title for an Oscillator from the selected waveform catalog entry.
 * Matches Connector / Effect numbering: first instance is bare, later ones get a count suffix.
 */
export function oscillatorLabel(
  waveformKey: string,
  waveforms: readonly OscillatorWaveformEntry[],
  index = 0,
): string {
  const entry = waveforms.find((waveform) => waveform.key === waveformKey);
  const base = entry?.label ?? waveformKey;
  return index === 0 ? base : `${base} ${index + 1}`;
}

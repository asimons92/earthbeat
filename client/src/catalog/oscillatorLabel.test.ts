import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { oscillatorLabel } from './oscillatorLabel';

const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,24}$/);
const labelArb = fc.string({ minLength: 1, maxLength: 40 });
const indexArb = fc.nat({ max: 20 });

const waveformEntryArb = fc.record({
  key: keyArb,
  label: labelArb,
});

const waveformsArb = fc.uniqueArray(waveformEntryArb, {
  minLength: 1,
  maxLength: 8,
  selector: (entry) => entry.key,
});

describe('oscillatorLabel', () => {
  it('uses the catalog waveform label for a known key, with a count suffix after the first', () => {
    fc.assert(
      fc.property(waveformsArb, indexArb, (waveforms, index) => {
        const entry = waveforms[0]!;
        const label = oscillatorLabel(entry.key, waveforms, index);
        const expected = index === 0 ? entry.label : `${entry.label} ${index + 1}`;
        expect(label).toBe(expected);
      }),
    );
  });

  it('falls unknown waveform keys back to the key itself, still with count suffix', () => {
    fc.assert(
      fc.property(waveformsArb, keyArb, indexArb, (waveforms, foreignKey, index) => {
        fc.pre(!waveforms.some((entry) => entry.key === foreignKey));
        const label = oscillatorLabel(foreignKey, waveforms, index);
        const expected = index === 0 ? foreignKey : `${foreignKey} ${index + 1}`;
        expect(label).toBe(expected);
      }),
    );
  });

  it('never prefixes the title with a different catalog waveform label than the selected one', () => {
    fc.assert(
      fc.property(waveformsArb, indexArb, (waveforms, index) => {
        for (const entry of waveforms) {
          const label = oscillatorLabel(entry.key, waveforms, index);
          expect(label.slice(0, entry.label.length)).toBe(entry.label);
          for (const other of waveforms) {
            if (other.key === entry.key) continue;
            expect(label.startsWith(other.label)).toEqual(
              entry.label.startsWith(other.label),
            );
          }
        }
      }),
    );
  });
});

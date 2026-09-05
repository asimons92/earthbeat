import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  SCALE_DEGREES,
  TONIC_PITCH_CLASSES,
  applyScaleSnapChain,
  hzFromMidi,
  midiFromHz,
  snapFrequencyToScale,
  type ScaleSnapParams,
} from './scaleSnap';

const a4Arb = fc.constantFrom(440);
const tonicArb = fc.constantFrom(...Object.keys(TONIC_PITCH_CLASSES));
const scaleKeyArb = fc.constantFrom(...Object.keys(SCALE_DEGREES));
const hzArb = fc.double({ min: 20, max: 4000, noNaN: true, noDefaultInfinity: true });
const octaveArb = fc.integer({ min: 1, max: 7 });
const degreeIndexArb = fc.nat();

function params(
  tonic: string,
  scaleKey: string,
  enabled: boolean,
  a4Hz: number,
): ScaleSnapParams {
  return { tonic, scaleKey, enabled, a4Hz };
}

function scaleMidiFor(
  tonic: string,
  scaleKey: string,
  octave: number,
  degreeIndex: number,
): number | null {
  const tonicPc = TONIC_PITCH_CLASSES[tonic];
  const degrees = SCALE_DEGREES[scaleKey];
  if (tonicPc === undefined || !degrees || degrees.length === 0) return null;
  const degree = degrees[degreeIndex % degrees.length]!;
  const pc = (tonicPc + degree) % 12;
  // MIDI note: C4 = 60. Octave number here is MIDI octave (C of that octave = 12*(octave+1)).
  return 12 * (octave + 1) + pc;
}

describe('snapFrequencyToScale', () => {
  it('is identity when the Effect is disabled', () => {
    fc.assert(
      fc.property(hzArb, tonicArb, scaleKeyArb, a4Arb, (hz, tonic, scaleKey, a4Hz) => {
        const out = snapFrequencyToScale(hz, params(tonic, scaleKey, false, a4Hz));
        expect(out).toBe(hz);
      }),
    );
  });

  it('lands on a pitch class allowed by the tonic and scale', () => {
    fc.assert(
      fc.property(hzArb, tonicArb, scaleKeyArb, a4Arb, (hz, tonic, scaleKey, a4Hz) => {
        const out = snapFrequencyToScale(hz, params(tonic, scaleKey, true, a4Hz));
        const tonicPc = TONIC_PITCH_CLASSES[tonic]!;
        const degrees = SCALE_DEGREES[scaleKey]!;
        const allowed = new Set(degrees.map((degree) => (tonicPc + degree) % 12));
        const outMidi = midiFromHz(out, a4Hz);
        const nearestInt = Math.round(outMidi);
        expect(Math.abs(outMidi - nearestInt)).toBeLessThan(1e-9);
        const pc = ((nearestInt % 12) + 12) % 12;
        expect([...allowed]).toContain(pc);
      }),
    );
  });

  it('is a fixed point on pitches already in the scale', () => {
    fc.assert(
      fc.property(
        tonicArb,
        scaleKeyArb,
        octaveArb,
        degreeIndexArb,
        a4Arb,
        (tonic, scaleKey, octave, degreeIndex, a4Hz) => {
          const midi = scaleMidiFor(tonic, scaleKey, octave, degreeIndex);
          fc.pre(midi !== null);
          const inScaleHz = hzFromMidi(midi!, a4Hz);
          fc.pre(inScaleHz >= 20);
          const out = snapFrequencyToScale(inScaleHz, params(tonic, scaleKey, true, a4Hz));
          expect(out).toBeCloseTo(inScaleHz, 10);
        },
      ),
    );
  });

  it('rounds equidistant ties up to the higher pitch', () => {
    fc.assert(
      fc.property(
        tonicArb,
        scaleKeyArb,
        octaveArb,
        a4Arb,
        (tonic, scaleKey, octave, a4Hz) => {
          const degrees = SCALE_DEGREES[scaleKey]!;
          fc.pre(degrees.length >= 2);
          const lowMidi = scaleMidiFor(tonic, scaleKey, octave, 0);
          const highMidi = scaleMidiFor(tonic, scaleKey, octave, 1);
          fc.pre(lowMidi !== null && highMidi !== null);
          fc.pre(highMidi! > lowMidi!);
          // Ensure no scale pitch sits strictly between these two midis.
          const tonicPc = TONIC_PITCH_CLASSES[tonic]!;
          const allowed = new Set(degrees.map((degree) => (tonicPc + degree) % 12));
          for (let midi = lowMidi! + 1; midi < highMidi!; midi++) {
            const pc = ((midi % 12) + 12) % 12;
            fc.pre(!allowed.has(pc));
          }
          const midMidi = (lowMidi! + highMidi!) / 2;
          const midHz = hzFromMidi(midMidi, a4Hz);
          fc.pre(midHz >= 20);
          const highHz = hzFromMidi(highMidi!, a4Hz);
          const out = snapFrequencyToScale(midHz, params(tonic, scaleKey, true, a4Hz));
          expect(out).toBeCloseTo(highHz, 10);
        },
      ),
    );
  });
});

describe('applyScaleSnapChain', () => {
  it('leaves Hertz unchanged when every Effect is disabled', () => {
    fc.assert(
      fc.property(
        hzArb,
        fc.array(fc.record({ tonic: tonicArb, scaleKey: scaleKeyArb, a4Hz: a4Arb }), {
          minLength: 0,
          maxLength: 4,
        }),
        (hz, specs) => {
          const effects = specs.map((spec) => params(spec.tonic, spec.scaleKey, false, spec.a4Hz));
          expect(applyScaleSnapChain(hz, effects)).toBe(hz);
        },
      ),
    );
  });
});

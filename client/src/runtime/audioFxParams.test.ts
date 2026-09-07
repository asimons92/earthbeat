import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DRIVE_MAX,
  DRIVE_MIN,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
  MIX_MAX,
  MIX_MIN,
  TIME_MS_MAX,
  TIME_MS_MIN,
  roundDrive,
  roundFeedback,
  roundMix,
  roundTimeMs,
} from './audioFxParams';

const driveArb = fc.double({ min: DRIVE_MIN, max: DRIVE_MAX, noNaN: true });
const timeArb = fc.double({ min: TIME_MS_MIN, max: TIME_MS_MAX, noNaN: true });
const feedbackArb = fc.double({ min: FEEDBACK_MIN, max: FEEDBACK_MAX, noNaN: true });
const mixArb = fc.double({ min: MIX_MIN, max: MIX_MAX, noNaN: true });

describe('roundDrive / roundTimeMs / roundFeedback / roundMix', () => {
  it('keeps drive within half a tenth of the input', () => {
    const halfTenth = Number(0.05);
    fc.assert(
      fc.property(driveArb, (drive) => {
        expect(Math.abs(roundDrive(drive) - drive)).toBeLessThanOrEqual(halfTenth);
      }),
    );
  });

  it('keeps timeMs within half a millisecond of the input', () => {
    const halfMs = Number(0.5);
    fc.assert(
      fc.property(timeArb, (timeMs) => {
        expect(Math.abs(roundTimeMs(timeMs) - timeMs)).toBeLessThanOrEqual(halfMs);
      }),
    );
  });

  it('keeps feedback and mix within half a hundredth of the input', () => {
    const halfHundredth = Number(0.005);
    fc.assert(
      fc.property(feedbackArb, mixArb, (feedback, mix) => {
        expect(Math.abs(roundFeedback(feedback) - feedback)).toBeLessThanOrEqual(
          halfHundredth,
        );
        expect(Math.abs(roundMix(mix) - mix)).toBeLessThanOrEqual(halfHundredth);
      }),
    );
  });

  it('is idempotent for each rounder', () => {
    fc.assert(
      fc.property(driveArb, timeArb, feedbackArb, mixArb, (drive, timeMs, feedback, mix) => {
        const d = roundDrive(drive);
        const t = roundTimeMs(timeMs);
        const f = roundFeedback(feedback);
        const m = roundMix(mix);
        expect(roundDrive(d)).toBe(d);
        expect(roundTimeMs(t)).toBe(t);
        expect(roundFeedback(f)).toBe(f);
        expect(roundMix(m)).toBe(m);
      }),
    );
  });
});

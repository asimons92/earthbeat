import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  advanceQueueClock,
  advanceScrubClock,
  createQueueClock,
  createScrubClock,
  replaceQueueSnapshot,
  retainScrubPhaseOnSeriesReplace,
  setClockPlaying,
} from './connectorClock';
import {
  PLAYBACK_SPEED_DEFAULT,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
} from './playbackSpeed';

const phaseArb = fc.double({ min: -3, max: 3, noNaN: true, noDefaultInfinity: true });
const dtArb = fc.double({ min: 0.001, max: 2, noNaN: true, noDefaultInfinity: true });
const loopArb = fc.double({ min: 1, max: 600, noNaN: true, noDefaultInfinity: true });
const hzArb = fc.double({ min: 0.25, max: 64, noNaN: true, noDefaultInfinity: true });
const speedArb = fc.double({
  min: PLAYBACK_SPEED_MIN,
  max: PLAYBACK_SPEED_MAX,
  noNaN: true,
  noDefaultInfinity: true,
});
const queueLenArb = fc.integer({ min: 0, max: 64 });

describe('scrub clock', () => {
  it('does not move phase while playing is false', () => {
    fc.assert(
      fc.property(phaseArb, dtArb, loopArb, speedArb, (phase, dt, loop, speed) => {
        const stopped = setClockPlaying(createScrubClock(phase), false);
        const next = advanceScrubClock(stopped, dt, loop, speed);
        expect(next.phase).toBe(stopped.phase);
        expect(next.playing).toBe(stopped.playing);
      }),
    );
  });

  it('keeps phase in [0, 1) across random play advances', () => {
    fc.assert(
      fc.property(
        phaseArb,
        fc.array(dtArb, { minLength: 1, maxLength: 24 }),
        loopArb,
        speedArb,
        (phase, dts, loop, speed) => {
          let clock = setClockPlaying(createScrubClock(phase), true);
          for (const dt of dts) {
            clock = advanceScrubClock(clock, dt, loop, speed);
          }
          expect(clock.phase).toBeGreaterThanOrEqual(0);
          expect(clock.phase).toBeLessThan(1);
        },
      ),
    );
  });

  it('advances farther in the same dt when playbackSpeed is higher', () => {
    fc.assert(
      fc.property(dtArb, loopArb, speedArb, speedArb, (dt, loop, slower, faster) => {
        fc.pre(faster - slower > 0.05);
        fc.pre(dt / (loop / faster) < 0.9);
        const base = setClockPlaying(createScrubClock(0), true);
        const a = advanceScrubClock(base, dt, loop, slower);
        const b = advanceScrubClock(base, dt, loop, faster);
        expect(b.phase).toBeGreaterThan(a.phase);
      }),
    );
  });

  it('retains phase fraction when a series snapshot replaces points', () => {
    fc.assert(
      fc.property(phaseArb, (phase) => {
        const clock = setClockPlaying(createScrubClock(phase), true);
        const retained = retainScrubPhaseOnSeriesReplace(clock);
        expect(retained.phase).toBeCloseTo(clock.phase, 10);
        expect(retained.playing).toBe(clock.playing);
      }),
    );
  });

  it('freezes phase across Stop then resumes from the same phase on Play', () => {
    fc.assert(
      fc.property(phaseArb, dtArb, loopArb, speedArb, (phase, dt, loop, speed) => {
        let clock = setClockPlaying(createScrubClock(phase), true);
        clock = advanceScrubClock(clock, dt, loop, speed);
        const paused = setClockPlaying(clock, false);
        const whileStopped = advanceScrubClock(paused, dt, loop, speed);
        expect(whileStopped.phase).toBe(paused.phase);
        const resumed = setClockPlaying(whileStopped, true);
        expect(resumed.phase).toBe(whileStopped.phase);
        expect(resumed.playing).toBe(setClockPlaying(whileStopped, true).playing);
        expect(resumed.playing).not.toBe(paused.playing);
      }),
    );
  });
});

describe('queue clock', () => {
  it('does not move cursor while playing is false', () => {
    fc.assert(
      fc.property(queueLenArb, dtArb, hzArb, speedArb, (length, dt, hz, speed) => {
        fc.pre(length > 0);
        const stopped = setClockPlaying(createQueueClock(length, 0), false);
        const next = advanceQueueClock(stopped, dt, hz, speed);
        expect(next.cursor).toBe(stopped.cursor);
        expect(next.hitDebt).toBe(stopped.hitDebt);
      }),
    );
  });

  it('keeps cursor in range for non-empty queues across advances', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 64 }),
        fc.array(dtArb, { minLength: 1, maxLength: 24 }),
        hzArb,
        speedArb,
        (length, dts, hz, speed) => {
          let clock = setClockPlaying(createQueueClock(length, 0), true);
          for (const dt of dts) {
            clock = advanceQueueClock(clock, dt, hz, speed);
          }
          expect(clock.cursor).toBeGreaterThanOrEqual(0);
          expect(clock.cursor).toBeLessThan(clock.queueLength);
        },
      ),
    );
  });

  it('emits more cursor steps in the same dt when playbackSpeed is higher', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 64 }),
        dtArb,
        hzArb,
        speedArb,
        speedArb,
        (length, dt, hz, slower, faster) => {
          fc.pre(faster - slower > 0.05);
          fc.pre(dt * hz * faster < length);
          const base = setClockPlaying(createQueueClock(length, 0), true);
          const a = advanceQueueClock(base, dt, hz, slower);
          const b = advanceQueueClock(base, dt, hz, faster);
          const progress = (cursor: number, debt: number) => cursor + debt;
          expect(progress(b.cursor, b.hitDebt)).toBeGreaterThan(
            progress(a.cursor, a.hitDebt),
          );
        },
      ),
    );
  });

  it('at DEFAULT speed, hit progress matches dt times catalog Hz before wrap', () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 64 }), dtArb, hzArb, (length, dt, hz) => {
        fc.pre(dt * hz < length);
        const base = setClockPlaying(createQueueClock(length, 0), true);
        const next = advanceQueueClock(base, dt, hz, PLAYBACK_SPEED_DEFAULT);
        const expectedHits = dt * hz;
        const whole = Math.floor(expectedHits);
        const debt = expectedHits - whole;
        expect(next.cursor).toBe(whole % length);
        expect(next.hitDebt).toBeCloseTo(debt, 10);
      }),
    );
  });

  it('fits cursor into a shorter queue snapshot without leaving range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 64 }),
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 0, max: 64 }),
        (oldLen, newLen, cursor) => {
          const clock = createQueueClock(oldLen, cursor);
          const next = replaceQueueSnapshot(clock, newLen);
          const expectedLength = Math.max(0, Math.floor(newLen));
          const expectedCursor =
            expectedLength === 0
              ? createQueueClock(0).cursor
              : clock.cursor % expectedLength;
          expect(next.queueLength).toBe(expectedLength);
          expect(next.cursor).toBe(expectedCursor);
        },
      ),
    );
  });
});

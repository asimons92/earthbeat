import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  PLAYBACK_SPEED_DEFAULT,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  effectiveLoopSeconds,
  effectivePlaybackHz,
  monitorPlaybackSpeed,
  normalizePlaybackSpeed,
} from './playbackSpeed';

const finiteSpeed = fc.double({
  min: PLAYBACK_SPEED_MIN,
  max: PLAYBACK_SPEED_MAX,
  noNaN: true,
  noDefaultInfinity: true,
});

const positiveCatalog = fc.double({
  min: 0.001,
  max: 10_000,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('normalizePlaybackSpeed', () => {
  it('returns DEFAULT for missing, non-finite, or non-number input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(Number.NaN),
          fc.constant(Number.POSITIVE_INFINITY),
          fc.constant(Number.NEGATIVE_INFINITY),
          fc.string(),
          fc.boolean(),
          fc.constantFrom({}, []),
        ),
        (raw) => {
          expect(normalizePlaybackSpeed(raw)).toBe(PLAYBACK_SPEED_DEFAULT);
        },
      ),
    );
  });

  it('keeps finite values already inside the closed band', () => {
    fc.assert(
      fc.property(finiteSpeed, (raw) => {
        expect(normalizePlaybackSpeed(raw)).toBe(raw);
      }),
    );
  });

  it('clamps finite values below MIN up to MIN and above MAX down to MAX', () => {
    fc.assert(
      fc.property(
        fc.double({
          min: -1e6,
          max: PLAYBACK_SPEED_MIN,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        fc.double({
          min: PLAYBACK_SPEED_MAX,
          max: 1e6,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (tooLow, tooHigh) => {
          fc.pre(tooLow < PLAYBACK_SPEED_MIN);
          fc.pre(tooHigh > PLAYBACK_SPEED_MAX);
          expect(normalizePlaybackSpeed(tooLow)).toBe(PLAYBACK_SPEED_MIN);
          expect(normalizePlaybackSpeed(tooHigh)).toBe(PLAYBACK_SPEED_MAX);
        },
      ),
    );
  });
});

describe('effectiveLoopSeconds', () => {
  it('equals catalog loop length divided by normalized speed', () => {
    fc.assert(
      fc.property(positiveCatalog, finiteSpeed, (defaultLoop, speed) => {
        const expected = defaultLoop / speed;
        expect(effectiveLoopSeconds(defaultLoop, speed)).toBeCloseTo(expected, 10);
      }),
    );
  });

  it('matches catalog loop length when speed is DEFAULT (Monitor path)', () => {
    fc.assert(
      fc.property(positiveCatalog, (defaultLoop) => {
        const monitorSpeed = monitorPlaybackSpeed();
        expect(monitorSpeed).toBe(PLAYBACK_SPEED_DEFAULT);
        expect(effectiveLoopSeconds(defaultLoop, monitorSpeed)).toBeCloseTo(defaultLoop, 10);
      }),
    );
  });

  it('shortens the loop when speed rises inside the band', () => {
    fc.assert(
      fc.property(
        positiveCatalog,
        finiteSpeed,
        finiteSpeed,
        (defaultLoop, slower, faster) => {
          fc.pre(faster - slower > 0.05);
          const longLoop = effectiveLoopSeconds(defaultLoop, slower);
          const shortLoop = effectiveLoopSeconds(defaultLoop, faster);
          expect(shortLoop).toBeLessThan(longLoop);
        },
      ),
    );
  });
});

describe('effectivePlaybackHz', () => {
  it('equals catalog Hz multiplied by normalized speed', () => {
    fc.assert(
      fc.property(positiveCatalog, finiteSpeed, (defaultHz, speed) => {
        const expected = defaultHz * speed;
        expect(effectivePlaybackHz(defaultHz, speed)).toBeCloseTo(expected, 10);
      }),
    );
  });

  it('matches catalog Hz when speed is DEFAULT (Monitor path)', () => {
    fc.assert(
      fc.property(positiveCatalog, (defaultHz) => {
        const monitorSpeed = monitorPlaybackSpeed();
        expect(effectivePlaybackHz(defaultHz, monitorSpeed)).toBeCloseTo(defaultHz, 10);
      }),
    );
  });
});

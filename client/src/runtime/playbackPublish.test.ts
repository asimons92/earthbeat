import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  SCRUB_HISTORY_BUCKETS,
  UI_PUBLISH_INTERVAL_MS,
  monitorHistoryKeyFromClock,
  scrubPhaseBucket,
  shouldAppendMonitorHistory,
  shouldPublishUiAt,
  type MonitorHistoryKey,
} from './playbackPublish';

const finiteMs = fc.integer({ min: 0, max: 1_000_000 });
const positiveInterval = fc.integer({ min: 1, max: 10_000 });
const unitPhase = fc.double({
  min: -100,
  max: 100,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('shouldPublishUiAt', () => {
  it('publishes on the first tick when no prior publish time exists', () => {
    fc.assert(
      fc.property(finiteMs, positiveInterval, (nowMs, intervalMs) => {
        const lastPublishMs: number | null = null;
        expect(shouldPublishUiAt(nowMs, lastPublishMs, intervalMs)).toBe(
          lastPublishMs === null,
        );
      }),
    );
  });

  it('waits until the interval elapses after a prior publish', () => {
    fc.assert(
      fc.property(finiteMs, positiveInterval, (lastPublishMs, intervalMs) => {
        const elapsedSame = lastPublishMs - lastPublishMs;
        expect(shouldPublishUiAt(lastPublishMs, lastPublishMs, intervalMs)).toBe(
          elapsedSame >= intervalMs,
        );

        const elapsedExact = lastPublishMs + intervalMs - lastPublishMs;
        expect(
          shouldPublishUiAt(lastPublishMs + intervalMs, lastPublishMs, intervalMs),
        ).toBe(elapsedExact >= intervalMs);

        const halfElapsed = Math.floor(intervalMs / 2);
        expect(
          shouldPublishUiAt(lastPublishMs + halfElapsed, lastPublishMs, intervalMs),
        ).toBe(halfElapsed >= intervalMs);
      }),
    );
  });

  it('matches the open interval rule for the default UI gap', () => {
    fc.assert(
      fc.property(finiteMs, (lastPublishMs) => {
        const elapsed = UI_PUBLISH_INTERVAL_MS;
        expect(
          shouldPublishUiAt(lastPublishMs + elapsed, lastPublishMs),
        ).toBe(elapsed >= UI_PUBLISH_INTERVAL_MS);
        const early = UI_PUBLISH_INTERVAL_MS - 1;
        expect(shouldPublishUiAt(lastPublishMs + early, lastPublishMs)).toBe(
          early >= UI_PUBLISH_INTERVAL_MS,
        );
      }),
    );
  });
});

describe('scrubPhaseBucket', () => {
  it('maps any finite phase into [0, buckets)', () => {
    fc.assert(
      fc.property(unitPhase, (phase) => {
        const bucket = scrubPhaseBucket(phase, SCRUB_HISTORY_BUCKETS);
        expect(bucket).toBeGreaterThanOrEqual(0);
        expect(bucket).toBeLessThan(SCRUB_HISTORY_BUCKETS);
      }),
    );
  });

  it('keeps the same bucket for phase values that wrap to the same fraction', () => {
    fc.assert(
      fc.property(unitPhase, fc.integer({ min: -5, max: 5 }), (phase, loops) => {
        const a = scrubPhaseBucket(phase);
        const b = scrubPhaseBucket(phase + loops);
        expect(a).toBe(b);
      }),
    );
  });
});

describe('shouldAppendMonitorHistory', () => {
  const queueKey = fc.integer({ min: 0, max: 10_000 }).map(
    (cursor): MonitorHistoryKey => ({ mode: 'queue', cursor }),
  );
  const scrubKey = fc
    .integer({ min: 0, max: SCRUB_HISTORY_BUCKETS - 1 })
    .map((phaseBucket): MonitorHistoryKey => ({ mode: 'scrub', phaseBucket }));

  it('appends when there is no previous key', () => {
    fc.assert(
      fc.property(fc.oneof(queueKey, scrubKey), (next) => {
        const appended = shouldAppendMonitorHistory(undefined, next);
        const hasPrevious = false;
        expect(appended).toBe(!hasPrevious);
      }),
    );
  });

  it('skips duplicate queue cursors and scrub buckets', () => {
    fc.assert(
      fc.property(fc.oneof(queueKey, scrubKey), (key) => {
        const duplicate = { ...key };
        const sameQueue =
          key.mode === 'queue' &&
          duplicate.mode === 'queue' &&
          key.cursor === duplicate.cursor;
        const sameScrub =
          key.mode === 'scrub' &&
          duplicate.mode === 'scrub' &&
          key.phaseBucket === duplicate.phaseBucket;
        expect(shouldAppendMonitorHistory(key, duplicate)).toBe(!(sameQueue || sameScrub));
      }),
    );
  });

  it('appends when the queue cursor or scrub bucket changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (cursor, delta) => {
          const prev: MonitorHistoryKey = { mode: 'queue', cursor };
          const next: MonitorHistoryKey = {
            mode: 'queue',
            cursor: cursor + delta,
          };
          const appended = shouldAppendMonitorHistory(prev, next);
          expect(appended).toBe(prev.cursor !== next.cursor);
        },
      ),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: SCRUB_HISTORY_BUCKETS - 1 }),
        fc.integer({ min: 1, max: SCRUB_HISTORY_BUCKETS - 1 }),
        (bucket, delta) => {
          const prev: MonitorHistoryKey = { mode: 'scrub', phaseBucket: bucket };
          const next: MonitorHistoryKey = {
            mode: 'scrub',
            phaseBucket: (bucket + delta) % SCRUB_HISTORY_BUCKETS,
          };
          const appended = shouldAppendMonitorHistory(prev, next);
          expect(appended).toBe(prev.phaseBucket !== next.phaseBucket);
        },
      ),
    );
  });

  it('builds queue and scrub keys from clocks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (cursor) => {
        expect(monitorHistoryKeyFromClock({ mode: 'queue', cursor })).toEqual({
          mode: 'queue' as const,
          cursor,
        });
      }),
    );
    fc.assert(
      fc.property(unitPhase, (phase) => {
        expect(monitorHistoryKeyFromClock({ mode: 'scrub', phase })).toEqual({
          mode: 'scrub' as const,
          phaseBucket: scrubPhaseBucket(phase),
        });
      }),
    );
  });
});

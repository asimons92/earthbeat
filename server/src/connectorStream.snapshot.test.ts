import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import { EarthquakeStream } from './earthquakeStream.js';
import { TideStream } from './tideStream.js';
import { WaveStream } from './waveStream.js';

const streams: Array<{ stop: () => void }> = [];

afterEach(() => {
  while (streams.length > 0) {
    streams.pop()?.stop();
  }
});

describe('EarthquakeStream snapshots', () => {
  it('emits a queue snapshot on start without a sample tick timer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            mag: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: null }),
            time: fc.integer({ min: 1, max: 2_000_000_000_000 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (rows) => {
          const ids = new Set(rows.map((row) => row.id));
          fc.pre(ids.size === rows.length);
          const stream = new EarthquakeStream({
            pollIntervalMs: 60_000,
            fetchFeed: async () => ({
              features: rows.map((row) => ({
                id: row.id,
                properties: {
                  mag: row.mag,
                  place: 'test',
                  time: row.time,
                  sig: null,
                },
                geometry: { coordinates: [0, 0, 10] },
              })),
            }),
          });
          streams.push(stream);
          const snapshots: unknown[] = [];
          stream.on('queue', (snapshot) => {
            snapshots.push(snapshot);
          });
          await stream.start();
          expect(stream.isPolling()).toBe(true);
          expect(snapshots.length).toBeGreaterThan(0);
          const latest = snapshots[snapshots.length - 1] as {
            kindKey: string;
            items: Array<{ id: string }>;
          };
          expect(latest.kindKey).toBe('usgs_earthquakes');
          expect(latest.items.length).toBe(rows.length);
          const snapshot = stream.getQueueSnapshot();
          expect(snapshot.items.length).toBe(rows.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});

describe('TideStream snapshots', () => {
  it('emits a series snapshot on start with point times and levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            waterLevel: fc.double({ min: -2, max: 4, noNaN: true }),
            time: fc.integer({ min: 1, max: 2_000_000_000_000 }),
          }),
          { minLength: 2, maxLength: 12 },
        ),
        async (points) => {
          const stream = new TideStream({
            pollIntervalMs: 60_000,
            station: '9414290',
            fetchLevels: async () =>
              points.map((point, index) => ({
                id: `t-${index}`,
                stationId: '9414290',
                waterLevel: point.waterLevel,
                time: point.time,
              })),
          });
          streams.push(stream);
          const snapshots: unknown[] = [];
          stream.on('series', (snapshot) => {
            snapshots.push(snapshot);
          });
          await stream.start();
          expect(stream.isPolling()).toBe(true);
          const latest = snapshots[snapshots.length - 1] as {
            kindKey: string;
            points: typeof points;
          };
          expect(latest.kindKey).toBe('noaa_coops_tides');
          expect(latest.points.length).toBe(points.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});

describe('WaveStream snapshots', () => {
  it('emits a series snapshot on start with height and period points', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            waveHeight: fc.double({ min: 0, max: 10, noNaN: true }),
            wavePeriod: fc.double({ min: 1, max: 20, noNaN: true }),
            time: fc.integer({ min: 1, max: 2_000_000_000_000 }),
          }),
          { minLength: 2, maxLength: 12 },
        ),
        async (points) => {
          const stream = new WaveStream({
            pollIntervalMs: 60_000,
            station: '46026',
            fetchMet: async () =>
              points.map((point, index) => ({
                id: `w-${index}`,
                stationId: '46026',
                waveHeight: point.waveHeight,
                wavePeriod: point.wavePeriod,
                time: point.time,
              })),
          });
          streams.push(stream);
          const snapshots: unknown[] = [];
          stream.on('series', (snapshot) => {
            snapshots.push(snapshot);
          });
          await stream.start();
          expect(stream.isPolling()).toBe(true);
          const latest = snapshots[snapshots.length - 1] as {
            kindKey: string;
            points: typeof points;
          };
          expect(latest.kindKey).toBe('ndbc_buoy_waves');
          expect(latest.points.length).toBe(points.length);
        },
      ),
      { numRuns: 10 },
    );
  });
});

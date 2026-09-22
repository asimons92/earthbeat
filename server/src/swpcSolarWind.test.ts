import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapSwpcSolarWind } from './swpcSolarWind.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const sourceArb = fc.stringMatching(/^[A-Z][A-Z0-9]{1,7}$/);
const minuteMsArb = fc
  .integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) })
  .map((ms) => ms - (ms % MINUTE_MS));

const finiteArb = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

const maybeFiniteArb = (min: number, max: number) =>
  fc.oneof(
    finiteArb(min, max),
    fc.constant(null),
    fc.constant(Number.NaN),
    fc.constant(Number.POSITIVE_INFINITY),
  );

type WindRow = {
  time_tag: string;
  active: boolean;
  source: string;
  proton_speed: number | null;
  proton_density: number | null;
};

type MagRow = {
  time_tag: string;
  active: boolean;
  source: string;
  bz_gsm: number | null;
};

type Candidate = {
  ms: number;
  windSource: string;
  magSource: string;
  activeWind: boolean;
  activeMag: boolean;
  speed: number | null;
  density: number | null;
  bz: number | null;
};

function tagFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

function isKeptNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function oracle(candidates: readonly Candidate[], rangeHours: number) {
  const byKey = new Map<string, Candidate>();
  for (const row of candidates) {
    if (!row.activeWind || !row.activeMag) continue;
    if (row.windSource !== row.magSource) continue;
    if (!isKeptNumber(row.speed) || !isKeptNumber(row.density) || !isKeptNumber(row.bz)) {
      continue;
    }
    byKey.set(`${row.ms}|${row.windSource}`, row);
  }
  const sorted = [...byKey.values()].sort((a, b) => a.ms - b.ms || a.windSource.localeCompare(b.windSource));
  if (sorted.length === 0 || !(rangeHours > 0)) return sorted;
  const newest = sorted[sorted.length - 1]!.ms;
  const cutoff = newest - rangeHours * HOUR_MS;
  return sorted.filter((row) => row.ms >= cutoff);
}

function toFeeds(candidates: readonly Candidate[]): { wind: WindRow[]; mag: MagRow[] } {
  const wind: WindRow[] = [];
  const mag: MagRow[] = [];
  for (const row of candidates) {
    wind.push({
      time_tag: tagFromMs(row.ms),
      active: row.activeWind,
      source: row.windSource,
      proton_speed: row.speed,
      proton_density: row.density,
    });
    mag.push({
      time_tag: tagFromMs(row.ms),
      active: row.activeMag,
      source: row.magSource,
      bz_gsm: row.bz,
    });
  }
  return { wind, mag };
}

const candidateArb: fc.Arbitrary<Candidate> = fc.record({
  ms: minuteMsArb,
  windSource: sourceArb,
  magSource: sourceArb,
  activeWind: fc.boolean(),
  activeMag: fc.boolean(),
  speed: maybeFiniteArb(200, 1200),
  density: fc.oneof(finiteArb(0, 40), fc.constant(null), fc.constant(Number.NaN)),
  bz: maybeFiniteArb(-50, 50),
});

describe('mapSwpcSolarWind', () => {
  it('joins active rows on time and source, sorts them, and keeps the newest window', () => {
    fc.assert(
      fc.property(
        fc.array(candidateArb, { minLength: 0, maxLength: 24 }),
        fc.integer({ min: 1, max: 48 }),
        (candidates, rangeHours) => {
          const { wind, mag } = toFeeds(candidates);
          const mapped = mapSwpcSolarWind(wind, mag, rangeHours);
          const expected = oracle(candidates, rangeHours);
          expect(mapped.length).toBe(expected.length);
          for (let i = 1; i < mapped.length; i += 1) {
            expect(mapped[i]!.time).toBeGreaterThanOrEqual(mapped[i - 1]!.time);
          }
          mapped.forEach((row, index) => {
            const want = expected[index]!;
            expect(row.time).toBe(want.ms);
            expect(row.source).toBe(want.windSource);
            expect(row.speed).toBe(want.speed);
            expect(row.density).toBe(want.density);
            expect(row.bz).toBe(want.bz);
            expect(row.id).toBe(`${row.source}-${row.time}`);
          });
          if (mapped.length > 0) {
            const newest = mapped[mapped.length - 1]!.time;
            const cutoff = newest - rangeHours * HOUR_MS;
            for (const row of mapped) {
              expect(row.time).toBeGreaterThanOrEqual(cutoff);
            }
          }
        },
      ),
    );
  });

  it('reads a timestamp with no offset as UTC', () => {
    fc.assert(
      fc.property(
        minuteMsArb,
        sourceArb,
        finiteArb(200, 1200),
        finiteArb(0, 40),
        finiteArb(-50, 50),
        (ms, source, speed, density, bz) => {
          const tag = tagFromMs(ms);
          const mapped = mapSwpcSolarWind(
            [
              {
                time_tag: tag,
                active: true,
                source,
                proton_speed: speed,
                proton_density: density,
              },
            ],
            [{ time_tag: tag, active: true, source, bz_gsm: bz }],
            48,
          );
          const parsed = Date.parse(`${tag}Z`);
          expect(mapped[0]?.time).toBe(parsed);
          expect(mapped[0]?.time).toBe(ms);
        },
      ),
    );
  });

  it('keeps a density of zero and drops null or non-finite channels', () => {
    fc.assert(
      fc.property(minuteMsArb, sourceArb, finiteArb(200, 1200), finiteArb(-50, 50), (
        ms,
        source,
        speed,
        bz,
      ) => {
        const tag = tagFromMs(ms);
        const density = 0;
        const kept = mapSwpcSolarWind(
          [
            {
              time_tag: tag,
              active: true,
              source,
              proton_speed: speed,
              proton_density: density,
            },
          ],
          [{ time_tag: tag, active: true, source, bz_gsm: bz }],
          48,
        );
        const dropped = mapSwpcSolarWind(
          [
            {
              time_tag: tag,
              active: true,
              source,
              proton_speed: null,
              proton_density: density,
            },
          ],
          [{ time_tag: tag, active: true, source, bz_gsm: Number.NaN }],
          48,
        );
        const empty = mapSwpcSolarWind([], []);
        expect(kept.length).toBe(empty.length + 1);
        expect(kept[0]?.density).toBe(density);
        expect(dropped.length).toBe(empty.length);
      }),
    );
  });

  it('drops inactive rows and rows whose source or time does not match', () => {
    fc.assert(
      fc.property(
        minuteMsArb,
        sourceArb,
        sourceArb,
        finiteArb(200, 1200),
        finiteArb(0, 40),
        finiteArb(-50, 50),
        (ms, windSource, magSource, speed, density, bz) => {
          fc.pre(windSource !== magSource);
          const tag = tagFromMs(ms);
          const otherTag = tagFromMs(ms + MINUTE_MS);
          const mismatched = mapSwpcSolarWind(
            [
              {
                time_tag: tag,
                active: false,
                source: windSource,
                proton_speed: speed,
                proton_density: density,
              },
              {
                time_tag: tag,
                active: true,
                source: windSource,
                proton_speed: speed,
                proton_density: density,
              },
            ],
            [
              { time_tag: tag, active: true, source: magSource, bz_gsm: bz },
              { time_tag: otherTag, active: true, source: windSource, bz_gsm: bz },
            ],
            48,
          );
          const empty = mapSwpcSolarWind([], []);
          expect(mismatched.length).toBe(empty.length);
        },
      ),
    );
  });

  it('collapses duplicate active rows for one time and source to one stable row', () => {
    fc.assert(
      fc.property(
        minuteMsArb,
        sourceArb,
        finiteArb(200, 1200),
        finiteArb(200, 1200),
        finiteArb(0, 40),
        finiteArb(-50, 50),
        (ms, source, speedA, speedB, density, bz) => {
          const tag = tagFromMs(ms);
          const wind = [
            {
              time_tag: tag,
              active: true,
              source,
              proton_speed: speedA,
              proton_density: density,
            },
            {
              time_tag: tag,
              active: true,
              source,
              proton_speed: speedB,
              proton_density: density,
            },
          ];
          const mag = [
            { time_tag: tag, active: true, source, bz_gsm: bz },
            { time_tag: tag, active: true, source, bz_gsm: bz },
          ];
          const once = mapSwpcSolarWind(wind, mag, 48);
          const twice = mapSwpcSolarWind(wind, mag, 48);
          const empty = mapSwpcSolarWind([], []);
          expect(once.length).toBe(empty.length + 1);
          expect(twice).toEqual(once);
          expect([speedA, speedB]).toContain(once[0]?.speed);
          expect(once[0]?.time).toBe(ms);
        },
      ),
    );
  });

  it('returns an empty list for empty feeds', () => {
    const fromEmpty = mapSwpcSolarWind([], []);
    const fromEmptyAgain = mapSwpcSolarWind([], []);
    expect(fromEmpty.length).toBe(fromEmptyAgain.length);
    expect(fromEmpty).toEqual(fromEmptyAgain);
  });
});

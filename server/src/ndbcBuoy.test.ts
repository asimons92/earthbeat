import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapNdbcMetText } from './ndbcBuoy.js';

const pad2 = (n: number) => String(n).padStart(2, '0');

function formatNdbcTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()} ${pad2(d.getUTCMonth() + 1)} ${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())} ${pad2(d.getUTCMinutes())}`;
}

const cellArb = fc.oneof(
  fc.double({ min: 0.1, max: 12, noNaN: true, noDefaultInfinity: true }).map(String),
  fc.constant('MM'),
  fc.constant('not-a-number'),
);

describe('mapNdbcMetText', () => {
  it('keeps only finite WVHT and DPD rows, sorts by time, and stamps stationId', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ms: fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }),
            wvht: cellArb,
            dpd: cellArb,
          }),
          { minLength: 1, maxLength: 24 },
        ),
        fc.stringMatching(/^[0-9]{5}$/),
        (rows, stationId) => {
          const body = [
            '#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD',
            '#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT',
            ...rows.map(
              (row) =>
                `${formatNdbcTime(row.ms)} 310  7.0  8.0   ${row.wvht}   ${row.dpd}   7.0 290`,
            ),
          ].join('\n');
          const mapped = mapNdbcMetText(body, stationId, 10_000);
          for (let i = 1; i < mapped.length; i += 1) {
            expect(mapped[i]!.time).toBeGreaterThanOrEqual(mapped[i - 1]!.time);
          }
          for (const row of mapped) {
            expect(Number.isFinite(row.waveHeight)).toBe(true);
            expect(Number.isFinite(row.wavePeriod)).toBe(true);
            expect(row.stationId).toBe(stationId);
          }
          const validCount = rows.filter((row) => {
            const h = Number.parseFloat(row.wvht);
            const p = Number.parseFloat(row.dpd);
            return Number.isFinite(h) && Number.isFinite(p);
          }).length;
          expect(mapped.length).toBeLessThanOrEqual(validCount);
        },
      ),
    );
  });

  it('drops header-only text', () => {
    const empty = mapNdbcMetText('#header\n#units\n', '46026');
    const noneFound = mapNdbcMetText('', '46026');
    expect(empty.length).toBe(noneFound.length);
  });
});

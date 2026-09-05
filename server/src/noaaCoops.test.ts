import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { mapWaterLevelResponse, type NoaaWaterLevelResponse } from './noaaCoops.js';

describe('mapWaterLevelResponse', () => {
  it('keeps only finite levels and sorts by time', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            t: fc
              .integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 })
              .map((ms) => {
                const d = new Date(ms);
                const pad = (n: number) => String(n).padStart(2, '0');
                return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
              }),
            v: fc.oneof(
              fc.double({ min: -2, max: 4, noNaN: true }).map(String),
              fc.constant('not-a-number'),
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.stringMatching(/^[0-9]{7}$/),
        (rows, stationId) => {
          const body: NoaaWaterLevelResponse = {
            metadata: { id: stationId },
            data: rows,
          };
          const mapped = mapWaterLevelResponse(body, stationId);
          for (let i = 1; i < mapped.length; i += 1) {
            expect(mapped[i]!.time).toBeGreaterThanOrEqual(mapped[i - 1]!.time);
          }
          for (const row of mapped) {
            const finite = Number.isFinite(row.waterLevel);
            expect(finite).toBe(row.waterLevel === row.waterLevel);
            expect(row.stationId).toBe(stationId);
          }
        },
      ),
    );
  });
});

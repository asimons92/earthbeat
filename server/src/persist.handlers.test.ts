import { afterAll, describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { closeDb } from './migrate.js';
import { pool } from './db.js';
import {
  VersionConflictError,
  patchCreate,
  patchGet,
  patchReplaceGraph,
  userUpsertFromAuth,
} from './generated/handlers.js';
import { ensureSchema } from './migrate.js';

const hasDb = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!hasDb)('patch persist handlers', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('boots schema', async () => {
    await ensureSchema();
    const client = await pool.connect();
    client.release();
    expect(Boolean(client)).toBe(Boolean(pool));
  });

  it('replaceGraph bumps version and rejects stale expectedVersion', async () => {
    await ensureSchema();
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.double({ min: 40, max: 800, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        async (suffix, frequencyHz, gain) => {
          const user = await userUpsertFromAuth({
            email: `persist-${suffix}@earthbeat.test`,
            name: suffix,
            provider: 'test',
            providerSubject: `subject-${suffix}`,
          });
          const patch = await patchCreate(user.id, { name: `Patch ${suffix}` });
          const oscillatorId = `osc-${suffix}`;
          const oscillators = [
            {
              id: oscillatorId,
              patchId: patch.id,
              positionX: 1,
              positionY: 2,
              waveform: 'sine',
              frequencyHz,
              gain,
            },
          ];
          const first = await patchReplaceGraph(user.id, {
            id: patch.id,
            expectedVersion: Number(patch.version),
            connectors: [],
            modulators: [],
            oscillators,
            effects: [],
            wires: [],
          });
          const expectedVersion = Number(patch.version) + 1;
          expect(Number(first.version)).toBe(expectedVersion);

          const staleAttempt = patchReplaceGraph(user.id, {
            id: patch.id,
            expectedVersion: Number(patch.version),
            connectors: [],
            modulators: [],
            oscillators: [],
            effects: [],
            wires: [],
          });
          await expect(staleAttempt).rejects.toBeInstanceOf(VersionConflictError);

          const loaded = await patchGet(user.id, { id: patch.id });
          expect(loaded.oscillators.length).toBe(oscillators.length);
          expect(loaded.oscillators[0]?.id).toBe(oscillatorId);
        },
      ),
      { numRuns: 5 },
    );
  });
});

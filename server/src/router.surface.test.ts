import { describe, expect, it } from 'vitest';

import { appRouter } from './generated/router.js';

describe('appRouter public surface', () => {
  it('does not expose user.upsertFromAuth', () => {
    const procedurePaths = Object.keys(appRouter._def.procedures);
    const upsertPaths = procedurePaths.filter((path) => path.includes('upsertFromAuth'));
    expect(upsertPaths).toEqual([]);
  });

  it('still exposes authenticated user.me', () => {
    const procedurePaths = Object.keys(appRouter._def.procedures);
    expect(procedurePaths.includes('user.me')).toBe(true);
  });
});

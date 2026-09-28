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

  it('exposes getByShareToken without the auth middleware', () => {
    const procedurePaths = Object.keys(appRouter._def.procedures);
    const publicRead = 'patch.getByShareToken';
    const ownedRead = 'patch.get';
    expect(procedurePaths.includes(publicRead)).toBe(procedurePaths.includes(ownedRead));
    const middlewareCount = (path: string) => {
      const procedure = appRouter._def.procedures[path] as {
        _def: { middlewares: unknown[] };
      };
      return procedure._def.middlewares.length;
    };
    const authedCount = middlewareCount('patch.publishShare');
    expect(middlewareCount(publicRead)).toBeLessThan(middlewareCount(ownedRead));
    expect(middlewareCount(ownedRead)).toBe(authedCount);
    expect(middlewareCount('patch.revokeShare')).toBe(authedCount);
    expect(middlewareCount('patch.copyFromShare')).toBe(authedCount);
  });
});

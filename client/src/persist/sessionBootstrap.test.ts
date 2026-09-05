import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { decideSessionBootstrap } from './sessionBootstrap';

const idArb = fc.uuid();
const modeArb = fc.constantFrom('local', 'google', 'other');

describe('decideSessionBootstrap', () => {
  it('is ready when a user id is already present', () => {
    fc.assert(
      fc.property(idArb, modeArb, (id, authMode) => {
        const decision = decideSessionBootstrap({ user: { id }, authMode });
        const ready = 'ready' as const;
        expect(decision).toBe(ready);
      }),
    );
  });

  it('requests a local post only when authMode is local and there is no user', () => {
    fc.assert(
      fc.property(modeArb, (authMode) => {
        const decision = decideSessionBootstrap({ user: null, authMode });
        const expected =
          authMode === 'local'
            ? ('needsLocalPost' as const)
            : ('unauthenticated' as const);
        expect(decision).toBe(expected);
      }),
    );
  });
});

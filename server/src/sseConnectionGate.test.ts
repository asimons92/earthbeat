import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { createSseConnectionGate } from './sseConnectionGate.js';

describe('createSseConnectionGate', () => {
  it('accepts connections up to the cap and rejects one over', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 32 }), (max) => {
        const gate = createSseConnectionGate(max);
        const acquired: boolean[] = [];
        for (let i = 0; i < max; i++) {
          acquired.push(gate.tryAcquire());
        }
        expect(acquired.every(Boolean)).toBe(true);
        expect(gate.activeCount()).toBe(max);
        expect(gate.tryAcquire()).toBe(false);
        expect(gate.activeCount()).toBe(max);
      }),
    );
  });

  it('frees a slot on release so another acquire can succeed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 24 }), fc.integer({ min: 1, max: 24 }), (max, releases) => {
        const gate = createSseConnectionGate(max);
        for (let i = 0; i < max; i++) {
          expect(gate.tryAcquire()).toBe(true);
        }
        const toRelease = Math.min(releases, max);
        for (let i = 0; i < toRelease; i++) {
          gate.release();
        }
        expect(gate.activeCount()).toBe(max - toRelease);
        for (let i = 0; i < toRelease; i++) {
          expect(gate.tryAcquire()).toBe(true);
        }
        expect(gate.activeCount()).toBe(max);
        expect(gate.tryAcquire()).toBe(false);
      }),
    );
  });

  it('never reports activeCount outside [0, max]', () => {
    const opArb = fc.oneof(fc.constant('acquire' as const), fc.constant('release' as const));
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 16 }), fc.array(opArb, { maxLength: 80 }), (max, ops) => {
        const gate = createSseConnectionGate(max);
        for (const op of ops) {
          if (op === 'acquire') gate.tryAcquire();
          else gate.release();
          const count = gate.activeCount();
          expect(count >= 0).toBe(true);
          expect(count <= max).toBe(true);
        }
      }),
    );
  });
});

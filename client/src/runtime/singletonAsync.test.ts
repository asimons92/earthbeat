import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createSingletonAsync, SINGLETON_ASYNC_CLEARED } from './singletonAsync';

describe('createSingletonAsync', () => {
  it('concurrent get calls share one factory result and never orphan a second create', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 12 }), async (callerCount) => {
        let factoryCalls = 0;
        const created: number[] = [];
        const singleton = createSingletonAsync(async () => {
          factoryCalls += 1;
          const token = factoryCalls;
          created.push(token);
          await Promise.resolve();
          return token;
        });

        const results = await Promise.all(
          Array.from({ length: callerCount }, () => singleton.get()),
        );

        const uniqueResults = new Set(results);
        expect(factoryCalls).toBe(created.length);
        expect(uniqueResults.size).toBe(created.length);
        expect(results.every((value) => value === singleton.peek())).toBe(
          results.length === callerCount,
        );
        expect(created).toHaveLength(factoryCalls);
      }),
    );
  });

  it('clear drops the instance and disposes a create that finishes after clear so it cannot re-bind', async () => {
    await fc.assert(
      fc.asyncProperty(fc.nat({ max: 5 }), async (extraGets) => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let factoryCalls = 0;
        const created: number[] = [];
        const abandoned: number[] = [];
        const singleton = createSingletonAsync(
          async () => {
            factoryCalls += 1;
            created.push(factoryCalls);
            await gate;
            return factoryCalls;
          },
          (value) => {
            abandoned.push(value);
          },
        );

        const first = singleton.get();
        singleton.clear();
        release();

        await expect(first).rejects.toThrow(SINGLETON_ASYNC_CLEARED);
        expect(singleton.peek()).toBeNull();
        expect(abandoned).toEqual(created.slice(0, abandoned.length));

        const nextValues = await Promise.all(
          Array.from({ length: extraGets + 1 }, () => singleton.get()),
        );
        const uniqueNext = [...new Set(nextValues)];
        expect(uniqueNext).toHaveLength(abandoned.length);
        expect(singleton.peek()).toBe(uniqueNext[0]);
        expect(factoryCalls).toBe(created.length);
        expect(abandoned).toHaveLength(created.length - uniqueNext.length);
      }),
    );
  });
});

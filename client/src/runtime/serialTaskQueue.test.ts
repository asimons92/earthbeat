import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { enqueueSerialTask } from './serialTaskQueue';

describe('enqueueSerialTask', () => {
  it('runs later tasks after an earlier task rejects', async () => {
    await fc.assert(
      fc.asyncProperty(fc.nat({ max: 8 }), async (followUpCount) => {
        const ran: number[] = [];
        let queue: Promise<void> = Promise.resolve();

        queue = enqueueSerialTask(queue, async () => {
          ran.push(-1);
          throw new Error('rebuild failed');
        });

        for (let i = 0; i < followUpCount; i++) {
          const step = i;
          queue = enqueueSerialTask(queue, async () => {
            ran.push(step);
          });
        }

        await queue.catch(() => undefined);

        const expected = [-1, ...Array.from({ length: followUpCount }, (_, i) => i)];
        expect(ran).toEqual(expected);
      }),
    );
  });

  it('keeps tasks in submission order when every task resolves', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 12 }), async (ids) => {
        const ran: number[] = [];
        let queue: Promise<void> = Promise.resolve();
        for (const id of ids) {
          const step = id;
          queue = enqueueSerialTask(queue, async () => {
            ran.push(step);
          });
        }
        await queue;
        expect(ran).toEqual(ids);
      }),
    );
  });
});

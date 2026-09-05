import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  decideSaveSuccessAction,
  flowGraphFingerprint,
  shouldBlockCanvasMutation,
  shouldSuppressDraftForFingerprint,
} from './patchPersistRaces';

const idArb = fc.uuid();
const epochArb = fc.nat({ max: 10_000 });

describe('decideSaveSuccessAction', () => {
  it('ignores Save success when the active Patch is no longer the saved one', () => {
    fc.assert(
      fc.property(idArb, idArb, epochArb, epochArb, (savedId, activeId, startEpoch, nowEpoch) => {
        fc.pre(savedId !== activeId);
        const action = decideSaveSuccessAction({
          savedPatchId: savedId,
          activePatchId: activeId,
          graphEpochAtSaveStart: startEpoch,
          graphEpochNow: nowEpoch,
        });
        const expected = 'ignore' as const;
        expect(action).toBe(expected);
      }),
    );
  });

  it('keeps dirty when the graph epoch advanced during Save', () => {
    fc.assert(
      fc.property(idArb, epochArb, epochArb, (patchId, startEpoch, delta) => {
        fc.pre(delta > 0);
        const action = decideSaveSuccessAction({
          savedPatchId: patchId,
          activePatchId: patchId,
          graphEpochAtSaveStart: startEpoch,
          graphEpochNow: startEpoch + delta,
        });
        const expected = 'keepDirty' as const;
        expect(action).toBe(expected);
      }),
    );
  });

  it('marks clean only when still on the same Patch and epoch', () => {
    fc.assert(
      fc.property(idArb, epochArb, (patchId, epoch) => {
        const action = decideSaveSuccessAction({
          savedPatchId: patchId,
          activePatchId: patchId,
          graphEpochAtSaveStart: epoch,
          graphEpochNow: epoch,
        });
        const expected = 'clean' as const;
        expect(action).toBe(expected);
      }),
    );
  });
});

describe('shouldBlockCanvasMutation', () => {
  it('blocks only while Save is in flight', () => {
    fc.assert(
      fc.property(fc.boolean(), (inFlight) => {
        expect(shouldBlockCanvasMutation(inFlight)).toBe(inFlight);
      }),
    );
  });
});

describe('shouldSuppressDraftForFingerprint', () => {
  it('suppresses only while the live graph still matches the programmatic mark', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (mark, live) => {
        const suppressed = shouldSuppressDraftForFingerprint(mark, live);
        expect(suppressed).toBe(mark === live);
        const noMark = null;
        expect(shouldSuppressDraftForFingerprint(noMark, live)).toBe(
          noMark !== null && noMark === live,
        );
      }),
    );
  });
});

describe('flowGraphFingerprint', () => {
  it('changes when node data or wiring changes', () => {
    fc.assert(
      fc.property(idArb, idArb, fc.string(), fc.string(), (nodeId, edgeId, dataA, dataB) => {
        fc.pre(dataA !== dataB);
        const nodesA = [{ id: nodeId, type: 'oscillator', data: { label: dataA }, position: { x: 0, y: 0 } }];
        const nodesB = [{ id: nodeId, type: 'oscillator', data: { label: dataB }, position: { x: 0, y: 0 } }];
        const edges = [{ id: edgeId, source: nodeId, target: nodeId }];
        expect(flowGraphFingerprint(nodesA, edges)).not.toBe(flowGraphFingerprint(nodesB, edges));
      }),
    );
  });
});

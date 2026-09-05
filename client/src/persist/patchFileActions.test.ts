import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  blankPatchPersistSnapshot,
  decideDeleteAftermath,
  decideDirtyNavigation,
  decideSaveRoute,
  transportEventForBlankOrDeleteOpen,
  shouldShowPatchFileActions,
  type DirtyNavAction,
  type SaveIntent,
} from './patchFileActions';
import { transportEventForPatchLoad } from '@/runtime/voiceStop';

const dirtyNavActionArb = fc.constantFrom<DirtyNavAction>('new', 'load');
const saveIntentArb = fc.constantFrom<SaveIntent>('save', 'saveAs');
const idArb = fc.uuid();
const optionalIdArb = fc.option(idArb, { nil: null });
const canvasPath = '/' as const;

describe('decideDirtyNavigation', () => {
  it('prompts only when the graph is dirty', () => {
    fc.assert(
      fc.property(fc.boolean(), dirtyNavActionArb, (dirty, action) => {
        const decision = decideDirtyNavigation(dirty, action);
        const expected = dirty ? ('prompt' as const) : ('proceed' as const);
        expect(decision).toBe(expected);
      }),
    );
  });
});

describe('blankPatchPersistSnapshot', () => {
  it('is always an unsaved empty idle Patch with the blank name', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), () => {
        const snap = blankPatchPersistSnapshot();
        const expected = blankPatchPersistSnapshot();
        expect(snap).toEqual(expected);
        expect(snap.activePatchId).toBeNull();
        expect(snap.nodeCount + snap.edgeCount).toEqual(
          expected.nodeCount + expected.edgeCount,
        );
      }),
    );
  });
});

describe('decideSaveRoute', () => {
  it('routes Save As and first Save through name-then-create; Save with id through saveNow', () => {
    fc.assert(
      fc.property(saveIntentArb, optionalIdArb, (intent, activePatchId) => {
        const route = decideSaveRoute(intent, activePatchId);
        const expected =
          intent === 'saveAs' || activePatchId === null
            ? ('nameThenCreate' as const)
            : ('saveNow' as const);
        expect(route).toBe(expected);
      }),
    );
  });
});

describe('decideDeleteAftermath', () => {
  it('blanks only when the deleted Patch is the open one', () => {
    fc.assert(
      fc.property(idArb, optionalIdArb, (deletedId, activePatchId) => {
        const aftermath = decideDeleteAftermath(deletedId, activePatchId);
        const expected =
          activePatchId !== null && deletedId === activePatchId
            ? ('blank' as const)
            : ('leave' as const);
        expect(aftermath).toBe(expected);
      }),
    );
  });
});

describe('transportEventForBlankOrDeleteOpen', () => {
  it('matches the Patch-load stop-all event for every call', () => {
    fc.assert(
      fc.property(fc.nat({ max: 30 }), () => {
        expect(transportEventForBlankOrDeleteOpen()).toEqual(transportEventForPatchLoad());
      }),
    );
  });
});

describe('shouldShowPatchFileActions', () => {
  it('is true only on the Canvas path', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/', '/patches', '/connectors', '/effects', '/other'),
        (pathname) => {
          const visible = shouldShowPatchFileActions(pathname);
          expect(visible).toBe(pathname === canvasPath);
        },
      ),
    );
  });
});

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';
import {
  ANONYMOUS_DRAFT_USER_KEY,
  canvasDraftStorageKey,
  canvasDraftUserKey,
  clearCanvasDraft,
  decideCanvasBoot,
  decideDraftAfterLibraryOpen,
  decideDraftAfterNew,
  decideDraftStorageAfterSignOut,
  decideGraphWriteSink,
  decideLiveCanvasAfterSignOut,
  decideMultiTabDraftPolicy,
  decideWorkingGraphSource,
  emptyCanvasDraftPayload,
  emptyWorkingGraph,
  initialCanvasPersistState,
  parseCanvasDraftPayload,
  readCanvasDraft,
  reduceCanvasPersist,
  serializeCanvasDraftPayload,
  shouldWriteGraphToDatabase,
  writeCanvasDraft,
  type CanvasDraftEdge,
  type CanvasDraftNode,
  type CanvasDraftPayload,
  type CanvasPersistEvent,
  type CanvasPersistState,
  type GraphWriteReason,
  type LibraryPatchGraph,
  type WorkingGraphSourceEvent,
} from './canvasDraft';

const idArb = fc.uuid();
const optionalIdArb = fc.option(idArb, { nil: null });
const nameArb = fc.string({ minLength: 1, maxLength: 40 });
const versionArb = fc.integer({ min: 1, max: 10_000 });
const writeReasonArb = fc.constantFrom<GraphWriteReason>('edit', 'save', 'saveAs', 'autosave');
const sourceEventArb = fc.constantFrom<WorkingGraphSourceEvent>(
  'libraryOpen',
  'refresh',
  'coldStart',
  'new',
  'signOut',
);

const nodeArb: fc.Arbitrary<CanvasDraftNode> = fc.record({
  id: idArb,
  type: fc.constantFrom('connector', 'modulator', 'oscillator', 'effect'),
  position: fc.record({
    x: fc.integer({ min: -2000, max: 2000 }),
    y: fc.integer({ min: -2000, max: 2000 }),
  }),
  data: fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.string({ maxLength: 12 }), {
    maxKeys: 3,
  }),
});

const edgeArb: fc.Arbitrary<CanvasDraftEdge> = fc.record({
  id: idArb,
  source: idArb,
  target: idArb,
  sourceHandle: fc.constant('out'),
  targetHandle: fc.constant('in'),
});

const graphPartsArb = fc.record({
  nodes: fc.uniqueArray(nodeArb, { minLength: 0, maxLength: 5, selector: (n) => n.id }),
  edges: fc.uniqueArray(edgeArb, { minLength: 0, maxLength: 5, selector: (e) => e.id }),
});

const draftPayloadArb: fc.Arbitrary<CanvasDraftPayload> = fc.record({
  activePatchId: optionalIdArb,
  activePatchName: nameArb,
  patchVersion: versionArb,
  isDirty: fc.boolean(),
  nodes: fc.uniqueArray(nodeArb, { minLength: 0, maxLength: 5, selector: (n) => n.id }),
  edges: fc.uniqueArray(edgeArb, { minLength: 0, maxLength: 5, selector: (e) => e.id }),
});

const libraryPatchArb: fc.Arbitrary<LibraryPatchGraph> = fc.record({
  id: idArb,
  name: nameArb,
  version: versionArb,
  nodes: fc.uniqueArray(nodeArb, { minLength: 0, maxLength: 5, selector: (n) => n.id }),
  edges: fc.uniqueArray(edgeArb, { minLength: 0, maxLength: 5, selector: (e) => e.id }),
});

const persistEventArb: fc.Arbitrary<CanvasPersistEvent> = fc.oneof(
  fc.constant({ type: 'coldStart' as const }),
  fc.constant({ type: 'refresh' as const }),
  graphPartsArb.map((graph) => ({ type: 'edit' as const, ...graph })),
  fc.constant({ type: 'autosaveTick' as const }),
  fc.constant({ type: 'save' as const }),
  fc.record({ type: fc.constant('saveAs' as const), name: nameArb, newId: idArb }),
  libraryPatchArb.map((patch) => ({ type: 'libraryOpen' as const, patch })),
  fc.constant({ type: 'new' as const }),
  fc.constant({ type: 'signOut' as const }),
  idArb.map((userId) => ({ type: 'signIn' as const, userId })),
);

function assertLiveMatchesEmpty(state: CanvasPersistState) {
  const empty = emptyWorkingGraph();
  expect(state.liveNodes.length + state.liveEdges.length).toBe(
    empty.nodes.length + empty.edges.length,
  );
}

describe('decideCanvasBoot', () => {
  it('restores a draft when one exists and otherwise starts empty', () => {
    fc.assert(
      fc.property(fc.boolean(), (draftPresent) => {
        const decision = decideCanvasBoot(draftPresent);
        const expected = draftPresent
          ? ('restoreDraft' as const)
          : ('empty' as const);
        expect(decision).toBe(expected);
      }),
    );
  });
});

describe('emptyWorkingGraph', () => {
  it('never carries nodes or wires on a blank canvas', () => {
    fc.assert(
      fc.property(fc.nat({ max: 40 }), () => {
        const graph = emptyWorkingGraph();
        const empty = emptyCanvasDraftPayload();
        expect(graph.nodes.length + graph.edges.length).toBe(
          empty.nodes.length + empty.edges.length,
        );
        expect(empty.activePatchId).toBeNull();
        expect(empty.activePatchName).toBe(BLANK_PATCH_NAME);
        expect(empty.isDirty).toBe(emptyCanvasDraftPayload().isDirty);
      }),
    );
  });
});

describe('shouldWriteGraphToDatabase / decideGraphWriteSink', () => {
  it('writes the database only for Save and Save As, never for edit or autosave', () => {
    fc.assert(
      fc.property(writeReasonArb, (reason) => {
        const writesDb = shouldWriteGraphToDatabase(reason);
        const expectedWritesDb = reason === 'save' || reason === 'saveAs';
        expect(writesDb).toBe(expectedWritesDb);

        const sink = decideGraphWriteSink(reason);
        const expectedSink =
          reason === 'edit'
            ? ('browserDraft' as const)
            : reason === 'autosave'
              ? null
              : expectedWritesDb
                ? ('database' as const)
                : null;
        expect(sink).toBe(expectedSink);
      }),
    );
  });
});

describe('decideWorkingGraphSource', () => {
  it('loads library opens from the database, blanks New and sign-out, and restores drafts on refresh or cold start', () => {
    fc.assert(
      fc.property(sourceEventArb, fc.boolean(), (event, draftPresent) => {
        const source = decideWorkingGraphSource(event, draftPresent);
        const expected =
          event === 'libraryOpen'
            ? ('database' as const)
            : event === 'new' || event === 'signOut'
              ? ('empty' as const)
              : draftPresent
                ? ('browserDraft' as const)
                : ('empty' as const);
        expect(source).toBe(expected);
      }),
    );
  });
});

describe('canvasDraftUserKey / canvasDraftStorageKey', () => {
  it('keys drafts by user id and isolates distinct users', () => {
    fc.assert(
      fc.property(optionalIdArb, optionalIdArb, (userA, userB) => {
        const keyA = canvasDraftUserKey(userA);
        const keyB = canvasDraftUserKey(userB);
        const expectedKeyA = userA === null ? ANONYMOUS_DRAFT_USER_KEY : userA;
        expect(keyA).toBe(expectedKeyA);
        const storageA = canvasDraftStorageKey(keyA);
        const storageB = canvasDraftStorageKey(keyB);
        expect(storageA).toContain(keyA);
        expect(storageA === storageB).toBe(keyA === keyB);
      }),
    );
  });
});

describe('serializeCanvasDraftPayload / parseCanvasDraftPayload', () => {
  it('round-trips every well-formed draft payload including Flow fields', () => {
    fc.assert(
      fc.property(draftPayloadArb, (payload) => {
        const parsed = parseCanvasDraftPayload(serializeCanvasDraftPayload(payload));
        expect(parsed).toEqual(payload);
      }),
    );
  });

  it('rejects non-string and malformed raw values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.string().filter((value) => {
            try {
              JSON.parse(value);
              return false;
            } catch {
              return true;
            }
          }),
        ),
        (raw) => {
          expect(parseCanvasDraftPayload(raw)).toBeNull();
        },
      ),
    );
  });
});

describe('readCanvasDraft / writeCanvasDraft / clearCanvasDraft', () => {
  it('stores and clears drafts under the user storage key', () => {
    fc.assert(
      fc.property(optionalIdArb, draftPayloadArb, (userId, payload) => {
        clearCanvasDraft(userId);
        expect(readCanvasDraft(userId)).toBeNull();
        writeCanvasDraft(userId, payload);
        expect(readCanvasDraft(userId)).toEqual(payload);
        clearCanvasDraft(userId);
        expect(readCanvasDraft(userId)).toBeNull();
      }),
    );
  });
});

describe('sign-out / New / library / multi-tab policies', () => {
  it('stays aligned with the decided policy tokens', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), () => {
        const blankLive = 'blank' as const;
        const retainDraft = 'retain' as const;
        const clearDraft = 'clear' as const;
        const replaceDraft = 'replaceWithDatabaseGraph' as const;
        const lastWrite = 'lastWriteWins' as const;
        expect(decideLiveCanvasAfterSignOut()).toBe(blankLive);
        expect(decideDraftStorageAfterSignOut()).toBe(retainDraft);
        expect(decideDraftAfterNew()).toBe(clearDraft);
        expect(decideDraftAfterLibraryOpen()).toBe(replaceDraft);
        expect(decideMultiTabDraftPolicy()).toBe(lastWrite);
      }),
    );
  });
});

describe('reduceCanvasPersist model', () => {
  it('never writes the database on edit or autosave ticks', () => {
    fc.assert(
      fc.property(graphPartsArb, (graph) => {
        const dirty = true as const;
        const wroteDraft = true as const;
        let state = initialCanvasPersistState(null);
        state = reduceCanvasPersist(state, { type: 'edit', ...graph });
        expect(state.lastDbWriteReason).toBeNull();
        expect(state.lastBrowserDraftWrite).toBe(wroteDraft);
        expect(state.isDirty).toBe(dirty);
        expect(state.liveNodes).toEqual(graph.nodes);
        expect(state.liveEdges).toEqual(graph.edges);
        expect(state.draft).toEqual({
          activePatchId: state.activePatchId,
          activePatchName: state.activePatchName,
          patchVersion: state.patchVersion,
          isDirty: dirty,
          nodes: graph.nodes,
          edges: graph.edges,
        });
        state = reduceCanvasPersist(state, { type: 'autosaveTick' });
        expect(state.lastDbWriteReason).toBeNull();
      }),
    );
  });

  it('restores the stored draft on cold start and refresh, else blanks', () => {
    fc.assert(
      fc.property(fc.option(draftPayloadArb, { nil: null }), (draft) => {
        const base: CanvasPersistState = {
          ...initialCanvasPersistState(null),
          draft,
        };
        const empty = emptyWorkingGraph();
        for (const type of ['coldStart', 'refresh'] as const) {
          const next = reduceCanvasPersist(base, { type });
          expect(next.liveNodes).toEqual(draft ? draft.nodes : empty.nodes);
          expect(next.liveEdges).toEqual(draft ? draft.edges : empty.edges);
          expect(next.activePatchId).toBe(draft ? draft.activePatchId : null);
          expect(next.isDirty).toBe(draft ? draft.isDirty : emptyCanvasDraftPayload().isDirty);
        }
      }),
    );
  });

  it('opens a library Patch from the database graph and replaces the working draft', () => {
    fc.assert(
      fc.property(draftPayloadArb, libraryPatchArb, (priorDraft, patch) => {
        const state = reduceCanvasPersist(
          {
            ...initialCanvasPersistState(null),
            draft: priorDraft,
            liveNodes: priorDraft.nodes,
            liveEdges: priorDraft.edges,
            activePatchId: priorDraft.activePatchId,
            activePatchName: priorDraft.activePatchName,
            patchVersion: priorDraft.patchVersion,
            isDirty: true,
          },
          { type: 'libraryOpen', patch },
        );
        expect(state.liveNodes).toEqual(patch.nodes);
        expect(state.liveEdges).toEqual(patch.edges);
        expect(state.activePatchId).toBe(patch.id);
        expect(state.activePatchName).toBe(patch.name);
        expect(state.patchVersion).toBe(patch.version);
        expect(state.isDirty).toBe(emptyCanvasDraftPayload().isDirty);
        expect(state.draft).toEqual({
          activePatchId: patch.id,
          activePatchName: patch.name,
          patchVersion: patch.version,
          isDirty: emptyCanvasDraftPayload().isDirty,
          nodes: patch.nodes,
          edges: patch.edges,
        });
        expect(state.lastDbWriteReason).toBeNull();
      }),
    );
  });

  it('clears the draft on New and blanks live canvas', () => {
    fc.assert(
      fc.property(draftPayloadArb, (draft) => {
        const state = reduceCanvasPersist(
          {
            ...initialCanvasPersistState(null),
            draft,
            liveNodes: draft.nodes,
            liveEdges: draft.edges,
            activePatchId: draft.activePatchId,
            activePatchName: draft.activePatchName,
            patchVersion: draft.patchVersion,
            isDirty: draft.isDirty,
          },
          { type: 'new' },
        );
        expect(state.draft).toBeNull();
        assertLiveMatchesEmpty(state);
        expect(state.activePatchId).toBeNull();
        expect(state.activePatchName).toBe(BLANK_PATCH_NAME);
        expect(state.isDirty).toBe(emptyCanvasDraftPayload().isDirty);
      }),
    );
  });

  it('blanks the live canvas on sign-out while retaining the stored draft', () => {
    fc.assert(
      fc.property(draftPayloadArb, idArb, (draft, userId) => {
        const state = reduceCanvasPersist(
          {
            ...initialCanvasPersistState(userId),
            draft,
            liveNodes: draft.nodes,
            liveEdges: draft.edges,
            activePatchId: draft.activePatchId,
            activePatchName: draft.activePatchName,
            patchVersion: draft.patchVersion,
            isDirty: draft.isDirty,
          },
          { type: 'signOut' },
        );
        assertLiveMatchesEmpty(state);
        expect(state.userId).toBeNull();
        expect(state.draft).toEqual(draft);
        expect(state.isDirty).toBe(emptyCanvasDraftPayload().isDirty);
      }),
    );
  });

  it('records database writes only for Save and Save As', () => {
    fc.assert(
      fc.property(idArb, idArb, nameArb, graphPartsArb, (patchId, saveAsId, saveAsName, graph) => {
        const saveReason = 'save' as const;
        const saveAsReason = 'saveAs' as const;
        let state = reduceCanvasPersist(initialCanvasPersistState(null), {
          type: 'edit',
          ...graph,
        });
        state = reduceCanvasPersist(state, { type: 'autosaveTick' });
        expect(state.lastDbWriteReason).toBeNull();

        state = {
          ...state,
          activePatchId: patchId,
        };
        state = reduceCanvasPersist(state, { type: 'save' });
        expect(state.lastDbWriteReason).toBe(saveReason);
        expect(state.isDirty).toBe(emptyCanvasDraftPayload().isDirty);

        state = reduceCanvasPersist(state, {
          type: 'edit',
          nodes: graph.nodes,
          edges: graph.edges,
        });
        state = reduceCanvasPersist(state, {
          type: 'saveAs',
          name: saveAsName,
          newId: saveAsId,
        });
        expect(state.lastDbWriteReason).toBe(saveAsReason);
        expect(state.activePatchId).toBe(saveAsId);
        expect(state.activePatchName).toBe(saveAsName);
        expect(state.isDirty).toBe(emptyCanvasDraftPayload().isDirty);
      }),
    );
  });

  it('keeps illegal states unreachable across random event sequences', () => {
    fc.assert(
      fc.property(
        optionalIdArb,
        fc.array(persistEventArb, { minLength: 1, maxLength: 20 }),
        (userId, events) => {
          let state = initialCanvasPersistState(userId);
          for (const event of events) {
            const beforeDraft = state.draft;
            const beforeActiveId = state.activePatchId;
            state = reduceCanvasPersist(state, event);

            const dbWriteOk =
              state.lastDbWriteReason === null ||
              shouldWriteGraphToDatabase(state.lastDbWriteReason);
            expect(dbWriteOk).toBe(
              state.lastDbWriteReason === null ||
                state.lastDbWriteReason === 'save' ||
                state.lastDbWriteReason === 'saveAs',
            );

            expect(
              event.type === 'autosaveTick' ? state.lastDbWriteReason : 'ok',
            ).toBe(event.type === 'autosaveTick' ? null : 'ok');

            expect(event.type === 'new' ? state.draft : 'ok').toBe(
              event.type === 'new' ? null : 'ok',
            );
            expect(
              event.type === 'new'
                ? state.liveNodes.length + state.liveEdges.length
                : 0,
            ).toBe(
              event.type === 'new'
                ? emptyWorkingGraph().nodes.length + emptyWorkingGraph().edges.length
                : 0,
            );

            expect(event.type === 'signOut' ? state.userId : 'ok').toBe(
              event.type === 'signOut' ? null : 'ok',
            );
            expect(event.type === 'signOut' ? state.draft : beforeDraft).toEqual(
              event.type === 'signOut' ? beforeDraft : beforeDraft,
            );
            expect(
              event.type === 'signOut'
                ? state.liveNodes.length + state.liveEdges.length
                : 0,
            ).toBe(
              event.type === 'signOut'
                ? emptyWorkingGraph().nodes.length + emptyWorkingGraph().edges.length
                : 0,
            );

            expect(
              event.type === 'libraryOpen' ? state.activePatchId : 'ok',
            ).toBe(event.type === 'libraryOpen' ? event.patch.id : 'ok');
            expect(
              event.type === 'libraryOpen' ? state.liveNodes : null,
            ).toEqual(event.type === 'libraryOpen' ? event.patch.nodes : null);
            expect(
              event.type === 'libraryOpen' ? state.draft?.nodes : null,
            ).toEqual(event.type === 'libraryOpen' ? event.patch.nodes : null);
            expect(
              event.type === 'libraryOpen' ? state.isDirty : emptyCanvasDraftPayload().isDirty,
            ).toBe(emptyCanvasDraftPayload().isDirty);

            expect(
              event.type === 'save' && beforeActiveId === null
                ? state.lastDbWriteReason
                : 'ok',
            ).toBe(
              event.type === 'save' && beforeActiveId === null ? null : 'ok',
            );
          }
        },
      ),
    );
  });
});

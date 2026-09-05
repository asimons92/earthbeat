import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';

/** Browser draft key when nobody is signed in. */
export const ANONYMOUS_DRAFT_USER_KEY = 'anonymous';

/** JSON-serializable Flow node (full React Flow fields preserved). */
export type CanvasDraftNode = Record<string, unknown> & { id: string };

/** JSON-serializable Flow edge (full React Flow fields preserved). */
export type CanvasDraftEdge = Record<string, unknown> & { id: string };

/** Working canvas snapshot kept in browser storage, not the database. */
export type CanvasDraftPayload = {
  activePatchId: string | null;
  activePatchName: string;
  patchVersion: number;
  isDirty: boolean;
  nodes: ReadonlyArray<CanvasDraftNode>;
  edges: ReadonlyArray<CanvasDraftEdge>;
};

export type GraphWriteReason = 'edit' | 'save' | 'saveAs' | 'autosave';

export type WorkingGraphSourceEvent =
  | 'libraryOpen'
  | 'refresh'
  | 'coldStart'
  | 'new'
  | 'signOut';

export type WorkingGraphSource = 'database' | 'browserDraft' | 'empty';

export type CanvasBootDecision = 'restoreDraft' | 'empty';

export type LiveCanvasAfterSignOut = 'blank';
export type DraftStorageAfterSignOut = 'retain';
export type DraftAfterNew = 'clear';
export type DraftAfterLibraryOpen = 'replaceWithDatabaseGraph';
export type MultiTabDraftPolicy = 'lastWriteWins';

export type CanvasPersistState = {
  userId: string | null;
  /** Stored browser draft for the current user key. */
  draft: CanvasDraftPayload | null;
  liveNodes: ReadonlyArray<CanvasDraftNode>;
  liveEdges: ReadonlyArray<CanvasDraftEdge>;
  activePatchId: string | null;
  activePatchName: string;
  patchVersion: number;
  isDirty: boolean;
  /** Last graph-write attempt reason that reached the database, if any. */
  lastDbWriteReason: GraphWriteReason | null;
  /** True when the latest edit flushed a browser draft. */
  lastBrowserDraftWrite: boolean;
};

export type LibraryPatchGraph = {
  id: string;
  name: string;
  version: number;
  nodes: ReadonlyArray<CanvasDraftNode>;
  edges: ReadonlyArray<CanvasDraftEdge>;
};

export type CanvasPersistEvent =
  | { type: 'coldStart' }
  | { type: 'refresh' }
  | { type: 'edit'; nodes: ReadonlyArray<CanvasDraftNode>; edges: ReadonlyArray<CanvasDraftEdge> }
  | { type: 'autosaveTick' }
  | { type: 'save' }
  | { type: 'saveAs'; name: string; newId: string }
  | { type: 'libraryOpen'; patch: LibraryPatchGraph }
  | { type: 'new' }
  | { type: 'signOut' }
  | { type: 'signIn'; userId: string };

export function canvasDraftUserKey(userId: string | null | undefined): string {
  if (typeof userId === 'string' && userId.length > 0) return userId;
  return ANONYMOUS_DRAFT_USER_KEY;
}

export function canvasDraftStorageKey(userKey: string): string {
  return `earthbeat:canvas-draft:${userKey}`;
}

export function emptyWorkingGraph(): {
  nodes: ReadonlyArray<CanvasDraftNode>;
  edges: ReadonlyArray<CanvasDraftEdge>;
} {
  return { nodes: [], edges: [] };
}

export function emptyCanvasDraftPayload(): CanvasDraftPayload {
  const graph = emptyWorkingGraph();
  return {
    activePatchId: null,
    activePatchName: BLANK_PATCH_NAME,
    patchVersion: 1,
    isDirty: false,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export function decideCanvasBoot(draftPresent: boolean): CanvasBootDecision {
  return draftPresent ? 'restoreDraft' : 'empty';
}

/** Database receives the graph only for explicit Save / Save As. */
export function shouldWriteGraphToDatabase(reason: GraphWriteReason): boolean {
  return reason === 'save' || reason === 'saveAs';
}

/** Edits update the browser draft; autosave never writes the database. */
export function decideGraphWriteSink(
  reason: GraphWriteReason,
): 'browserDraft' | 'database' | null {
  if (reason === 'edit') return 'browserDraft';
  if (reason === 'autosave') return null;
  if (shouldWriteGraphToDatabase(reason)) return 'database';
  return null;
}

export function decideWorkingGraphSource(
  event: WorkingGraphSourceEvent,
  draftPresent: boolean,
): WorkingGraphSource {
  if (event === 'libraryOpen') return 'database';
  if (event === 'new' || event === 'signOut') return 'empty';
  return draftPresent ? 'browserDraft' : 'empty';
}

export function decideLiveCanvasAfterSignOut(): LiveCanvasAfterSignOut {
  return 'blank';
}

export function decideDraftStorageAfterSignOut(): DraftStorageAfterSignOut {
  return 'retain';
}

export function decideDraftAfterNew(): DraftAfterNew {
  return 'clear';
}

export function decideDraftAfterLibraryOpen(): DraftAfterLibraryOpen {
  return 'replaceWithDatabaseGraph';
}

export function decideMultiTabDraftPolicy(): MultiTabDraftPolicy {
  return 'lastWriteWins';
}

function parseFlowItem(value: unknown): CanvasDraftNode | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string') return null;
  return value as CanvasDraftNode;
}

export function serializeCanvasDraftPayload(payload: CanvasDraftPayload): string {
  return JSON.stringify({
    activePatchId: payload.activePatchId,
    activePatchName: payload.activePatchName,
    patchVersion: payload.patchVersion,
    isDirty: payload.isDirty,
    nodes: payload.nodes,
    edges: payload.edges,
  });
}

export function parseCanvasDraftPayload(raw: unknown): CanvasDraftPayload | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.activePatchName !== 'string') return null;
    if (typeof record.patchVersion !== 'number' || !Number.isFinite(record.patchVersion)) {
      return null;
    }
    if (typeof record.isDirty !== 'boolean') return null;
    if (record.activePatchId !== null && typeof record.activePatchId !== 'string') return null;
    if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) return null;
    const nodes: CanvasDraftNode[] = [];
    for (const node of record.nodes) {
      const parsedNode = parseFlowItem(node);
      if (!parsedNode) return null;
      nodes.push(parsedNode);
    }
    const edges: CanvasDraftEdge[] = [];
    for (const edge of record.edges) {
      const parsedEdge = parseFlowItem(edge);
      if (!parsedEdge) return null;
      edges.push(parsedEdge);
    }
    return {
      activePatchId: record.activePatchId,
      activePatchName: record.activePatchName,
      patchVersion: record.patchVersion,
      isDirty: record.isDirty,
      nodes,
      edges,
    };
  } catch {
    return null;
  }
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

/** In-memory fallback when localStorage is missing (tests / SSR). */
const memoryDraftStore = new Map<string, string>();

function storageGet(key: string): string | null {
  if (canUseLocalStorage()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return memoryDraftStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // Fall through to memory.
    }
  }
  memoryDraftStore.set(key, value);
}

function storageRemove(key: string): void {
  if (canUseLocalStorage()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Fall through to memory.
    }
  }
  memoryDraftStore.delete(key);
}

/** Read the browser draft for a user (or anonymous). Last write wins across tabs. */
export function readCanvasDraft(userId: string | null | undefined): CanvasDraftPayload | null {
  const raw = storageGet(canvasDraftStorageKey(canvasDraftUserKey(userId)));
  if (raw === null) return null;
  return parseCanvasDraftPayload(raw);
}

/** Write the browser draft for a user (or anonymous). */
export function writeCanvasDraft(
  userId: string | null | undefined,
  payload: CanvasDraftPayload,
): void {
  storageSet(
    canvasDraftStorageKey(canvasDraftUserKey(userId)),
    serializeCanvasDraftPayload(payload),
  );
}

/** Clear the browser draft for a user (or anonymous). */
export function clearCanvasDraft(userId: string | null | undefined): void {
  storageRemove(canvasDraftStorageKey(canvasDraftUserKey(userId)));
}

export function initialCanvasPersistState(userId: string | null = null): CanvasPersistState {
  const empty = emptyWorkingGraph();
  return {
    userId,
    draft: null,
    liveNodes: empty.nodes,
    liveEdges: empty.edges,
    activePatchId: null,
    activePatchName: BLANK_PATCH_NAME,
    patchVersion: 1,
    isDirty: false,
    lastDbWriteReason: null,
    lastBrowserDraftWrite: false,
  };
}

function snapshotDraft(state: CanvasPersistState, isDirty: boolean): CanvasDraftPayload {
  return {
    activePatchId: state.activePatchId,
    activePatchName: state.activePatchName,
    patchVersion: state.patchVersion,
    isDirty,
    nodes: state.liveNodes,
    edges: state.liveEdges,
  };
}

function restoreFromDraft(state: CanvasPersistState, draft: CanvasDraftPayload): CanvasPersistState {
  return {
    ...state,
    draft,
    liveNodes: draft.nodes,
    liveEdges: draft.edges,
    activePatchId: draft.activePatchId,
    activePatchName: draft.activePatchName,
    patchVersion: draft.patchVersion,
    isDirty: draft.isDirty,
    lastDbWriteReason: null,
    lastBrowserDraftWrite: false,
  };
}

function blankLive(state: CanvasPersistState, clearDraft: boolean): CanvasPersistState {
  const empty = emptyWorkingGraph();
  return {
    ...state,
    draft: clearDraft ? null : state.draft,
    liveNodes: empty.nodes,
    liveEdges: empty.edges,
    activePatchId: null,
    activePatchName: BLANK_PATCH_NAME,
    patchVersion: 1,
    isDirty: false,
    lastDbWriteReason: null,
    lastBrowserDraftWrite: false,
  };
}

/**
 * Pure model of canvas draft vs database Save.
 * Wiring (localStorage, React Flow, tRPC) stays outside this reducer.
 */
export function reduceCanvasPersist(
  state: CanvasPersistState,
  event: CanvasPersistEvent,
): CanvasPersistState {
  switch (event.type) {
    case 'coldStart':
    case 'refresh': {
      if (state.draft) return restoreFromDraft(state, state.draft);
      return blankLive(state, false);
    }
    case 'edit': {
      const next: CanvasPersistState = {
        ...state,
        liveNodes: event.nodes,
        liveEdges: event.edges,
        isDirty: true,
        lastDbWriteReason: null,
        lastBrowserDraftWrite: true,
      };
      return {
        ...next,
        draft: snapshotDraft(next, true),
      };
    }
    case 'autosaveTick': {
      // Debounced database autosave is removed. Tick is a no-op for the DB.
      return {
        ...state,
        lastDbWriteReason: null,
        lastBrowserDraftWrite: false,
      };
    }
    case 'save': {
      if (state.activePatchId === null) return state;
      const next: CanvasPersistState = {
        ...state,
        isDirty: false,
        lastDbWriteReason: 'save',
        lastBrowserDraftWrite: false,
      };
      return {
        ...next,
        draft: snapshotDraft(next, false),
      };
    }
    case 'saveAs': {
      const next: CanvasPersistState = {
        ...state,
        activePatchId: event.newId,
        activePatchName: event.name,
        patchVersion: 1,
        isDirty: false,
        lastDbWriteReason: 'saveAs',
        lastBrowserDraftWrite: false,
      };
      return {
        ...next,
        draft: snapshotDraft(next, false),
      };
    }
    case 'libraryOpen': {
      const next: CanvasPersistState = {
        ...state,
        liveNodes: event.patch.nodes,
        liveEdges: event.patch.edges,
        activePatchId: event.patch.id,
        activePatchName: event.patch.name,
        patchVersion: event.patch.version,
        isDirty: false,
        lastDbWriteReason: null,
        lastBrowserDraftWrite: false,
      };
      return {
        ...next,
        draft: snapshotDraft(next, false),
      };
    }
    case 'new': {
      return blankLive(state, decideDraftAfterNew() === 'clear');
    }
    case 'signOut': {
      const cleared = blankLive(state, false);
      return {
        ...cleared,
        userId: null,
        draft: decideDraftStorageAfterSignOut() === 'retain' ? state.draft : null,
      };
    }
    case 'signIn': {
      return {
        ...state,
        userId: event.userId,
      };
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

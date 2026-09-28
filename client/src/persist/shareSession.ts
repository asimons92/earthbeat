import type { DomainGraph } from '@/persist/graphMapper';
import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';

/**
 * Share token writes must not bump Patch.version.
 * An open canvas autosave compares that version and would conflict.
 */
export type ShareTokenState = {
  patchId: string;
  token: string | null;
  version: number;
  retired: readonly string[];
};

export type ShareTokenEvent =
  | { type: 'publish'; nextToken: string }
  | { type: 'revoke' };

export type CanvasShareSubject =
  | { kind: 'blank' }
  | { kind: 'starter' }
  | { kind: 'owned'; patchId: string | null }
  | { kind: 'shared' };

export type ShareOffer = 'offer' | 'hide';

export type PatchRead = 'owner' | 'share' | 'deny';

export type PatchReadRequest = {
  callerUserId: string | null;
  ownerUserId: string;
  patchId: string;
  requestedPatchId: string | null;
  shareToken: string | null;
  requestedToken: string | null;
};

export type SharedPatchSource = {
  name: string;
  graph: DomainGraph;
  userId: string;
  shareToken: string | null;
  ownerEmail?: string;
  ownerName?: string;
  ownerImage?: string;
  provider?: string;
  providerSubject?: string;
};

export type SharedPatchView = {
  name: string;
  graph: DomainGraph;
};

export type ShareCanvasSnapshot = {
  activePatchId: string | null;
  name: string;
  graph: DomainGraph;
};

export type ShareVisit = {
  token: string;
  ownerPatchId: string;
  name: string;
  graph: DomainGraph;
};

export type ShareSessionState = {
  canvas: ShareCanvasSnapshot;
  visit: ShareVisit | null;
  stashed: ShareCanvasSnapshot | null;
  discardedOnEnter: boolean;
  /** True while /share/:token must not play or save the visitor's own graph. */
  routeLocked: boolean;
};

export type ShareSessionEvent =
  | {
      type: 'enter';
      token: string;
      ownerPatchId: string;
      name: string;
      graph: DomainGraph;
      discardDirty: boolean;
    }
  | { type: 'leave' }
  | { type: 'miss' }
  | { type: 'saveCopy'; newPatchId: string; name: string; graph: DomainGraph };

export type LibraryShareMark = 'shared' | 'private';

export type LibraryRowDetail = {
  label: string;
  mark: LibraryShareMark;
};

function emptyGraph(): DomainGraph {
  return {
    connectors: [],
    modulators: [],
    oscillators: [],
    effects: [],
    wires: [],
  };
}

function presentToken(token: string | null): string | null {
  if (token === null) return null;
  if (token.length === 0) return null;
  return token;
}

function cloneGraph(graph: DomainGraph): DomainGraph {
  return structuredClone(graph);
}

function cloneSnapshot(snapshot: ShareCanvasSnapshot): ShareCanvasSnapshot {
  return {
    activePatchId: snapshot.activePatchId,
    name: snapshot.name,
    graph: cloneGraph(snapshot.graph),
  };
}

type IdRow = { id: string; patchId: string };

function graphNodeRows(graph: DomainGraph): IdRow[] {
  return [
    ...graph.connectors,
    ...graph.modulators,
    ...graph.oscillators,
    ...graph.effects,
  ];
}

function graphRows(graph: DomainGraph): IdRow[] {
  return [...graphNodeRows(graph), ...graph.wires];
}

export function reduceShareToken(
  state: ShareTokenState,
  event: ShareTokenEvent,
): ShareTokenState {
  if (event.type === 'revoke') {
    const current = presentToken(state.token);
    if (current === null) {
      return {
        patchId: state.patchId,
        token: null,
        version: state.version,
        retired: state.retired,
      };
    }
    return {
      patchId: state.patchId,
      token: null,
      version: state.version,
      retired: [...state.retired, current],
    };
  }

  const current = presentToken(state.token);
  if (current !== null) {
    return {
      patchId: state.patchId,
      token: current,
      version: state.version,
      retired: state.retired,
    };
  }

  const next = presentToken(event.nextToken);
  if (next === null) return { ...state, token: null, version: state.version };
  if (next === state.patchId) return { ...state, token: null, version: state.version };
  if (state.retired.includes(next)) return { ...state, token: null, version: state.version };

  return {
    patchId: state.patchId,
    token: next,
    version: state.version,
    retired: state.retired,
  };
}

export function decideShareOffer(subject: CanvasShareSubject): ShareOffer {
  if (subject.kind !== 'owned') return 'hide';
  if (presentToken(subject.patchId) === null) return 'hide';
  return 'offer';
}

export function decidePatchRead(input: PatchReadRequest): PatchRead {
  if (input.requestedPatchId !== null) {
    const callerOwns =
      input.callerUserId !== null && input.callerUserId === input.ownerUserId;
    if (input.requestedPatchId === input.patchId && callerOwns) return 'owner';
    return 'deny';
  }

  const stored = presentToken(input.shareToken);
  const requested = presentToken(input.requestedToken);
  if (stored !== null && requested !== null && stored === requested) return 'share';
  return 'deny';
}

export function projectSharedPatch(input: SharedPatchSource): SharedPatchView {
  return {
    name: input.name,
    graph: cloneGraph(input.graph),
  };
}

export function copyShareGraph(
  graph: DomainGraph,
  nextPatchId: string,
  mintedIds: readonly string[],
): DomainGraph {
  const rows = graphRows(graph);
  const sourceIds = rows.map((row) => row.id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error('Share copy rejected duplicate source ids');
  }

  const nodeIds = new Set(graphNodeRows(graph).map((row) => row.id));
  for (const wire of graph.wires) {
    if (!nodeIds.has(wire.sourceNodeId) || !nodeIds.has(wire.targetNodeId)) {
      throw new Error('Share copy rejected a dangling wire');
    }
  }

  if (mintedIds.length !== sourceIds.length) {
    throw new Error('Share copy rejected a mint list of the wrong length');
  }
  if (new Set(mintedIds).size !== mintedIds.length) {
    throw new Error('Share copy rejected duplicate mint ids');
  }
  const sourceIdSet = new Set(sourceIds);
  for (const id of mintedIds) {
    if (sourceIdSet.has(id)) {
      throw new Error('Share copy rejected a mint id that already belongs to the source');
    }
  }

  const idMap = new Map<string, string>();
  let cursor = 0;
  const take = (oldId: string): string => {
    const minted = mintedIds[cursor];
    cursor += 1;
    if (minted === undefined) {
      throw new Error('Share copy rejected a mint list of the wrong length');
    }
    idMap.set(oldId, minted);
    return minted;
  };

  const cloneRow = <T extends IdRow>(row: T): T => {
    const copy = structuredClone(row);
    copy.id = take(row.id);
    copy.patchId = nextPatchId;
    return copy;
  };

  const connectors = graph.connectors.map((row) => cloneRow(row));
  const modulators = graph.modulators.map((row) => cloneRow(row));
  const oscillators = graph.oscillators.map((row) => cloneRow(row));
  const effects = graph.effects.map((row) => cloneRow(row));
  const wires = graph.wires.map((row) => {
    const copy = cloneRow(row);
    const sourceNodeId = idMap.get(row.sourceNodeId);
    const targetNodeId = idMap.get(row.targetNodeId);
    if (sourceNodeId === undefined || targetNodeId === undefined) {
      throw new Error('Share copy rejected a dangling wire');
    }
    copy.sourceNodeId = sourceNodeId;
    copy.targetNodeId = targetNodeId;
    return copy;
  });

  return { connectors, modulators, oscillators, effects, wires };
}

export function initialShareSession(canvas: ShareCanvasSnapshot): ShareSessionState {
  return {
    canvas: cloneSnapshot(canvas),
    visit: null,
    stashed: null,
    discardedOnEnter: false,
    routeLocked: false,
  };
}

export function reduceShareSession(
  state: ShareSessionState,
  event: ShareSessionEvent,
): ShareSessionState {
  if (event.type === 'enter') {
    if (state.visit !== null) return state;
    const graph = cloneGraph(event.graph);
    const visit: ShareVisit = {
      token: event.token,
      ownerPatchId: event.ownerPatchId,
      name: event.name,
      graph: cloneGraph(event.graph),
    };
    const fromLockedRoute = state.routeLocked;
    return {
      canvas: {
        activePatchId: null,
        name: event.name,
        graph,
      },
      visit,
      stashed: fromLockedRoute
        ? state.stashed
        : event.discardDirty
          ? null
          : cloneSnapshot(state.canvas),
      discardedOnEnter: fromLockedRoute ? state.stashed === null : event.discardDirty,
      routeLocked: true,
    };
  }

  if (event.type === 'miss') {
    if (state.routeLocked && state.visit === null) return state;
    const stashed =
      state.visit !== null
        ? state.discardedOnEnter
          ? null
          : state.stashed
        : cloneSnapshot(state.canvas);
    return {
      canvas: {
        activePatchId: null,
        name: BLANK_PATCH_NAME,
        graph: emptyGraph(),
      },
      visit: null,
      stashed,
      discardedOnEnter: false,
      routeLocked: true,
    };
  }

  if (event.type === 'leave') {
    if (state.visit === null && !state.routeLocked) return state;
    if (state.discardedOnEnter || state.stashed === null) {
      return {
        canvas: {
          activePatchId: null,
          name: BLANK_PATCH_NAME,
          graph: emptyGraph(),
        },
        visit: null,
        stashed: null,
        discardedOnEnter: false,
        routeLocked: false,
      };
    }
    return {
      canvas: cloneSnapshot(state.stashed),
      visit: null,
      stashed: null,
      discardedOnEnter: false,
      routeLocked: false,
    };
  }

  if (state.visit === null) return state;
  return {
    canvas: {
      activePatchId: event.newPatchId,
      name: event.name,
      graph: cloneGraph(event.graph),
    },
    visit: null,
    stashed: null,
    discardedOnEnter: false,
    routeLocked: false,
  };
}

export function shareSessionBlocksPersist(state: ShareSessionState): boolean {
  return state.visit !== null || state.routeLocked;
}

export type ShareLinkRaceState = {
  stored: ShareTokenState;
  epoch: number;
  shown: string | null;
  busy: boolean;
  startedEpoch: number | null;
};

export type ShareLinkRaceEvent =
  | { type: 'publishStart' }
  | { type: 'publishResult'; token: string }
  | { type: 'revoke' };

export function initialShareLinkRace(patchId: string, version: number): ShareLinkRaceState {
  return {
    stored: { patchId, token: null, version, retired: [] },
    epoch: 0,
    shown: null,
    busy: false,
    startedEpoch: null,
  };
}

/**
 * One publish runs at a time. Stop bumps the epoch.
 * A result from an older epoch must not leave a new token on display or in storage.
 */
export function reduceShareLinkRace(
  state: ShareLinkRaceState,
  event: ShareLinkRaceEvent,
): ShareLinkRaceState {
  if (event.type === 'publishStart') {
    if (state.busy) return state;
    return { ...state, busy: true, startedEpoch: state.epoch };
  }
  if (event.type === 'revoke') {
    return {
      ...state,
      stored: reduceShareToken(state.stored, { type: 'revoke' }),
      epoch: state.epoch + 1,
      shown: null,
    };
  }
  if (!state.busy || state.startedEpoch === null) return state;
  if (state.startedEpoch !== state.epoch) {
    const claimed = reduceShareToken(state.stored, {
      type: 'publish',
      nextToken: event.token,
    });
    const stored =
      claimed.token === state.stored.token
        ? state.stored
        : reduceShareToken(claimed, { type: 'revoke' });
    return {
      stored,
      epoch: state.epoch,
      shown: null,
      busy: false,
      startedEpoch: null,
    };
  }
  const stored = reduceShareToken(state.stored, { type: 'publish', nextToken: event.token });
  return {
    stored,
    epoch: state.epoch,
    shown: stored.token,
    busy: false,
    startedEpoch: null,
  };
}

export type PatchGraphSnapshot = {
  generation: number;
  nodeIds: readonly string[];
  wireEnds: readonly string[];
};

export type PatchGraphLockState = {
  holder: 'free' | 'replace' | 'share';
  committed: PatchGraphSnapshot;
  pending: PatchGraphSnapshot | null;
  observed: PatchGraphSnapshot | null;
};

export type PatchGraphLockEvent =
  | { type: 'beginReplace'; next: PatchGraphSnapshot }
  | { type: 'commitReplace' }
  | { type: 'beginShareRead' }
  | { type: 'endShareRead' };

export function initialPatchGraphLock(committed: PatchGraphSnapshot): PatchGraphLockState {
  return { holder: 'free', committed, pending: null, observed: null };
}

/** A share read and a graph replace take the same Patch row lock, so the read sees one save. */
export function reducePatchGraphLock(
  state: PatchGraphLockState,
  event: PatchGraphLockEvent,
): PatchGraphLockState {
  if (event.type === 'beginReplace') {
    if (state.holder !== 'free') return state;
    return { ...state, holder: 'replace', pending: event.next };
  }
  if (event.type === 'commitReplace') {
    if (state.holder !== 'replace' || state.pending === null) return state;
    return { ...state, holder: 'free', committed: state.pending, pending: null };
  }
  if (event.type === 'beginShareRead') {
    if (state.holder !== 'free') return state;
    return { ...state, holder: 'share', observed: state.committed };
  }
  if (event.type === 'endShareRead') {
    if (state.holder !== 'share') return state;
    return { ...state, holder: 'free' };
  }
  return state;
}

export function snapshotWiresFit(snapshot: PatchGraphSnapshot): boolean {
  const nodes = new Set(snapshot.nodeIds);
  for (const end of snapshot.wireEnds) {
    if (!nodes.has(end)) return false;
  }
  return true;
}

export function libraryRowDetail(
  patchId: string,
  shareToken: string | null,
): LibraryRowDetail {
  return {
    label: patchId,
    mark: presentToken(shareToken) === null ? 'private' : 'shared',
  };
}

export function shareTokenFromPath(pathname: string): string | null {
  const prefix = '/share/';
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  if (rest.length === 0 || rest.includes('/')) return null;
  try {
    const token = decodeURIComponent(rest);
    if (token.length === 0) return null;
    return token;
  } catch {
    return null;
  }
}

export function patchIdsVisibleToUser(
  userId: string,
  rows: readonly { id: string; userId: string }[],
): string[] {
  return rows.filter((row) => row.userId === userId).map((row) => row.id);
}

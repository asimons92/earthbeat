import { transportEventForPatchLoad } from '@/runtime/voiceStop';
import type { PatchTransportEvent } from '@/runtime/patchTransport';

export const BLANK_PATCH_NAME = 'Untitled Patch';

export type DirtyNavAction = 'new' | 'load';

export type DirtyNavDecision = 'prompt' | 'proceed';

export type SaveIntent = 'save' | 'saveAs';

export type SaveRoute = 'saveNow' | 'nameThenCreate';

export type DeleteAftermath = 'blank' | 'leave';

export type BlankPatchPersistSnapshot = {
  activePatchId: null;
  activePatchName: typeof BLANK_PATCH_NAME;
  patchVersion: 1;
  persistStatus: 'idle';
  isDirty: false;
  nodeCount: 0;
  edgeCount: 0;
};

/** Dirty New or dirty open-from-library must prompt before discarding. */
export function decideDirtyNavigation(dirty: boolean, _action: DirtyNavAction): DirtyNavDecision {
  return dirty ? 'prompt' : 'proceed';
}

/** In-memory blank New: no server id until Save. */
export function blankPatchPersistSnapshot(): BlankPatchPersistSnapshot {
  return {
    activePatchId: null,
    activePatchName: BLANK_PATCH_NAME,
    patchVersion: 1,
    persistStatus: 'idle',
    isDirty: false,
    nodeCount: 0,
    edgeCount: 0,
  };
}

/** Save updates an existing id; first Save and Save As need a name then create. */
export function decideSaveRoute(
  intent: SaveIntent,
  activePatchId: string | null,
): SaveRoute {
  if (intent === 'saveAs') return 'nameThenCreate';
  return activePatchId ? 'saveNow' : 'nameThenCreate';
}

/** Deleting the open Patch resets Canvas to blank; otherwise leave the editor alone. */
export function decideDeleteAftermath(
  deletedId: string,
  activePatchId: string | null,
): DeleteAftermath {
  return activePatchId !== null && deletedId === activePatchId ? 'blank' : 'leave';
}

/** Blank New and delete-of-open use the same stop-all transport event as Patch load. */
export function transportEventForBlankOrDeleteOpen(): PatchTransportEvent {
  return transportEventForPatchLoad();
}

/** Canvas route shows New / Save / Save As; other routes hide them. */
export function shouldShowPatchFileActions(pathname: string): boolean {
  return pathname === '/';
}

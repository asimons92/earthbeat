/** Pure rules for Save / draft races in usePatchPersist. */

export type SaveSuccessAction = 'clean' | 'keepDirty' | 'ignore';

/**
 * After a successful replaceGraph, decide how to update live dirty/draft state.
 * Ignore when the user already left the Patch that was saved.
 * Keep dirty when the graph changed during the in-flight Save.
 */
export function decideSaveSuccessAction(args: {
  savedPatchId: string;
  activePatchId: string | null;
  graphEpochAtSaveStart: number;
  graphEpochNow: number;
}): SaveSuccessAction {
  if (args.activePatchId !== args.savedPatchId) return 'ignore';
  if (args.graphEpochNow !== args.graphEpochAtSaveStart) return 'keepDirty';
  return 'clean';
}

/** Load, New, and Save As must not run while a Save is in flight. */
export function shouldBlockCanvasMutation(saveInFlight: boolean): boolean {
  return saveInFlight;
}

/**
 * Programmatic graph loads stay undirty while the live fingerprint matches.
 * Real edits change the fingerprint and clear the suppress mark.
 */
export function shouldSuppressDraftForFingerprint(
  suppressFingerprint: string | null,
  liveFingerprint: string,
): boolean {
  return suppressFingerprint !== null && suppressFingerprint === liveFingerprint;
}

/** Stable enough fingerprint for Flow nodes/edges draft suppress. */
export function flowGraphFingerprint(
  nodes: ReadonlyArray<{ id: string; type?: string; position?: unknown; data?: unknown }>,
  edges: ReadonlyArray<{ id: string; source: string; target: string }>,
): string {
  return JSON.stringify({
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? null,
      position: node.position ?? null,
      data: node.data ?? null,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  });
}

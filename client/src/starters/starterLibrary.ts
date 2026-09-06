import { domainGraphToFlow, type DomainGraph } from '@/persist/graphMapper';

import { SURF_N_TURF_GRAPH, SURF_N_TURF_KEY, SURF_N_TURF_NAME } from './surfNTurfGraph';

/** Catalog entry for a baked starter Patch (not owned by a User). */
export type StarterPatch = {
  key: string;
  name: string;
  graph: DomainGraph;
};

/** Saved Patch row owned by the signed-in User. */
export type UserPatchListItem = {
  id: string;
  name: string;
  version: number;
};

/** One row in the Patch Library list. */
export type PatchLibraryEntry =
  | { kind: 'starter'; key: string; name: string }
  | { kind: 'user'; id: string; name: string; version: number };

/** Working canvas snapshot after opening a starter (unsaved, Play stopped). */
export type StarterWorkingSnapshot = {
  activePatchId: null;
  activePatchName: string;
  patchVersion: number;
  isDirty: false;
  transportPlaying: false;
  nodes: ReturnType<typeof domainGraphToFlow>['nodes'];
  edges: ReturnType<typeof domainGraphToFlow>['edges'];
};

/** Baked starters shipped with the client. */
export function listStarterPatches(): StarterPatch[] {
  return [
    {
      key: SURF_N_TURF_KEY,
      name: SURF_N_TURF_NAME,
      graph: SURF_N_TURF_GRAPH,
    },
  ];
}

/**
 * Patch Library rows: starters always, then user Patches when signed in.
 * Pass null userPatches when nobody is signed in.
 */
export function buildPatchLibraryEntries(input: {
  starters: ReadonlyArray<Pick<StarterPatch, 'key' | 'name'>>;
  userPatches: ReadonlyArray<UserPatchListItem> | null;
}): PatchLibraryEntry[] {
  const starters: PatchLibraryEntry[] = input.starters.map((starter) => ({
    kind: 'starter' as const,
    key: starter.key,
    name: starter.name,
  }));
  if (input.userPatches === null) return starters;
  return [
    ...starters,
    ...input.userPatches.map((patch) => ({
      kind: 'user' as const,
      id: patch.id,
      name: patch.name,
      version: patch.version,
    })),
  ];
}

/** Patch Library is visible without a session. */
export function patchLibraryRequiresSignIn(): boolean {
  return false;
}

/** Open a starter as an unsaved working graph with Play stopped. */
export function starterWorkingSnapshot(starter: StarterPatch): StarterWorkingSnapshot {
  const flow = domainGraphToFlow(starter.graph);
  return {
    activePatchId: null,
    activePatchName: starter.name,
    patchVersion: 1,
    isDirty: false,
    transportPlaying: false,
    nodes: flow.nodes,
    edges: flow.edges,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { TRPCClientError } from '@trpc/client';

import {
  clearCanvasDraft,
  readCanvasDraft,
  writeCanvasDraft,
  type CanvasDraftEdge,
  type CanvasDraftNode,
  type CanvasDraftPayload,
} from '@/persist/canvasDraft';
import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';
import { decideSessionBootstrap } from '@/persist/sessionBootstrap';
import { domainGraphToFlow, flowToDomainGraph } from '@/persist/graphMapper';
import { trpc } from '@/trpc';

export type PersistStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

type UsePatchPersistArgs = {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((current: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((current: Edge[]) => Edge[])) => void;
};

function asDraftNodes(nodes: Node[]): CanvasDraftNode[] {
  return nodes as unknown as CanvasDraftNode[];
}

function asDraftEdges(edges: Edge[]): CanvasDraftEdge[] {
  return edges as unknown as CanvasDraftEdge[];
}

function asFlowNodes(nodes: ReadonlyArray<CanvasDraftNode>): Node[] {
  return nodes as unknown as Node[];
}

function asFlowEdges(edges: ReadonlyArray<CanvasDraftEdge>): Edge[] {
  return edges as unknown as Edge[];
}

export function usePatchPersist({ nodes, edges, setNodes, setEdges }: UsePatchPersistArgs) {
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [activePatchName, setActivePatchName] = useState(BLANK_PATCH_NAME);
  const [patchVersion, setPatchVersion] = useState(1);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authMode, setAuthMode] = useState('local');
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const versionRef = useRef(patchVersion);
  const patchIdRef = useRef(activePatchId);
  const patchNameRef = useRef(activePatchName);
  const userIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const ignoreNextGraphEffectRef = useRef(true);
  const draftBootstrappedRef = useRef(false);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setIsDirty(true);
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    versionRef.current = patchVersion;
    patchIdRef.current = activePatchId;
    patchNameRef.current = activePatchName;
  }, [nodes, edges, patchVersion, activePatchId, activePatchName]);

  const utils = trpc.useUtils();
  const listQuery = trpc.patch.list.useQuery(undefined, { enabled: sessionReady });
  const createMutation = trpc.patch.create.useMutation();
  const replaceMutation = trpc.patch.replaceGraph.useMutation();
  const deleteMutation = trpc.patch.delete.useMutation();
  const replaceMutateRef = useRef(replaceMutation.mutateAsync);
  const createMutateRef = useRef(createMutation.mutateAsync);
  const deleteMutateRef = useRef(deleteMutation.mutateAsync);
  const invalidateListRef = useRef(utils.patch.list.invalidate);
  const fetchPatchRef = useRef(utils.patch.get.fetch);

  useEffect(() => {
    replaceMutateRef.current = replaceMutation.mutateAsync;
    createMutateRef.current = createMutation.mutateAsync;
    deleteMutateRef.current = deleteMutation.mutateAsync;
    invalidateListRef.current = utils.patch.list.invalidate;
    fetchPatchRef.current = utils.patch.get.fetch;
  }, [
    replaceMutation.mutateAsync,
    createMutation.mutateAsync,
    deleteMutation.mutateAsync,
    utils.patch.list.invalidate,
    utils.patch.get.fetch,
  ]);

  const buildDraftPayload = useCallback((dirty: boolean): CanvasDraftPayload => {
    return {
      activePatchId: patchIdRef.current,
      activePatchName: patchNameRef.current,
      patchVersion: versionRef.current,
      isDirty: dirty,
      nodes: asDraftNodes(nodesRef.current),
      edges: asDraftEdges(edgesRef.current),
    };
  }, []);

  const flushDraft = useCallback(
    (dirty: boolean) => {
      writeCanvasDraft(userIdRef.current, buildDraftPayload(dirty));
    },
    [buildDraftPayload],
  );

  const applyDraft = useCallback(
    (draft: CanvasDraftPayload) => {
      ignoreNextGraphEffectRef.current = true;
      setActivePatchId(draft.activePatchId);
      setActivePatchName(draft.activePatchName);
      setPatchVersion(draft.patchVersion);
      if (draft.isDirty) {
        markDirty();
      } else {
        markClean();
      }
      setNodes(asFlowNodes(draft.nodes));
      setEdges(asFlowEdges(draft.edges));
      if (draft.activePatchId && !draft.isDirty) {
        setPersistStatus('saved');
      } else {
        setPersistStatus('idle');
      }
    },
    [markClean, markDirty, setEdges, setNodes],
  );

  const restoreDraftForUser = useCallback(
    (userId: string | null) => {
      const draft = readCanvasDraft(userId);
      if (draft) {
        applyDraft(draft);
      }
    },
    [applyDraft],
  );

  useEffect(() => {
    void (async () => {
      try {
        const sessionResponse = await fetch('/api/auth/session', { credentials: 'include' });
        if (!sessionResponse.ok) {
          try {
            const healthResponse = await fetch('/api/health');
            if (healthResponse.ok) {
              const healthBody = (await healthResponse.json()) as { authMode?: string };
              if (healthBody.authMode) setAuthMode(healthBody.authMode);
            }
          } catch {
            // Keep prior authMode.
          }
          userIdRef.current = null;
          setSessionReady(false);
          if (!draftBootstrappedRef.current) {
            draftBootstrappedRef.current = true;
            restoreDraftForUser(null);
          }
          return;
        }
        const sessionBody = (await sessionResponse.json()) as {
          user?: { id?: string } | null;
          authMode?: string;
        };
        const mode = sessionBody.authMode ?? 'local';
        setAuthMode(mode);
        const decision = decideSessionBootstrap({
          user: sessionBody.user,
          authMode: mode,
        });
        if (decision === 'ready') {
          const userId = sessionBody.user?.id ?? null;
          userIdRef.current = userId;
          setSessionReady(true);
          if (!draftBootstrappedRef.current) {
            draftBootstrappedRef.current = true;
            restoreDraftForUser(userId);
          }
          return;
        }
        if (decision === 'needsLocalPost') {
          const localResponse = await fetch('/api/auth/local', {
            method: 'POST',
            credentials: 'include',
          });
          if (!localResponse.ok) {
            userIdRef.current = null;
            setSessionReady(false);
            if (!draftBootstrappedRef.current) {
              draftBootstrappedRef.current = true;
              restoreDraftForUser(null);
            }
            return;
          }
          const localBody = (await localResponse.json()) as {
            user?: { id?: string } | null;
          };
          const userId = localBody.user?.id ?? null;
          userIdRef.current = userId;
          setSessionReady(true);
          if (!draftBootstrappedRef.current) {
            draftBootstrappedRef.current = true;
            restoreDraftForUser(userId);
          }
          return;
        }
        userIdRef.current = null;
        setSessionReady(false);
        if (!draftBootstrappedRef.current) {
          draftBootstrappedRef.current = true;
          restoreDraftForUser(null);
        }
      } catch {
        userIdRef.current = null;
        setSessionReady(false);
        if (!draftBootstrappedRef.current) {
          draftBootstrappedRef.current = true;
          restoreDraftForUser(null);
        }
      }
    })();
  }, [restoreDraftForUser]);

  const saveNow = useCallback(async () => {
    const patchId = patchIdRef.current;
    if (!patchId) return;
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setPersistStatus('saving');
    const graph = flowToDomainGraph(patchId, nodesRef.current, edgesRef.current);
    try {
      const result = await replaceMutateRef.current({
        id: patchId,
        expectedVersion: versionRef.current,
        connectors: graph.connectors,
        modulators: graph.modulators,
        oscillators: graph.oscillators,
        effects: graph.effects,
        wires: graph.wires,
      });
      setPatchVersion(Number(result.version));
      versionRef.current = Number(result.version);
      markClean();
      flushDraft(false);
      setPersistStatus('saved');
      await invalidateListRef.current();
    } catch (error) {
      if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
        setPersistStatus('conflict');
      } else {
        setPersistStatus('error');
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }, [flushDraft, markClean]);

  const scheduleDraftPersist = useCallback(() => {
    if (ignoreNextGraphEffectRef.current) {
      ignoreNextGraphEffectRef.current = false;
      return;
    }
    markDirty();
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      flushDraft(true);
    }, 400);
  }, [flushDraft, markDirty]);

  const createPatch = useCallback(
    async (name: string) => {
      const created = await createMutateRef.current({ name });
      setActivePatchId(created.id);
      setActivePatchName(created.name);
      patchIdRef.current = created.id;
      patchNameRef.current = created.name;
      setPatchVersion(Number(created.version));
      versionRef.current = Number(created.version);
      const graph = flowToDomainGraph(created.id, nodesRef.current, edgesRef.current);
      const saved = await replaceMutateRef.current({
        id: created.id,
        expectedVersion: Number(created.version),
        connectors: graph.connectors,
        modulators: graph.modulators,
        oscillators: graph.oscillators,
        effects: graph.effects,
        wires: graph.wires,
      });
      setPatchVersion(Number(saved.version));
      versionRef.current = Number(saved.version);
      markClean();
      ignoreNextGraphEffectRef.current = true;
      flushDraft(false);
      setPersistStatus('saved');
      await invalidateListRef.current();
      return created;
    },
    [flushDraft, markClean],
  );

  const loadPatch = useCallback(
    async (id: string) => {
      const patch = await fetchPatchRef.current({ id });
      setActivePatchId(patch.id);
      setActivePatchName(patch.name);
      setPatchVersion(Number(patch.version));
      const { nodes: nextNodes, edges: nextEdges } = domainGraphToFlow({
        connectors: patch.connectors,
        modulators: patch.modulators,
        oscillators: patch.oscillators,
        effects: patch.effects ?? [],
        wires: patch.wires,
      });
      ignoreNextGraphEffectRef.current = true;
      markClean();
      setNodes(nextNodes);
      setEdges(nextEdges);
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      patchIdRef.current = patch.id;
      patchNameRef.current = patch.name;
      versionRef.current = Number(patch.version);
      flushDraft(false);
      setPersistStatus('saved');
    },
    [flushDraft, markClean, setEdges, setNodes],
  );

  const newBlankPatch = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    setActivePatchId(null);
    setActivePatchName(BLANK_PATCH_NAME);
    setPatchVersion(1);
    patchIdRef.current = null;
    patchNameRef.current = BLANK_PATCH_NAME;
    versionRef.current = 1;
    ignoreNextGraphEffectRef.current = true;
    markClean();
    setNodes([]);
    setEdges([]);
    nodesRef.current = [];
    edgesRef.current = [];
    clearCanvasDraft(userIdRef.current);
    setPersistStatus('idle');
  }, [markClean, setEdges, setNodes]);

  const blankForSignOut = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    // Keep stored draft for this user; only blank the live canvas.
    const retainedUserId = userIdRef.current;
    if (dirtyRef.current) {
      flushDraft(true);
    }
    setActivePatchId(null);
    setActivePatchName(BLANK_PATCH_NAME);
    setPatchVersion(1);
    patchIdRef.current = null;
    patchNameRef.current = BLANK_PATCH_NAME;
    versionRef.current = 1;
    ignoreNextGraphEffectRef.current = true;
    markClean();
    setNodes([]);
    setEdges([]);
    nodesRef.current = [];
    edgesRef.current = [];
    userIdRef.current = null;
    setSessionReady(false);
    setPersistStatus('idle');
    void retainedUserId;
  }, [flushDraft, markClean, setEdges, setNodes]);

  const deletePatch = useCallback(
    async (id: string, expectedVersion: number) => {
      const wasActive = patchIdRef.current === id;
      await deleteMutateRef.current({ id, expectedVersion });
      await invalidateListRef.current();
      if (wasActive) {
        newBlankPatch();
      }
      return { wasActive };
    },
    [newBlankPatch],
  );

  const resolveConflictByReload = useCallback(async () => {
    const patchId = patchIdRef.current;
    if (!patchId) return;
    await loadPatch(patchId);
  }, [loadPatch]);

  return {
    sessionReady,
    authMode,
    patches: listQuery.data ?? [],
    activePatchId,
    activePatchName,
    patchVersion,
    persistStatus,
    isDirty,
    saveNow,
    scheduleDraftPersist,
    createPatch,
    loadPatch,
    newBlankPatch,
    blankForSignOut,
    deletePatch,
    resolveConflictByReload,
    isLoadingList: listQuery.isLoading,
  };
}

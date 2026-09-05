import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { TRPCClientError } from '@trpc/client';

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

type SaveReason = 'manual' | 'auto';

export function usePatchPersist({ nodes, edges, setNodes, setEdges }: UsePatchPersistArgs) {
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [activePatchName, setActivePatchName] = useState(BLANK_PATCH_NAME);
  const [patchVersion, setPatchVersion] = useState(1);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authMode, setAuthMode] = useState('local');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const versionRef = useRef(patchVersion);
  const patchIdRef = useRef(activePatchId);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const ignoreNextGraphEffectRef = useRef(true);

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
  }, [nodes, edges, patchVersion, activePatchId]);

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
          setSessionReady(false);
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
          setSessionReady(true);
          return;
        }
        if (decision === 'needsLocalPost') {
          const localResponse = await fetch('/api/auth/local', {
            method: 'POST',
            credentials: 'include',
          });
          if (!localResponse.ok) {
            setSessionReady(false);
            return;
          }
          setSessionReady(true);
          return;
        }
        setSessionReady(false);
      } catch {
        setSessionReady(false);
      }
    })();
  }, []);

  const saveNow = useCallback(async (reason: SaveReason = 'manual') => {
    const patchId = patchIdRef.current;
    if (!patchId) return;
    if (reason === 'auto' && !dirtyRef.current) return;
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
      markClean();
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
  }, [markClean]);

  const scheduleAutosave = useCallback(() => {
    if (ignoreNextGraphEffectRef.current) {
      ignoreNextGraphEffectRef.current = false;
      markClean();
      return;
    }
    markDirty();
    if (!patchIdRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow('auto');
    }, 1200);
  }, [markClean, markDirty, saveNow]);

  const createPatch = useCallback(
    async (name: string) => {
      const created = await createMutateRef.current({ name });
      setActivePatchId(created.id);
      setActivePatchName(created.name);
      setPatchVersion(Number(created.version));
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
      markClean();
      ignoreNextGraphEffectRef.current = true;
      setPersistStatus('saved');
      await invalidateListRef.current();
      return created;
    },
    [markClean],
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
      setPersistStatus('saved');
    },
    [markClean, setEdges, setNodes],
  );

  const newBlankPatch = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setActivePatchId(null);
    setActivePatchName(BLANK_PATCH_NAME);
    setPatchVersion(1);
    ignoreNextGraphEffectRef.current = true;
    markClean();
    setNodes([]);
    setEdges([]);
    setPersistStatus('idle');
  }, [markClean, setEdges, setNodes]);

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
    saveNow: () => saveNow('manual'),
    scheduleAutosave,
    createPatch,
    loadPatch,
    newBlankPatch,
    deletePatch,
    resolveConflictByReload,
    isLoadingList: listQuery.isLoading,
  };
}

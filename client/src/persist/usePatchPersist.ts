import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { TRPCClientError } from '@trpc/client';

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

export function usePatchPersist({ nodes, edges, setNodes, setEdges }: UsePatchPersistArgs) {
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [activePatchName, setActivePatchName] = useState('Untitled Patch');
  const [patchVersion, setPatchVersion] = useState(1);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('idle');
  const [sessionReady, setSessionReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const versionRef = useRef(patchVersion);
  const patchIdRef = useRef(activePatchId);

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

  useEffect(() => {
    void (async () => {
      try {
        const sessionResponse = await fetch('/api/auth/session', { credentials: 'include' });
        if (!sessionResponse.ok) {
          setSessionReady(false);
          return;
        }
        const sessionBody = (await sessionResponse.json()) as {
          user?: { id?: string } | null;
          authMode?: string;
        };
        const decision = decideSessionBootstrap({
          user: sessionBody.user,
          authMode: sessionBody.authMode ?? 'local',
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

  const saveNow = useCallback(async () => {
    const patchId = patchIdRef.current;
    if (!patchId) return;
    setPersistStatus('saving');
    const graph = flowToDomainGraph(patchId, nodesRef.current, edgesRef.current);
    try {
      const result = await replaceMutation.mutateAsync({
        id: patchId,
        expectedVersion: versionRef.current,
        connectors: graph.connectors,
        modulators: graph.modulators,
        oscillators: graph.oscillators,
        wires: graph.wires,
      });
      setPatchVersion(Number(result.version));
      setPersistStatus('saved');
      await utils.patch.list.invalidate();
    } catch (error) {
      if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
        setPersistStatus('conflict');
      } else {
        setPersistStatus('error');
      }
    }
  }, [replaceMutation, utils.patch.list]);

  const scheduleAutosave = useCallback(() => {
    if (!patchIdRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow();
    }, 1200);
  }, [saveNow]);

  const createPatch = useCallback(
    async (name: string) => {
      const created = await createMutation.mutateAsync({ name });
      setActivePatchId(created.id);
      setActivePatchName(created.name);
      setPatchVersion(Number(created.version));
      const graph = flowToDomainGraph(created.id, nodesRef.current, edgesRef.current);
      const saved = await replaceMutation.mutateAsync({
        id: created.id,
        expectedVersion: Number(created.version),
        connectors: graph.connectors,
        modulators: graph.modulators,
        oscillators: graph.oscillators,
        wires: graph.wires,
      });
      setPatchVersion(Number(saved.version));
      setPersistStatus('saved');
      await utils.patch.list.invalidate();
      return created;
    },
    [createMutation, replaceMutation, utils.patch.list],
  );

  const loadPatch = useCallback(
    async (id: string) => {
      const patch = await utils.patch.get.fetch({ id });
      setActivePatchId(patch.id);
      setActivePatchName(patch.name);
      setPatchVersion(Number(patch.version));
      const { nodes: nextNodes, edges: nextEdges } = domainGraphToFlow({
        connectors: patch.connectors,
        modulators: patch.modulators,
        oscillators: patch.oscillators,
        wires: patch.wires,
      });
      setNodes(nextNodes);
      setEdges(nextEdges);
      setPersistStatus('saved');
    },
    [setEdges, setNodes, utils.patch.get],
  );

  const resolveConflictByReload = useCallback(async () => {
    const patchId = patchIdRef.current;
    if (!patchId) return;
    await loadPatch(patchId);
  }, [loadPatch]);

  return {
    sessionReady,
    patches: listQuery.data ?? [],
    activePatchId,
    activePatchName,
    patchVersion,
    persistStatus,
    saveNow,
    scheduleAutosave,
    createPatch,
    loadPatch,
    resolveConflictByReload,
    isLoadingList: listQuery.isLoading,
  };
}

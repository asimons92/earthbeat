import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type OnConnect,
  type OnSelectionChangeFunc,
} from '@xyflow/react';

import { buildConnectorNode } from '@/catalog/buildConnectorNode';
import { buildEffectNode } from '@/catalog/buildEffectNode';
import {
  autofillModulatorChannel,
  autofillModulatorTarget,
  blankModulatorData,
  modulatorMappingFromUnknown,
  type ModulatorChannelOption,
  type ModulatorTargetOption,
} from '@/catalog/modulatorMapping';
import { formatOscillatorHzStatus } from '@/catalog/oscillatorHz';
import { oscillatorLabel } from '@/catalog/oscillatorLabel';
import {
  connectorKindsByKey,
  effectKindsByKey,
  modulatableChannelsForKind,
  oscillatorDefaults,
  oscillatorModulatableParams,
  oscillatorWaveforms,
} from '@/generated/catalog';
import { usePatchPersist } from '@/persist/usePatchPersist';
import { usePatchRuntime } from '@/runtime/usePatchRuntime';
import { type ConnectorFlowNode } from '@/nodes/ConnectorNode';
import { type EffectFlowNode } from '@/nodes/EffectNode';
import { type ModulatorFlowNode } from '@/nodes/ModulatorNode';
import { type OscillatorFlowNode } from '@/nodes/OscillatorNode';
import { audioFxIssueLabelsByNodeId } from '@/runtime/audioFxChain';
import { toRuntimeEdges, toRuntimeNodes } from '@/runtime/runtimeNodes';

import { isValidPatchConnection } from './isValidPatchConnection';

function nextOffset(count: number) {
  return { x: 60 + (count % 5) * 36, y: 60 + (count % 5) * 36 };
}

function channelOptionsForKind(kindKey: string): ModulatorChannelOption[] {
  return modulatableChannelsForKind(kindKey).map((channel) => ({
    key: channel.key,
    label: channel.label,
    min: channel.min,
    max: channel.max,
    ...('mapHintMin' in channel ? { mapHintMin: Number(channel.mapHintMin) } : {}),
    ...('mapHintMax' in channel ? { mapHintMax: Number(channel.mapHintMax) } : {}),
  }));
}

const targetOptions: ModulatorTargetOption[] = oscillatorModulatableParams.map((param) => ({
  key: param.key,
  label: param.label,
  modulationOutMin: param.modulationOutMin,
  modulationOutMax: param.modulationOutMax,
  modulationKind: param.modulationKind,
}));

function walkDownstreamOscillator(
  startId: string,
  nodes: Node[],
  edges: Edge[],
): Node | null {
  let cursor = startId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(cursor)) return null;
    visited.add(cursor);
    const outbound = edges.find((edge) => edge.source === cursor);
    if (!outbound) return null;
    const next = nodes.find((entry) => entry.id === outbound.target);
    if (!next) return null;
    if (next.type === 'oscillator') return next;
    if (next.type === 'effect') {
      cursor = next.id;
      continue;
    }
    return null;
  }
}

function applyModulatorAutofills(nodes: Node[], edges: Edge[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'modulator') return node;
    let data = modulatorMappingFromUnknown(node.data as Record<string, unknown>);
    const inbound = edges.find((edge) => edge.target === node.id);
    const upstream = inbound
      ? nodes.find((entry) => entry.id === inbound.source)
      : undefined;
    const channels =
      upstream?.type === 'connector'
        ? channelOptionsForKind(String(upstream.data.kindKey ?? ''))
        : [];
    if (channels.length > 0) {
      data = autofillModulatorChannel(data, channels, targetOptions);
    }
    if (walkDownstreamOscillator(node.id, nodes, edges)) {
      data = autofillModulatorTarget(data, targetOptions, channels);
    }
    return { ...node, data };
  });
}

type PatchWorkspaceValue = {
  nodes: Node[];
  edges: Edge[];
  flowNodes: Node[];
  selectedNodeId: string | null;
  onNodesChange: (changes: Parameters<ReturnType<typeof useNodesState>[2]>[0]) => void;
  onEdgesChange: (changes: Parameters<ReturnType<typeof useEdgesState>[2]>[0]) => void;
  onConnect: OnConnect;
  isValidConnection: (connection: Parameters<typeof isValidPatchConnection>[0]) => boolean;
  onSelectionChange: OnSelectionChangeFunc;
  onChangeNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  addConnector: (kindKey: string) => boolean;
  addEffect: (kindKey: string) => boolean;
  addModulator: () => void;
  addOscillator: () => void;
  removeNode: (nodeId: string) => void;
  sessionReady: boolean;
  authMode: string;
  patches: ReturnType<typeof usePatchPersist>['patches'];
  activePatchId: string | null;
  activePatchName: string;
  persistStatus: ReturnType<typeof usePatchPersist>['persistStatus'];
  isDirty: boolean;
  saveNow: () => Promise<void>;
  createPatch: ReturnType<typeof usePatchPersist>['createPatch'];
  loadPatch: (id: string) => Promise<void>;
  loadStarter: (key?: string) => void;
  newBlankPatch: () => void;
  blankForSignOut: () => void;
  deletePatch: (id: string, expectedVersion: number) => Promise<{ wasActive: boolean }>;
  resolveConflictByReload: () => Promise<void>;
  draftReady: boolean;
  shareVisit: ReturnType<typeof usePatchPersist>['shareVisit'];
  shareRouteHold: boolean;
  shareMissing: boolean;
  graphLocked: boolean;
  enterSharedPatch: ReturnType<typeof usePatchPersist>['enterSharedPatch'];
  failSharedPatch: () => void;
  leaveSharedPatch: () => void;
  publishShare: ReturnType<typeof usePatchPersist>['publishShare'];
  revokeShare: ReturnType<typeof usePatchPersist>['revokeShare'];
  saveSharedCopy: ReturnType<typeof usePatchPersist>['saveSharedCopy'];
  releaseShareRouteHold: () => void;
  reportShareMissing: (missing: boolean) => void;
  liveStatus: ReturnType<typeof usePatchRuntime>['liveStatus'];
  lastSample: ReturnType<typeof usePatchRuntime>['lastSample'];
  lastSamplesByKind: ReturnType<typeof usePatchRuntime>['lastSamplesByKind'];
  monitorStrips: ReturnType<typeof usePatchRuntime>['monitorStrips'];
  sampleHistoryByStripId: ReturnType<typeof usePatchRuntime>['sampleHistoryByStripId'];
  playStartedAtMs: ReturnType<typeof usePatchRuntime>['playStartedAtMs'];
  isPlaying: ReturnType<typeof usePatchRuntime>['isPlaying'];
  getTimeDomainSnapshot: ReturnType<typeof usePatchRuntime>['getTimeDomainSnapshot'];
  playAllOscillators: () => void;
  stopAllOscillators: () => void;
};

const PatchWorkspaceContext = createContext<PatchWorkspaceValue | null>(null);

export function PatchWorkspaceProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const persist = usePatchPersist({ nodes, edges, setNodes, setEdges });
  const graphLocked = persist.graphLocked;
  const {
    scheduleDraftPersist,
    loadPatch: persistLoadPatch,
    loadStarter: persistLoadStarter,
    newBlankPatch: persistNewBlankPatch,
    blankForSignOut: persistBlankForSignOut,
    deletePatch: persistDeletePatch,
    resolveConflictByReload: persistResolveConflictByReload,
  } = persist;

  const {
    liveStatus,
    lastSample,
    lastSamplesByKind,
    monitorStrips,
    sampleHistoryByStripId,
    playStartedAtMs,
    isPlaying,
    getTimeDomainSnapshot,
    playOscillator,
    stopOscillator,
    playAllOscillators,
    stopAllOscillators,
    resetTransportForPatchLoad,
    isOscillatorPlaying,
  } = usePatchRuntime(nodes, edges);

  const loadPatch = useCallback(
    async (id: string) => {
      resetTransportForPatchLoad();
      await persistLoadPatch(id);
    },
    [persistLoadPatch, resetTransportForPatchLoad],
  );

  const loadStarter = useCallback(
    (key?: string) => {
      resetTransportForPatchLoad();
      persistLoadStarter(key);
    },
    [persistLoadStarter, resetTransportForPatchLoad],
  );

  const newBlankPatch = useCallback(() => {
    resetTransportForPatchLoad();
    persistNewBlankPatch();
  }, [persistNewBlankPatch, resetTransportForPatchLoad]);

  const blankForSignOut = useCallback(() => {
    resetTransportForPatchLoad();
    persistBlankForSignOut();
  }, [persistBlankForSignOut, resetTransportForPatchLoad]);

  const deletePatch = useCallback(
    async (id: string, expectedVersion: number) => {
      if (persist.activePatchId === id) {
        resetTransportForPatchLoad();
      }
      return persistDeletePatch(id, expectedVersion);
    },
    [persist.activePatchId, persistDeletePatch, resetTransportForPatchLoad],
  );

  const resolveConflictByReload = useCallback(async () => {
    resetTransportForPatchLoad();
    await persistResolveConflictByReload();
  }, [persistResolveConflictByReload, resetTransportForPatchLoad]);

  useEffect(() => {
    scheduleDraftPersist();
  }, [nodes, edges, scheduleDraftPersist]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      if (!graphLocked) {
        onNodesChangeBase(changes);
        return;
      }
      const selection = changes.filter((change) => change.type === 'select');
      if (selection.length > 0) onNodesChangeBase(selection);
    },
    [graphLocked, onNodesChangeBase],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      if (!graphLocked) {
        onEdgesChangeBase(changes);
        return;
      }
      const selection = changes.filter((change) => change.type === 'select');
      if (selection.length > 0) onEdgesChangeBase(selection);
    },
    [graphLocked, onEdgesChangeBase],
  );

  const onToggleOscillatorPlay = useCallback(
    (nodeId: string) => {
      if (isOscillatorPlaying(nodeId)) {
        stopOscillator(nodeId);
      } else {
        playOscillator(nodeId);
      }
    },
    [isOscillatorPlaying, playOscillator, stopOscillator],
  );

  const audioFxIssueLabels = useMemo(
    () => audioFxIssueLabelsByNodeId(toRuntimeNodes(nodes), toRuntimeEdges(edges)),
    [edges, nodes],
  );

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => {
        const issueStatus = audioFxIssueLabels.get(node.id);
        if (node.type === 'oscillator') {
          return {
            ...node,
            data: {
              ...node.data,
              ...(issueStatus ? { status: issueStatus } : {}),
              playing: isOscillatorPlaying(node.id),
              onTogglePlay: onToggleOscillatorPlay,
            },
          };
        }
        if (issueStatus && node.type === 'effect') {
          return {
            ...node,
            data: {
              ...node.data,
              status: issueStatus,
            },
          };
        }
        return node;
      }),
    [audioFxIssueLabels, isOscillatorPlaying, nodes, onToggleOscillatorPlay],
  );

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (graphLocked) return;
      setEdges((currentEdges) => {
        const nextEdges = addEdge(connection, currentEdges);
        setNodes((currentNodes) => applyModulatorAutofills(currentNodes, nextEdges));
        return nextEdges;
      });
    },
    [graphLocked, setEdges, setNodes],
  );

  const isValidConnection = useCallback(
    (connection: Parameters<typeof isValidPatchConnection>[0]) =>
      isValidPatchConnection(connection, nodes, edges),
    [nodes, edges],
  );

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes }) => {
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
  }, []);

  const onChangeNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      if (graphLocked) return;
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, data } : node)),
      );
    },
    [graphLocked, setNodes],
  );

  const addOscillator = useCallback(() => {
    if (graphLocked) return;
    setNodes((current) => {
      const index = current.filter((node) => node.type === 'oscillator').length;
      const position = nextOffset(current.length);
      const node: OscillatorFlowNode = {
        id: `oscillator-${crypto.randomUUID()}`,
        type: 'oscillator',
        position,
        data: {
          label: oscillatorLabel(oscillatorDefaults.waveform, oscillatorWaveforms, index),
          waveform: oscillatorDefaults.waveform,
          frequencyHz: oscillatorDefaults.frequencyHz,
          gain: oscillatorDefaults.gain,
          status: formatOscillatorHzStatus(oscillatorDefaults.frequencyHz),
        },
      };
      return [...current, node];
    });
  }, [graphLocked, setNodes]);

  const addModulator = useCallback(() => {
    if (graphLocked) return;
    setNodes((current) => {
      const index = current.filter((node) => node.type === 'modulator').length;
      const position = nextOffset(current.length);
      const node: ModulatorFlowNode = {
        id: `modulator-${crypto.randomUUID()}`,
        type: 'modulator',
        position,
        data: blankModulatorData(index),
      };
      return [...current, node];
    });
  }, [graphLocked, setNodes]);

  const addConnector = useCallback(
    (kindKey: string) => {
      if (graphLocked) return false;
      if (!(kindKey in connectorKindsByKey)) return false;
      setNodes((current) => {
        const index = current.filter((node) => node.type === 'connector').length;
        const draft = buildConnectorNode({
          kindKey,
          kindsByKey: connectorKindsByKey,
          existingConnectorCount: index,
          position: nextOffset(current.length),
          newId: `connector-${crypto.randomUUID()}`,
        });
        if (!draft) return current;
        const node: ConnectorFlowNode = draft;
        return [...current, node];
      });
      return true;
    },
    [graphLocked, setNodes],
  );

  const addEffect = useCallback(
    (kindKey: string) => {
      if (graphLocked) return false;
      if (!(kindKey in effectKindsByKey)) return false;
      setNodes((current) => {
        const index = current.filter((node) => node.type === 'effect').length;
        const draft = buildEffectNode({
          kindKey,
          kindsByKey: effectKindsByKey,
          existingEffectCount: index,
          position: nextOffset(current.length),
          newId: `effect-${crypto.randomUUID()}`,
        });
        if (!draft) return current;
        const node: EffectFlowNode = draft;
        return [...current, node];
      });
      return true;
    },
    [graphLocked, setNodes],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      if (graphLocked) return;
      const removeIds = new Set([nodeId]);
      setNodes((current) => current.filter((node) => !removeIds.has(node.id)));
      setEdges((current) =>
        current.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target)),
      );
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [graphLocked, setEdges, setNodes],
  );

  const value = useMemo<PatchWorkspaceValue>(
    () => ({
      nodes,
      edges,
      flowNodes,
      selectedNodeId,
      onNodesChange,
      onEdgesChange,
      onConnect,
      isValidConnection,
      onSelectionChange,
      onChangeNodeData,
      addConnector,
      addEffect,
      addModulator,
      addOscillator,
      removeNode,
      sessionReady: persist.sessionReady,
      authMode: persist.authMode,
      patches: persist.patches,
      activePatchId: persist.activePatchId,
      activePatchName: persist.activePatchName,
      persistStatus: persist.persistStatus,
      isDirty: persist.isDirty,
      saveNow: persist.saveNow,
      createPatch: persist.createPatch,
      loadPatch,
      loadStarter,
      newBlankPatch,
      blankForSignOut,
      deletePatch,
      resolveConflictByReload,
      draftReady: persist.draftReady,
      shareVisit: persist.shareVisit,
      shareRouteHold: persist.shareRouteHold,
      shareMissing: persist.shareMissing,
      graphLocked: persist.graphLocked,
      enterSharedPatch: persist.enterSharedPatch,
      failSharedPatch: persist.failSharedPatch,
      leaveSharedPatch: persist.leaveSharedPatch,
      publishShare: persist.publishShare,
      revokeShare: persist.revokeShare,
      saveSharedCopy: persist.saveSharedCopy,
      releaseShareRouteHold: persist.releaseShareRouteHold,
      reportShareMissing: persist.reportShareMissing,
      liveStatus,
      lastSample,
      lastSamplesByKind,
      monitorStrips,
      sampleHistoryByStripId,
      playStartedAtMs,
      isPlaying,
      getTimeDomainSnapshot,
      playAllOscillators,
      stopAllOscillators,
    }),
    [
      nodes,
      edges,
      flowNodes,
      selectedNodeId,
      onNodesChange,
      onEdgesChange,
      onConnect,
      isValidConnection,
      onSelectionChange,
      onChangeNodeData,
      addConnector,
      addEffect,
      addModulator,
      addOscillator,
      removeNode,
      persist.sessionReady,
      persist.authMode,
      persist.patches,
      persist.activePatchId,
      persist.activePatchName,
      persist.persistStatus,
      persist.isDirty,
      persist.saveNow,
      persist.createPatch,
      loadPatch,
      loadStarter,
      newBlankPatch,
      blankForSignOut,
      deletePatch,
      resolveConflictByReload,
      persist.draftReady,
      persist.shareVisit,
      persist.shareRouteHold,
      persist.shareMissing,
      persist.graphLocked,
      persist.enterSharedPatch,
      persist.failSharedPatch,
      persist.leaveSharedPatch,
      persist.publishShare,
      persist.revokeShare,
      persist.saveSharedCopy,
      persist.releaseShareRouteHold,
      persist.reportShareMissing,
      liveStatus,
      lastSample,
      lastSamplesByKind,
      monitorStrips,
      sampleHistoryByStripId,
      playStartedAtMs,
      isPlaying,
      getTimeDomainSnapshot,
      playAllOscillators,
      stopAllOscillators,
    ],
  );

  return (
    <PatchWorkspaceContext.Provider value={value}>{children}</PatchWorkspaceContext.Provider>
  );
}

export function usePatchWorkspace() {
  const ctx = useContext(PatchWorkspaceContext);
  if (!ctx) {
    throw new Error('usePatchWorkspace must be used inside PatchWorkspaceProvider');
  }
  return ctx;
}

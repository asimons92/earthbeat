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
  connectorKindsByKey,
  effectKindsByKey,
  modulatorDefaults,
  oscillatorDefaults,
  usgsConnector,
} from '@/generated/catalog';

const noaaConnector = connectorKindsByKey.noaa_coops_tides;
const noaaWaterChannel =
  noaaConnector.channels.find((channel) => channel.key === 'waterLevel') ??
  noaaConnector.channels[0]!;
const noaaInMin =
  'mapHintMin' in noaaWaterChannel && typeof noaaWaterChannel.mapHintMin === 'number'
    ? noaaWaterChannel.mapHintMin
    : 'min' in noaaWaterChannel && typeof noaaWaterChannel.min === 'number'
      ? noaaWaterChannel.min
      : -1;
const noaaInMax =
  'mapHintMax' in noaaWaterChannel && typeof noaaWaterChannel.mapHintMax === 'number'
    ? noaaWaterChannel.mapHintMax
    : 'max' in noaaWaterChannel && typeof noaaWaterChannel.max === 'number'
      ? noaaWaterChannel.max
      : 3;
import { usePatchPersist } from '@/persist/usePatchPersist';
import { usePatchRuntime } from '@/runtime/usePatchRuntime';
import { type ConnectorFlowNode } from '@/nodes/ConnectorNode';
import { type EffectFlowNode } from '@/nodes/EffectNode';
import { type ModulatorFlowNode } from '@/nodes/ModulatorNode';
import { type OscillatorFlowNode } from '@/nodes/OscillatorNode';

const initialNodes: Node[] = [
  {
    id: 'connector-usgs',
    type: 'connector',
    position: { x: 40, y: 100 },
    data: {
      label: usgsConnector.label,
      kindKey: usgsConnector.key,
      status: 'M —',
    },
  },
  {
    id: 'modulator-mag-freq',
    type: 'modulator',
    position: { x: 280, y: 100 },
    data: {
      label: 'Magnitude → Frequency',
      channelKey: modulatorDefaults.channelKey,
      targetParam: modulatorDefaults.targetParam,
      inMin: modulatorDefaults.inMin,
      inMax: modulatorDefaults.inMax,
      outMin: modulatorDefaults.outMin,
      outMax: modulatorDefaults.outMax,
      status: `${modulatorDefaults.inMin}–${modulatorDefaults.inMax} → ${modulatorDefaults.outMin}–${modulatorDefaults.outMax}`,
    },
  },
  {
    id: 'oscillator-sine',
    type: 'oscillator',
    position: { x: 540, y: 100 },
    data: {
      label: 'Sine Tone',
      waveform: oscillatorDefaults.waveform,
      frequencyHz: oscillatorDefaults.frequencyHz,
      gain: oscillatorDefaults.gain,
      status: `${oscillatorDefaults.frequencyHz} Hz`,
    },
  },
  {
    id: 'connector-noaa',
    type: 'connector',
    position: { x: 40, y: 280 },
    data: {
      label: noaaConnector.label,
      kindKey: noaaConnector.key,
      status: 'WL —',
      interpolate: true,
    },
  },
  {
    id: 'modulator-tide-freq',
    type: 'modulator',
    position: { x: 280, y: 280 },
    data: {
      label: 'Water level → Frequency',
      channelKey: noaaWaterChannel.key,
      targetParam: modulatorDefaults.targetParam,
      inMin: noaaInMin,
      inMax: noaaInMax,
      outMin: modulatorDefaults.outMin,
      outMax: modulatorDefaults.outMax,
      status: `${noaaInMin}–${noaaInMax} → ${modulatorDefaults.outMin}–${modulatorDefaults.outMax}`,
    },
  },
  {
    id: 'oscillator-tide',
    type: 'oscillator',
    position: { x: 540, y: 280 },
    data: {
      label: 'Tide Sine',
      waveform: oscillatorDefaults.waveform,
      frequencyHz: oscillatorDefaults.frequencyHz,
      gain: oscillatorDefaults.gain,
      status: `${oscillatorDefaults.frequencyHz} Hz`,
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'wire-connector-modulator',
    source: 'connector-usgs',
    target: 'modulator-mag-freq',
    sourceHandle: 'out',
    targetHandle: 'in',
  },
  {
    id: 'wire-modulator-oscillator',
    source: 'modulator-mag-freq',
    target: 'oscillator-sine',
    sourceHandle: 'out',
    targetHandle: 'in',
  },
  {
    id: 'wire-noaa-modulator',
    source: 'connector-noaa',
    target: 'modulator-tide-freq',
    sourceHandle: 'out',
    targetHandle: 'in',
  },
  {
    id: 'wire-tide-modulator-oscillator',
    source: 'modulator-tide-freq',
    target: 'oscillator-tide',
    sourceHandle: 'out',
    targetHandle: 'in',
  },
];

function nextOffset(count: number) {
  return { x: 60 + (count % 5) * 36, y: 60 + (count % 5) * 36 };
}

type PatchWorkspaceValue = {
  nodes: Node[];
  edges: Edge[];
  flowNodes: Node[];
  selectedNodeId: string | null;
  onNodesChange: (changes: Parameters<ReturnType<typeof useNodesState>[2]>[0]) => void;
  onEdgesChange: (changes: Parameters<ReturnType<typeof useEdgesState>[2]>[0]) => void;
  onConnect: OnConnect;
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
  newBlankPatch: () => void;
  deletePatch: (id: string, expectedVersion: number) => Promise<{ wasActive: boolean }>;
  resolveConflictByReload: () => Promise<void>;
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
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const persist = usePatchPersist({ nodes, edges, setNodes, setEdges });
  const {
    scheduleAutosave,
    loadPatch: persistLoadPatch,
    newBlankPatch: persistNewBlankPatch,
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

  const newBlankPatch = useCallback(() => {
    resetTransportForPatchLoad();
    persistNewBlankPatch();
  }, [persistNewBlankPatch, resetTransportForPatchLoad]);

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
    scheduleAutosave();
  }, [nodes, edges, scheduleAutosave]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase],
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

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type !== 'oscillator') return node;
        return {
          ...node,
          data: {
            ...node.data,
            playing: isOscillatorPlaying(node.id),
            onTogglePlay: onToggleOscillatorPlay,
          },
        };
      }),
    [isOscillatorPlaying, nodes, onToggleOscillatorPlay],
  );

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      setEdges((current) => addEdge(connection, current));
    },
    [setEdges],
  );

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes }) => {
    setSelectedNodeId(selectedNodes[0]?.id ?? null);
  }, []);

  const onChangeNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, data } : node)),
      );
    },
    [setNodes],
  );

  const addOscillator = useCallback(() => {
    setNodes((current) => {
      const index = current.filter((node) => node.type === 'oscillator').length;
      const position = nextOffset(current.length);
      const node: OscillatorFlowNode = {
        id: `oscillator-${crypto.randomUUID()}`,
        type: 'oscillator',
        position,
        data: {
          label: index === 0 ? 'Sine Tone' : `Sine Tone ${index + 1}`,
          waveform: oscillatorDefaults.waveform,
          frequencyHz: oscillatorDefaults.frequencyHz,
          gain: oscillatorDefaults.gain,
          status: `${oscillatorDefaults.frequencyHz} Hz`,
        },
      };
      return [...current, node];
    });
  }, [setNodes]);

  const addModulator = useCallback(() => {
    setNodes((current) => {
      const index = current.filter((node) => node.type === 'modulator').length;
      const position = nextOffset(current.length);
      const node: ModulatorFlowNode = {
        id: `modulator-${crypto.randomUUID()}`,
        type: 'modulator',
        position,
        data: {
          label: index === 0 ? 'Magnitude → Frequency' : `Modulator ${index + 1}`,
          channelKey: modulatorDefaults.channelKey,
          targetParam: modulatorDefaults.targetParam,
          inMin: modulatorDefaults.inMin,
          inMax: modulatorDefaults.inMax,
          outMin: modulatorDefaults.outMin,
          outMax: modulatorDefaults.outMax,
          status: `${modulatorDefaults.inMin}–${modulatorDefaults.inMax} → ${modulatorDefaults.outMin}–${modulatorDefaults.outMax}`,
        },
      };
      return [...current, node];
    });
  }, [setNodes]);

  const addConnector = useCallback(
    (kindKey: string) => {
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
    [setNodes],
  );

  const addEffect = useCallback(
    (kindKey: string) => {
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
    [setNodes],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const removeIds = new Set([nodeId]);
      setNodes((current) => current.filter((node) => !removeIds.has(node.id)));
      setEdges((current) =>
        current.filter((edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target)),
      );
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [setEdges, setNodes],
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
      newBlankPatch,
      deletePatch,
      resolveConflictByReload,
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
      newBlankPatch,
      deletePatch,
      resolveConflictByReload,
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

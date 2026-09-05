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
import {
  connectorKindsByKey,
  modulatorDefaults,
  oscillatorDefaults,
  usgsConnector,
} from '@/generated/catalog';
import { usePatchPersist } from '@/persist/usePatchPersist';
import { usePatchRuntime } from '@/runtime/usePatchRuntime';
import { type ConnectorFlowNode } from '@/nodes/ConnectorNode';
import { type ModulatorFlowNode } from '@/nodes/ModulatorNode';
import { type OscillatorFlowNode } from '@/nodes/OscillatorNode';

const initialNodes: Node[] = [
  {
    id: 'connector-usgs',
    type: 'connector',
    position: { x: 40, y: 140 },
    data: {
      label: usgsConnector.label,
      kindKey: usgsConnector.key,
      status: 'M —',
    },
  },
  {
    id: 'modulator-mag-freq',
    type: 'modulator',
    position: { x: 280, y: 140 },
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
    position: { x: 540, y: 140 },
    data: {
      label: 'Sine Tone',
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
  addModulator: () => void;
  addOscillator: () => void;
  sessionReady: boolean;
  authMode: string;
  patches: ReturnType<typeof usePatchPersist>['patches'];
  activePatchId: string | null;
  activePatchName: string;
  persistStatus: ReturnType<typeof usePatchPersist>['persistStatus'];
  saveNow: () => Promise<void>;
  createPatch: ReturnType<typeof usePatchPersist>['createPatch'];
  loadPatch: (id: string) => Promise<void>;
  resolveConflictByReload: () => Promise<void>;
  liveStatus: ReturnType<typeof usePatchRuntime>['liveStatus'];
  lastSample: ReturnType<typeof usePatchRuntime>['lastSample'];
  playAllOscillators: () => void;
  stopAllOscillators: () => void;
};

const PatchWorkspaceContext = createContext<PatchWorkspaceValue | null>(null);

export function PatchWorkspaceProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const persist = usePatchPersist({ nodes, edges, setNodes, setEdges });
  const { scheduleAutosave } = persist;

  const {
    liveStatus,
    lastSample,
    playOscillator,
    stopOscillator,
    playAllOscillators,
    stopAllOscillators,
    isOscillatorPlaying,
  } = usePatchRuntime(nodes, edges);

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
      addModulator,
      addOscillator,
      sessionReady: persist.sessionReady,
      authMode: persist.authMode,
      patches: persist.patches,
      activePatchId: persist.activePatchId,
      activePatchName: persist.activePatchName,
      persistStatus: persist.persistStatus,
      saveNow: persist.saveNow,
      createPatch: persist.createPatch,
      loadPatch: persist.loadPatch,
      resolveConflictByReload: persist.resolveConflictByReload,
      liveStatus,
      lastSample,
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
      addModulator,
      addOscillator,
      persist.sessionReady,
      persist.authMode,
      persist.patches,
      persist.activePatchId,
      persist.activePatchName,
      persist.persistStatus,
      persist.saveNow,
      persist.createPatch,
      persist.loadPatch,
      persist.resolveConflictByReload,
      liveStatus,
      lastSample,
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

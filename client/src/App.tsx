import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NodeInspector } from '@/components/NodeInspector';
import { Button } from '@/components/ui/button';
import {
  modulatorDefaults,
  oscillatorDefaults,
  shellCreateActions,
  shellPaletteCategories,
  shellPatchTabs,
  usgsConnector,
} from '@/generated/catalog';
import { ConnectorNode, type ConnectorFlowNode } from './nodes/ConnectorNode';
import { ModulatorNode, type ModulatorFlowNode } from './nodes/ModulatorNode';
import { OscillatorNode, type OscillatorFlowNode } from './nodes/OscillatorNode';

const nodeTypes = {
  connector: ConnectorNode,
  modulator: ModulatorNode,
  oscillator: OscillatorNode,
} satisfies NodeTypes;

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
      label: 'Magnitude → Frequency (Hz)',
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

function noopTransport() {
  // Shell stub: live audio and USGS streaming come later.
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const activePatch = useMemo(
    () => shellPatchTabs.find((tab) => tab.active)?.name ?? 'Untitled Patch',
    [],
  );

  const onPlay = useCallback(() => noopTransport(), []);
  const onStop = useCallback(() => noopTransport(), []);

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
          label: index === 0 ? 'Magnitude → Frequency (Hz)' : `Modulator ${index + 1}`,
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

  const addConnector = useCallback(() => {
    setNodes((current) => {
      const index = current.filter((node) => node.type === 'connector').length;
      const position = nextOffset(current.length);
      const node: ConnectorFlowNode = {
        id: `connector-${crypto.randomUUID()}`,
        type: 'connector',
        position,
        data: {
          label: index === 0 ? usgsConnector.label : `${usgsConnector.label} ${index + 1}`,
          kindKey: usgsConnector.key,
          status: 'M —',
        },
      };
      return [...current, node];
    });
  }, [setNodes]);

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">EARTHBEAT</div>
        <div className="shell__create">
          {shellCreateActions.map((action) => {
            const onClick =
              action.nodeType === 'connector'
                ? addConnector
                : action.nodeType === 'modulator'
                  ? addModulator
                  : addOscillator;
            return (
              <Button
                key={action.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={onClick}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
        <label className="shell__patch-select">
          <span className="visually-hidden">Active patch</span>
          <select defaultValue={activePatch} aria-label="Active patch">
            {shellPatchTabs.map((tab) => (
              <option key={tab.key} value={tab.name}>
                {tab.name}
              </option>
            ))}
          </select>
        </label>
        <div className="shell__transport">
          <Button type="button" variant="outline" size="icon" onClick={onPlay} aria-label="Play">
            ▶
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onStop} aria-label="Stop">
            ■
          </Button>
          <span className="live-badge" title="Live feed not connected yet">
            <span className="live-badge__dot" />
            LIVE
          </span>
        </div>
      </header>

      <div className="shell__body">
        <aside className="shell__sidebar" aria-label="Node categories">
          {shellPaletteCategories.map((item) => (
            <div key={item.key} className="sidebar-item" title="Palette actions come later">
              <span className="sidebar-item__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="sidebar-item__label">{item.label}</span>
            </div>
          ))}
        </aside>

        <main className="shell__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable
            elementsSelectable
          >
            <Background
              id="dot-grid"
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.4}
              color="var(--grid-dot)"
            />
          </ReactFlow>
        </main>

        <NodeInspector
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onChangeNodeData={onChangeNodeData}
        />
      </div>

      <section className="shell__monitor" aria-label="Output monitor">
        <div className="monitor__meta">
          <div className="monitor__title">Output monitor</div>
          <div className="monitor__readout">
            <span>{oscillatorDefaults.frequencyHz} Hz</span>
            <span>−12.4 dBFS</span>
          </div>
        </div>
        <svg className="monitor__wave" viewBox="0 0 800 80" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 40 C 50 10, 100 70, 150 40 S 250 10, 300 40 S 400 70, 450 40 S 550 10, 600 40 S 700 70, 800 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <div className="monitor__time">2.35 s</div>
      </section>

      <footer className="shell__footer" aria-label="Patches">
        {shellPatchTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.active ? 'patch-tab patch-tab--active' : 'patch-tab'}
          >
            {tab.name}
          </button>
        ))}
        {Array.from({ length: 4 }, (_, index) => (
          <button key={`new-${index}`} type="button" className="patch-tab patch-tab--new" aria-label="New patch">
            +
          </button>
        ))}
      </footer>
    </div>
  );
}

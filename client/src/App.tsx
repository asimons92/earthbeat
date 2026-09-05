import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { modulatorDefaults, oscillatorDefaults, usgsConnector } from './catalog';
import { ConnectorNode, type ConnectorFlowNode } from './nodes/ConnectorNode';
import { ModulatorNode, type ModulatorFlowNode } from './nodes/ModulatorNode';
import { OscillatorNode, type OscillatorFlowNode } from './nodes/OscillatorNode';

const SIDEBAR_ITEMS = [
  { id: 'seismic', label: 'Seismic', icon: '∿' },
  { id: 'weather', label: 'Weather', icon: '☁' },
  { id: 'tides', label: 'Tides', icon: '≋' },
  { id: 'transform', label: 'Transform', icon: '∼' },
  { id: 'mix', label: 'Mix', icon: '▥' },
  { id: 'output', label: 'Output', icon: '♪' },
] as const;

const PATCH_TABS = [
  { id: 'pacific', name: 'Pacific Quake Patch', active: true },
  { id: 'winds', name: 'Coastal Winds', active: false },
  { id: 'tidal', name: 'Tidal Pulse', active: false },
  { id: 'storm', name: 'Storm Rhythm', active: false },
] as const;

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
      label: 'Magnitude → Hz',
      channelKey: modulatorDefaults.channelKey,
      targetParam: modulatorDefaults.targetParam,
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
      status: `${oscillatorDefaults.baseFrequencyHz} Hz`,
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
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const activePatch = useMemo(
    () => PATCH_TABS.find((tab) => tab.active)?.name ?? 'Untitled Patch',
    [],
  );

  const onPlay = useCallback(() => noopTransport(), []);
  const onStop = useCallback(() => noopTransport(), []);

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
          status: `${oscillatorDefaults.baseFrequencyHz} Hz`,
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
          label: index === 0 ? 'Magnitude → Hz' : `Magnitude → Hz ${index + 1}`,
          channelKey: modulatorDefaults.channelKey,
          targetParam: modulatorDefaults.targetParam,
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
          <Button type="button" variant="outline" size="sm" onClick={addConnector}>
            New connector
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addModulator}>
            New modulator
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addOscillator}>
            New oscillator
          </Button>
        </div>
        <label className="shell__patch-select">
          <span className="visually-hidden">Active patch</span>
          <select defaultValue={activePatch} aria-label="Active patch">
            {PATCH_TABS.map((tab) => (
              <option key={tab.id} value={tab.name}>
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
          {SIDEBAR_ITEMS.map((item) => (
            <div key={item.id} className="sidebar-item" title="Palette actions come later">
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
      </div>

      <section className="shell__monitor" aria-label="Output monitor">
        <div className="monitor__meta">
          <div className="monitor__title">Output monitor</div>
          <div className="monitor__readout">
            <span>{oscillatorDefaults.baseFrequencyHz} Hz</span>
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
        {PATCH_TABS.map((tab) => (
          <button
            key={tab.id}
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

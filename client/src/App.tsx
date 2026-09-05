import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { demoModulation, oscillatorDefaults, usgsConnector } from './catalog';
import { ModulationEdge } from './edges/ModulationEdge';
import { ConnectionNode } from './nodes/ConnectionNode';
import { OscillatorNode } from './nodes/OscillatorNode';

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
  connection: ConnectionNode,
  oscillator: OscillatorNode,
} satisfies NodeTypes;

const edgeTypes = {
  modulation: ModulationEdge,
} satisfies EdgeTypes;

const initialNodes = [
  {
    id: 'connection-usgs',
    type: 'connection' as const,
    position: { x: 80, y: 140 },
    data: {
      label: usgsConnector.label,
      connectorKey: usgsConnector.key,
      status: 'M —',
    },
  },
  {
    id: 'oscillator-sine',
    type: 'oscillator' as const,
    position: { x: 460, y: 140 },
    data: {
      label: 'Sine Tone',
      waveform: oscillatorDefaults.waveform,
      status: `${oscillatorDefaults.baseFrequencyHz} Hz`,
    },
  },
];

const initialEdges = [
  {
    id: 'modulation-mag-freq',
    type: 'modulation' as const,
    source: 'connection-usgs',
    target: 'oscillator-sine',
    sourceHandle: 'out',
    targetHandle: 'in',
    data: {
      label: `${demoModulation.channelKey} → ${demoModulation.targetParam}`,
    },
  },
];

function noopTransport() {
  // Shell stub: live audio and USGS streaming come later.
}

export default function App() {
  const [nodes] = useState(initialNodes);
  const [edges] = useState(initialEdges);
  const activePatch = useMemo(
    () => PATCH_TABS.find((tab) => tab.active)?.name ?? 'Untitled Patch',
    [],
  );

  const onPlay = useCallback(() => noopTransport(), []);
  const onStop = useCallback(() => noopTransport(), []);

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">EARTHBEAT</div>
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
          <button type="button" className="transport-btn" onClick={onPlay} aria-label="Play">
            ▶
          </button>
          <button type="button" className="transport-btn" onClick={onStop} aria-label="Stop">
            ■
          </button>
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
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  shellAuthActions,
  shellCreateActions,
  shellPaletteCategories,
  usgsConnector,
} from '@/generated/catalog';
import { decideAuthChrome } from '@/persist/sessionBootstrap';
import { startGoogleSignIn, startSignOut } from '@/persist/authActions';
import { usePatchPersist } from '@/persist/usePatchPersist';
import { usePatchRuntime } from '@/runtime/usePatchRuntime';
import { ThemeToggle } from '@/theme/ThemeToggle';
import { useTheme } from '@/theme/useTheme';
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

function persistLabel(status: string) {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  if (status === 'conflict') return 'Version conflict';
  if (status === 'error') return 'Save failed';
  return 'Not saved';
}

export default function App() {
  const { mode: themeMode } = useTheme();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const {
    sessionReady,
    authMode,
    patches,
    activePatchId,
    activePatchName,
    persistStatus,
    saveNow,
    scheduleAutosave,
    createPatch,
    loadPatch,
    resolveConflictByReload,
  } = usePatchPersist({ nodes, edges, setNodes, setEdges });

  const authChrome = decideAuthChrome({ authMode, sessionReady });
  const googleSignInAction = shellAuthActions.find((action) => action.key === 'google_sign_in');
  const signOutAction = shellAuthActions.find((action) => action.key === 'sign_out');

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

  const onSaveClick = useCallback(async () => {
    if (!sessionReady) {
      window.alert('Sign in to save a Patch.');
      return;
    }
    if (!activePatchId) {
      const name = window.prompt('Patch name', activePatchName) ?? activePatchName;
      await createPatch(name.trim() || 'Untitled Patch');
      return;
    }
    await saveNow();
  }, [activePatchId, activePatchName, createPatch, saveNow, sessionReady]);

  const onSelectPatch = useCallback(
    async (patchId: string) => {
      if (!patchId) return;
      await loadPatch(patchId);
    },
    [loadPatch],
  );

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
          <select
            value={activePatchId ?? ''}
            aria-label="Active patch"
            onChange={(event) => {
              void onSelectPatch(event.target.value);
            }}
          >
            <option value="">{activePatchName}</option>
            {patches.map((patch) => (
              <option key={patch.id} value={patch.id}>
                {patch.name}
              </option>
            ))}
          </select>
        </label>
        <div className="shell__transport">
          {authChrome === 'signIn' && googleSignInAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void startGoogleSignIn().catch(() => {
                  window.alert('Google sign-in failed to start.');
                });
              }}
            >
              {googleSignInAction.label}
            </Button>
          ) : null}
          {authChrome === 'signOut' && signOutAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void startSignOut().catch(() => {
                  window.alert('Sign out failed.');
                });
              }}
            >
              {signOutAction.label}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void onSaveClick()}>
            Save
          </Button>
          <span className="shell__persist-status" data-status={persistStatus}>
            {persistLabel(persistStatus)}
          </span>
          {persistStatus === 'conflict' ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void resolveConflictByReload()}>
              Reload
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={playAllOscillators}
            aria-label="Play all oscillators"
          >
            ▶
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={stopAllOscillators}
            aria-label="Stop all oscillators"
          >
            ■
          </Button>
          <span
            className={
              liveStatus === 'live'
                ? 'live-badge live-badge--on'
                : liveStatus === 'error'
                  ? 'live-badge live-badge--error'
                  : liveStatus === 'connecting'
                    ? 'live-badge live-badge--connecting'
                    : 'live-badge'
            }
            title={
              liveStatus === 'live'
                ? 'USGS stream connected'
                : liveStatus === 'error'
                  ? 'USGS stream error — retrying'
                  : liveStatus === 'connecting'
                    ? 'Connecting to USGS stream'
                    : 'Live feed idle'
            }
          >
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
            nodes={flowNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            colorMode={themeMode}
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
            <span>
              {lastSample?.mag != null ? `M ${lastSample.mag}` : `${oscillatorDefaults.frequencyHz} Hz`}
            </span>
            <span>{lastSample?.place ?? 'Waiting for samples'}</span>
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
        {patches.map((patch) => (
          <button
            key={patch.id}
            type="button"
            className={
              patch.id === activePatchId ? 'patch-tab patch-tab--active' : 'patch-tab'
            }
            onClick={() => {
              void loadPatch(patch.id);
            }}
          >
            {patch.name}
          </button>
        ))}
        <button
          type="button"
          className="patch-tab patch-tab--new"
          aria-label="New patch"
          onClick={() => {
            if (!sessionReady) {
              window.alert('Sign in to save a Patch.');
              return;
            }
            void createPatch(`Patch ${patches.length + 1}`);
          }}
        >
          +
        </button>
      </footer>

      <ThemeToggle />
    </div>
  );
}

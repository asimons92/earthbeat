import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NodeInspector } from '@/components/NodeInspector';
import { useTheme } from '@/theme/useTheme';
import { usePatchWorkspace } from '@/workspace/PatchWorkspace';
import { ConnectorNode } from '@/nodes/ConnectorNode';
import { EffectNode } from '@/nodes/EffectNode';
import { ModulatorNode } from '@/nodes/ModulatorNode';
import { OscillatorNode } from '@/nodes/OscillatorNode';

const nodeTypes = {
  connector: ConnectorNode,
  modulator: ModulatorNode,
  effect: EffectNode,
  oscillator: OscillatorNode,
} satisfies NodeTypes;

export function CanvasPage() {
  const { mode: themeMode } = useTheme();
  const {
    nodes,
    edges,
    flowNodes,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    onChangeNodeData,
    removeNode,
  } = usePatchWorkspace();

  return (
    <>
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
        onRemoveNode={removeNode}
      />
    </>
  );
}

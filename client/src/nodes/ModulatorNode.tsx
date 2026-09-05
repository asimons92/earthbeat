import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type ModulatorNodeData = {
  label: string;
  channelKey: string;
  targetParam: string;
  status: string;
};

export type ModulatorFlowNode = Node<ModulatorNodeData, 'modulator'>;

export function ModulatorNode({ data }: NodeProps<ModulatorFlowNode>) {
  return (
    <div className="graph-node graph-node--modulator">
      <Handle type="target" position={Position.Left} id="in" />
      <div className="graph-node__kind">Modulator</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{data.status}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

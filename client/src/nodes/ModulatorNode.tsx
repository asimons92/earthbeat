import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import { formatModulatorStatus } from '@/catalog/modulatorDisplay';

export type ModulatorNodeData = {
  label: string;
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
  status: string;
};

export type ModulatorFlowNode = Node<ModulatorNodeData, 'modulator'>;

function modulatorStatusLine(data: ModulatorNodeData): string {
  if (typeof data.status === 'string' && data.status.includes('→')) {
    return formatModulatorStatus(data);
  }
  return data.status;
}

export function ModulatorNode({ data }: NodeProps<ModulatorFlowNode>) {
  return (
    <div className="graph-node graph-node--modulator">
      <Handle type="target" position={Position.Left} id="in" />
      <div className="graph-node__kind">Modulator</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{modulatorStatusLine(data)}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

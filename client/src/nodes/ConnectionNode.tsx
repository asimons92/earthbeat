import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type ConnectionNodeData = {
  label: string;
  connectorKey: string;
  status: string;
};

export type ConnectionFlowNode = Node<ConnectionNodeData, 'connection'>;

export function ConnectionNode({ data }: NodeProps<ConnectionFlowNode>) {
  return (
    <div className="graph-node graph-node--connection">
      <div className="graph-node__kind">Connection</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{data.status}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

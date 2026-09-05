import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type ConnectorNodeData = {
  label: string;
  kindKey: string;
  status: string;
};

export type ConnectorFlowNode = Node<ConnectorNodeData, 'connector'>;

export function ConnectorNode({ data }: NodeProps<ConnectorFlowNode>) {
  return (
    <div className="graph-node graph-node--connector">
      <div className="graph-node__kind">Connector</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{data.status}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

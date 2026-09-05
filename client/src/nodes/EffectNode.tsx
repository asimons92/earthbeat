import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type EffectNodeData = {
  label: string;
  kindKey: string;
  tonic: string;
  scaleKey: string;
  enabled: boolean;
  a4Hz: number;
  drive: number;
  timeMs: number;
  feedback: number;
  mix: number;
  status: string;
};

export type EffectFlowNode = Node<EffectNodeData, 'effect'>;

export function EffectNode({ data }: NodeProps<EffectFlowNode>) {
  return (
    <div className="graph-node graph-node--effect">
      <Handle type="target" position={Position.Left} id="in" />
      <div className="graph-node__kind">Effect</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{data.status}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

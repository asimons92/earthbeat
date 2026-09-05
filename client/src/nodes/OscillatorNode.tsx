import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type OscillatorNodeData = {
  label: string;
  waveform: string;
  frequencyHz: number;
  gain: number;
  status: string;
};

export type OscillatorFlowNode = Node<OscillatorNodeData, 'oscillator'>;

export function OscillatorNode({ data }: NodeProps<OscillatorFlowNode>) {
  return (
    <div className="graph-node graph-node--oscillator">
      <Handle type="target" position={Position.Left} id="in" />
      <div className="graph-node__kind">Oscillator</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{data.status}</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

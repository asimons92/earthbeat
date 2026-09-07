import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

import { formatOscillatorHzStatus } from '@/catalog/oscillatorHz';

export type OscillatorNodeData = {
  label: string;
  waveform: string;
  frequencyHz: number;
  gain: number;
  status: string;
  playing?: boolean;
  onTogglePlay?: (nodeId: string) => void;
};

export type OscillatorFlowNode = Node<OscillatorNodeData, 'oscillator'>;

function oscillatorStatusLine(data: OscillatorNodeData): string {
  if (typeof data.status === 'string' && data.status.endsWith(' Hz')) {
    return formatOscillatorHzStatus(data.frequencyHz);
  }
  return data.status;
}

export function OscillatorNode({ id, data }: NodeProps<OscillatorFlowNode>) {
  const playing = Boolean(data.playing);

  return (
    <div className="graph-node graph-node--oscillator">
      <Handle type="target" position={Position.Left} id="in" />
      <div className="graph-node__kind">Oscillator</div>
      <div className="graph-node__title">{data.label}</div>
      <div className="graph-node__status">{oscillatorStatusLine(data)}</div>
      <button
        type="button"
        className={playing ? 'graph-node__play graph-node__play--on' : 'graph-node__play'}
        onClick={(event) => {
          event.stopPropagation();
          data.onTogglePlay?.(id);
        }}
        aria-label={playing ? 'Stop oscillator' : 'Play oscillator'}
      >
        {playing ? '■' : '▶'}
      </button>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

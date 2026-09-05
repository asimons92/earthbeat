import type { Edge, Node } from '@xyflow/react';

export type DomainConnector = {
  id: string;
  patchId: string;
  kindKey: string;
  label?: string;
  positionX: number;
  positionY: number;
  feedUrl?: string;
  pollIntervalMs?: number;
  playbackHz?: number;
};

export type DomainModulator = {
  id: string;
  patchId: string;
  label?: string;
  positionX: number;
  positionY: number;
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
};

export type DomainOscillator = {
  id: string;
  patchId: string;
  label?: string;
  positionX: number;
  positionY: number;
  waveform: string;
  frequencyHz: number;
  gain: number;
};

export type DomainWire = {
  id: string;
  patchId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type DomainGraph = {
  connectors: DomainConnector[];
  modulators: DomainModulator[];
  oscillators: DomainOscillator[];
  wires: DomainWire[];
};

export function flowToDomainGraph(patchId: string, nodes: Node[], edges: Edge[]): DomainGraph {
  const connectors: DomainConnector[] = [];
  const modulators: DomainModulator[] = [];
  const oscillators: DomainOscillator[] = [];

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    if (node.type === 'connector') {
      connectors.push({
        id: node.id,
        patchId,
        kindKey: String(data.kindKey ?? ''),
        label: typeof data.label === 'string' ? data.label : undefined,
        positionX: node.position.x,
        positionY: node.position.y,
        feedUrl: typeof data.feedUrl === 'string' ? data.feedUrl : undefined,
        pollIntervalMs: typeof data.pollIntervalMs === 'number' ? data.pollIntervalMs : undefined,
        playbackHz: typeof data.playbackHz === 'number' ? data.playbackHz : undefined,
      });
    } else if (node.type === 'modulator') {
      modulators.push({
        id: node.id,
        patchId,
        label: typeof data.label === 'string' ? data.label : undefined,
        positionX: node.position.x,
        positionY: node.position.y,
        channelKey: String(data.channelKey ?? ''),
        targetParam: String(data.targetParam ?? ''),
        inMin: Number(data.inMin),
        inMax: Number(data.inMax),
        outMin: Number(data.outMin),
        outMax: Number(data.outMax),
      });
    } else if (node.type === 'oscillator') {
      oscillators.push({
        id: node.id,
        patchId,
        label: typeof data.label === 'string' ? data.label : undefined,
        positionX: node.position.x,
        positionY: node.position.y,
        waveform: String(data.waveform ?? 'sine'),
        frequencyHz: Number(data.frequencyHz),
        gain: Number(data.gain),
      });
    }
  }

  const wires: DomainWire[] = edges.map((edge) => ({
    id: edge.id,
    patchId,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  }));

  return { connectors, modulators, oscillators, wires };
}

export function domainGraphToFlow(graph: DomainGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    ...graph.connectors.map((row) => ({
      id: row.id,
      type: 'connector' as const,
      position: { x: row.positionX, y: row.positionY },
      data: {
        label: row.label ?? row.kindKey,
        kindKey: row.kindKey,
        status: 'M —',
        feedUrl: row.feedUrl,
        pollIntervalMs: row.pollIntervalMs,
        playbackHz: row.playbackHz,
      },
    })),
    ...graph.modulators.map((row) => ({
      id: row.id,
      type: 'modulator' as const,
      position: { x: row.positionX, y: row.positionY },
      data: {
        label: row.label ?? `${row.channelKey} → ${row.targetParam}`,
        channelKey: row.channelKey,
        targetParam: row.targetParam,
        inMin: row.inMin,
        inMax: row.inMax,
        outMin: row.outMin,
        outMax: row.outMax,
        status: `${row.inMin}–${row.inMax} → ${row.outMin}×–${row.outMax}×`,
      },
    })),
    ...graph.oscillators.map((row) => ({
      id: row.id,
      type: 'oscillator' as const,
      position: { x: row.positionX, y: row.positionY },
      data: {
        label: row.label ?? 'Oscillator',
        waveform: row.waveform,
        frequencyHz: row.frequencyHz,
        gain: row.gain,
        status: `${row.frequencyHz} Hz`,
      },
    })),
  ];

  const edges: Edge[] = graph.wires.map((wire) => ({
    id: wire.id,
    source: wire.sourceNodeId,
    target: wire.targetNodeId,
    sourceHandle: wire.sourceHandle,
    targetHandle: wire.targetHandle,
  }));

  return { nodes, edges };
}

export function assertReplaceGraphVersion(
  expectedVersion: number,
  currentVersion: number,
): { ok: true } | { ok: false; reason: 'conflict' } {
  if (expectedVersion === currentVersion) return { ok: true };
  return { ok: false, reason: 'conflict' };
}

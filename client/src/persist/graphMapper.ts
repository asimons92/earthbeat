import type { Edge, Node } from '@xyflow/react';

import { effectStatusLine } from '@/catalog/buildEffectNode';

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
  config?: unknown;
};

function readInterpolateFlag(config: unknown): boolean | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const interpolate = (config as { interpolate?: unknown }).interpolate;
  return typeof interpolate === 'boolean' ? interpolate : undefined;
}

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

export type DomainEffect = {
  id: string;
  patchId: string;
  kindKey: string;
  label?: string;
  positionX: number;
  positionY: number;
  tonic: string;
  scaleKey: string;
  enabled: boolean;
  a4Hz: number;
  drive: number;
  timeMs: number;
  feedback: number;
  mix: number;
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
  effects: DomainEffect[];
  wires: DomainWire[];
};

export function flowToDomainGraph(patchId: string, nodes: Node[], edges: Edge[]): DomainGraph {
  const connectors: DomainConnector[] = [];
  const modulators: DomainModulator[] = [];
  const oscillators: DomainOscillator[] = [];
  const effects: DomainEffect[] = [];

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    if (node.type === 'connector') {
      const interpolate =
        typeof data.interpolate === 'boolean' ? data.interpolate : undefined;
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
        config: interpolate === undefined ? undefined : { interpolate },
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
    } else if (node.type === 'effect') {
      effects.push({
        id: node.id,
        patchId,
        kindKey: String(data.kindKey ?? 'scale_snap'),
        label: typeof data.label === 'string' ? data.label : undefined,
        positionX: node.position.x,
        positionY: node.position.y,
        tonic: String(data.tonic ?? 'C'),
        scaleKey: String(data.scaleKey ?? 'major'),
        enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
        a4Hz: typeof data.a4Hz === 'number' ? data.a4Hz : 440,
        drive: typeof data.drive === 'number' ? data.drive : 2,
        timeMs: typeof data.timeMs === 'number' ? data.timeMs : 250,
        feedback: typeof data.feedback === 'number' ? data.feedback : 0.35,
        mix: typeof data.mix === 'number' ? data.mix : 0.35,
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

  return { connectors, modulators, oscillators, effects, wires };
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
        ...(readInterpolateFlag(row.config) === undefined
          ? {}
          : { interpolate: readInterpolateFlag(row.config) }),
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
    ...(graph.effects ?? []).map((row) => {
      const drive = typeof row.drive === 'number' ? row.drive : 2;
      const timeMs = typeof row.timeMs === 'number' ? row.timeMs : 250;
      const feedback = typeof row.feedback === 'number' ? row.feedback : 0.35;
      const mix = typeof row.mix === 'number' ? row.mix : 0.35;
      return {
        id: row.id,
        type: 'effect' as const,
        position: { x: row.positionX, y: row.positionY },
        data: {
          label: row.label ?? row.kindKey,
          kindKey: row.kindKey,
          tonic: row.tonic,
          scaleKey: row.scaleKey,
          enabled: row.enabled,
          a4Hz: row.a4Hz,
          drive,
          timeMs,
          feedback,
          mix,
          status: effectStatusLine({
            kindKey: row.kindKey,
            enabled: row.enabled,
            tonic: row.tonic,
            scaleKey: row.scaleKey,
            drive,
            timeMs,
            feedback,
          }),
        },
      };
    }),
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

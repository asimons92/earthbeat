/** Graph walk: Connector → Modulator → Effect* → Oscillator for live modulation. */

export type RuntimeNodeKind = 'connector' | 'modulator' | 'effect' | 'oscillator';

export type RuntimeNode = {
  id: string;
  type: RuntimeNodeKind;
  data: Record<string, unknown>;
};

export type RuntimeEdge = {
  id: string;
  source: string;
  target: string;
};

export type ModulationChain = {
  complete: true;
  connector: RuntimeNode;
  modulator: RuntimeNode;
  oscillator: RuntimeNode;
  /** Effects between Modulator and Oscillator, source-to-sink order. */
  effects: RuntimeNode[];
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMax: number;
  outMin: number;
};

export type IncompleteModulationChain = {
  complete: false;
  oscillator: RuntimeNode;
};

export type ModulationChainResult = ModulationChain | IncompleteModulationChain;

export type ScaleSnapEffectNode = {
  id: string;
  enabled: boolean;
  tonic: string;
  scaleKey: string;
  a4Hz: number;
};

export type VoiceGraph = {
  oscillator: RuntimeNode;
  /** ScaleSnap Effects on the frequency path, source-to-sink. */
  frequencyEffects: ScaleSnapEffectNode[];
  frequencyChain: ModulationChain | null;
  gainChain: ModulationChain | null;
};

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toScaleSnapEffect(node: RuntimeNode): ScaleSnapEffectNode {
  return {
    id: node.id,
    enabled: asBoolean(node.data.enabled, true),
    tonic: asString(node.data.tonic, 'C'),
    scaleKey: asString(node.data.scaleKey, 'major'),
    a4Hz: asNumber(node.data.a4Hz, 440),
  };
}

function modulationFrom(
  connector: RuntimeNode,
  modulator: RuntimeNode,
  oscillator: RuntimeNode,
  effects: RuntimeNode[],
): ModulationChain {
  return {
    complete: true,
    connector,
    modulator,
    oscillator,
    effects,
    channelKey: asString(modulator.data.channelKey, 'mag'),
    targetParam: asString(modulator.data.targetParam, 'frequencyHz'),
    inMin: asNumber(modulator.data.inMin, 0),
    inMax: asNumber(modulator.data.inMax, 1),
    outMin: asNumber(modulator.data.outMin, 0),
    outMax: asNumber(modulator.data.outMax, 1),
  };
}

function connectorUpstreamOf(
  modulatorId: string,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): RuntimeNode | null {
  const intoMod = edges.find((edge) => edge.target === modulatorId);
  if (!intoMod) return null;
  const connector = byId.get(intoMod.source);
  if (!connector || connector.type !== 'connector') return null;
  return connector;
}

/**
 * From an Oscillator inbound source, walk back through Effects to a Modulator (if any).
 * Returns Effects in source-to-sink order.
 */
function resolvePathFromInbound(
  inboundSource: RuntimeNode,
  oscillator: RuntimeNode,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): { modulator: RuntimeNode | null; effects: RuntimeNode[] } {
  if (inboundSource.type === 'modulator') {
    return { modulator: inboundSource, effects: [] };
  }
  if (inboundSource.type !== 'effect') {
    return { modulator: null, effects: [] };
  }

  const sinkToSource: RuntimeNode[] = [inboundSource];
  let cursor = inboundSource.id;
  const visited = new Set<string>([oscillator.id, inboundSource.id]);

  while (true) {
    const inbound = edges.filter((edge) => edge.target === cursor);
    if (inbound.length === 0) {
      return { modulator: null, effects: sinkToSource.slice().reverse() };
    }
    const preferred =
      inbound.find((edge) => {
        const node = byId.get(edge.source);
        return node?.type === 'effect' || node?.type === 'modulator';
      }) ?? inbound[0]!;
    const next = byId.get(preferred.source);
    if (!next || visited.has(next.id)) {
      return { modulator: null, effects: sinkToSource.slice().reverse() };
    }
    visited.add(next.id);
    if (next.type === 'effect') {
      sinkToSource.push(next);
      cursor = next.id;
      continue;
    }
    if (next.type === 'modulator') {
      return { modulator: next, effects: sinkToSource.slice().reverse() };
    }
    return { modulator: null, effects: sinkToSource.slice().reverse() };
  }
}

/** Effect-only chain into the Oscillator (no Modulator), source-to-sink. */
function effectOnlyChain(
  oscillatorId: string,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): RuntimeNode[] {
  const intoOsc = edges.filter((edge) => edge.target === oscillatorId);
  const effectEdge = intoOsc.find((edge) => byId.get(edge.source)?.type === 'effect');
  if (!effectEdge) return [];
  const source = byId.get(effectEdge.source);
  if (!source) return [];
  const { modulator, effects } = resolvePathFromInbound(
    source,
    byId.get(oscillatorId) ?? { id: oscillatorId, type: 'oscillator', data: {} },
    byId,
    edges,
  );
  if (modulator) return [];
  return effects;
}

/** All complete Connector → Modulator → (Effect*) → Oscillator chains into one Oscillator. */
export function findCompleteModulationChains(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
): ModulationChain[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const oscillator = byId.get(oscillatorId);
  if (!oscillator || oscillator.type !== 'oscillator') return [];

  const chains: ModulationChain[] = [];
  const seenModulators = new Set<string>();
  const intoOsc = edges.filter((edge) => edge.target === oscillatorId);

  for (const edge of intoOsc) {
    const source = byId.get(edge.source);
    if (!source) continue;
    if (source.type !== 'modulator' && source.type !== 'effect') continue;

    const { modulator, effects } = resolvePathFromInbound(source, oscillator, byId, edges);
    if (!modulator || seenModulators.has(modulator.id)) continue;
    const connector = connectorUpstreamOf(modulator.id, byId, edges);
    if (!connector) continue;

    seenModulators.add(modulator.id);
    chains.push(modulationFrom(connector, modulator, oscillator, effects));
  }

  return chains;
}

/**
 * Backward-compatible single chain: first complete path into the Oscillator.
 * Walks through Effects between Modulator and Oscillator.
 */
export function findModulationChain(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
): ModulationChainResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const oscillator = byId.get(oscillatorId);

  if (!oscillator || oscillator.type !== 'oscillator') {
    return {
      complete: false,
      oscillator: oscillator ?? {
        id: oscillatorId,
        type: 'oscillator',
        data: {},
      },
    };
  }

  const chains = findCompleteModulationChains(nodes, edges, oscillatorId);
  if (chains.length > 0) {
    return chains[0]!;
  }
  return { complete: false, oscillator };
}

/** Resolve frequency Effects plus optional frequency and gain Modulator chains. */
export function findVoiceGraph(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
): VoiceGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const oscillator = byId.get(oscillatorId) ?? {
    id: oscillatorId,
    type: 'oscillator' as const,
    data: {},
  };

  const chains = findCompleteModulationChains(nodes, edges, oscillatorId);
  const frequencyChain =
    chains.find((chain) => chain.targetParam === 'frequencyHz') ?? null;
  const gainChain = chains.find((chain) => chain.targetParam === 'gain') ?? null;

  const frequencyEffects = frequencyChain
    ? frequencyChain.effects.map(toScaleSnapEffect)
    : effectOnlyChain(oscillatorId, byId, edges).map(toScaleSnapEffect);

  return {
    oscillator,
    frequencyEffects,
    frequencyChain,
    gainChain,
  };
}

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

const SCALE_SNAP_KIND = 'scale_snap';

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isScaleSnapEffect(node: RuntimeNode): boolean {
  return node.type === 'effect' && asString(node.data.kindKey, '') === SCALE_SNAP_KIND;
}

function toScaleSnapEffect(node: RuntimeNode): ScaleSnapEffectNode | null {
  if (!isScaleSnapEffect(node)) return null;
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
 * Walk forward from a Modulator through Effects to the Oscillator.
 * Returns each Effect path (source-to-sink). Shared Effect fan-in yields one path per Modulator.
 */
function effectPathsFromModulatorToOscillator(
  modulatorId: string,
  oscillatorId: string,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): RuntimeNode[][] {
  const paths: RuntimeNode[][] = [];

  function walk(cursorId: string, effects: RuntimeNode[], visited: Set<string>) {
    const outbound = edges.filter((edge) => edge.source === cursorId);
    for (const edge of outbound) {
      const next = byId.get(edge.target);
      if (!next || visited.has(next.id)) continue;
      if (next.type === 'oscillator' && next.id === oscillatorId) {
        paths.push(effects.slice());
        continue;
      }
      if (next.type !== 'effect') continue;
      const nextVisited = new Set(visited);
      nextVisited.add(next.id);
      walk(next.id, [...effects, next], nextVisited);
    }
  }

  walk(modulatorId, [], new Set([modulatorId]));
  return paths;
}

/**
 * Effect chain into the Oscillator from one inbound Effect, source-to-sink.
 * Stops walking back when the upstream is not an Effect (Modulator or other).
 */
function effectChainFromInbound(
  inboundEffect: RuntimeNode,
  oscillatorId: string,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): RuntimeNode[] {
  const sinkToSource: RuntimeNode[] = [inboundEffect];
  let cursor = inboundEffect.id;
  const visited = new Set<string>([oscillatorId, inboundEffect.id]);

  while (true) {
    const inbound = edges.filter((edge) => edge.target === cursor);
    const effectEdge = inbound.find((edge) => byId.get(edge.source)?.type === 'effect');
    if (!effectEdge) break;
    const next = byId.get(effectEdge.source);
    if (!next || visited.has(next.id)) break;
    visited.add(next.id);
    sinkToSource.push(next);
    cursor = next.id;
  }

  return sinkToSource.slice().reverse();
}

/**
 * Every Scale Snap Effect that reaches the Oscillator through Effect wiring.
 * Includes parallel Effect→Oscillator paths and Effects on gain Modulator paths.
 */
function collectInboundScaleSnapEffects(
  oscillatorId: string,
  byId: Map<string, RuntimeNode>,
  edges: RuntimeEdge[],
): ScaleSnapEffectNode[] {
  const ordered: ScaleSnapEffectNode[] = [];
  const seen = new Set<string>();
  const intoOsc = edges.filter((edge) => edge.target === oscillatorId);

  for (const edge of intoOsc) {
    const source = byId.get(edge.source);
    if (!source || source.type !== 'effect') continue;
    const chain = effectChainFromInbound(source, oscillatorId, byId, edges);
    for (const node of chain) {
      const snap = toScaleSnapEffect(node);
      if (!snap || seen.has(snap.id)) continue;
      seen.add(snap.id);
      ordered.push(snap);
    }
  }

  return ordered;
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

  for (const node of nodes) {
    if (node.type !== 'modulator') continue;
    if (seenModulators.has(node.id)) continue;
    const connector = connectorUpstreamOf(node.id, byId, edges);
    if (!connector) continue;
    const paths = effectPathsFromModulatorToOscillator(node.id, oscillatorId, byId, edges);
    if (paths.length === 0) continue;
    seenModulators.add(node.id);
    chains.push(modulationFrom(connector, node, oscillator, paths[0]!));
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

  return {
    oscillator,
    frequencyEffects: collectInboundScaleSnapEffects(oscillatorId, byId, edges),
    frequencyChain,
    gainChain,
  };
}

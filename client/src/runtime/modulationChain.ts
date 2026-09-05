/** Graph walk: Connector → Modulator → Oscillator for live modulation. */

export type RuntimeNodeKind = 'connector' | 'modulator' | 'oscillator';

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
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
};

export type IncompleteModulationChain = {
  complete: false;
  oscillator: RuntimeNode;
};

export type ModulationChainResult = ModulationChain | IncompleteModulationChain;

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

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

  const intoOsc = edges.find((edge) => edge.target === oscillatorId);
  if (!intoOsc) {
    return { complete: false, oscillator };
  }

  const modulator = byId.get(intoOsc.source);
  if (!modulator || modulator.type !== 'modulator') {
    return { complete: false, oscillator };
  }

  const intoMod = edges.find((edge) => edge.target === modulator.id);
  if (!intoMod) {
    return { complete: false, oscillator };
  }

  const connector = byId.get(intoMod.source);
  if (!connector || connector.type !== 'connector') {
    return { complete: false, oscillator };
  }

  return {
    complete: true,
    connector,
    modulator,
    oscillator,
    channelKey: asString(modulator.data.channelKey, 'mag'),
    targetParam: asString(modulator.data.targetParam, 'frequencyHz'),
    inMin: asNumber(modulator.data.inMin, 0),
    inMax: asNumber(modulator.data.inMax, 1),
    outMin: asNumber(modulator.data.outMin, 0),
    outMax: asNumber(modulator.data.outMax, 1),
  };
}

/** Monitor strip descriptors from complete Connector → Modulator chains. */

import { getConnectorKind } from '@/generated/catalog';

import {
  findModulationChain,
  type ModulationChain,
  type RuntimeEdge,
  type RuntimeNode,
} from './modulationChain';

export type MonitorStrip = {
  /** Stable id: Modulator node id. */
  id: string;
  kindKey: string;
  channelKey: string;
  inMin: number;
  inMax: number;
  label: string;
  connectorId: string;
  oscillatorId: string;
};

function channelLabel(kindKey: string, channelKey: string): string {
  const kind = getConnectorKind(kindKey);
  const channel = kind?.channels.find((entry) => entry.key === channelKey);
  return channel?.label ?? channelKey;
}

function kindLabel(kindKey: string): string {
  return getConnectorKind(kindKey)?.label ?? kindKey;
}

export function stripFromChain(chain: ModulationChain): MonitorStrip {
  const kindKey =
    typeof chain.connector.data.kindKey === 'string' ? chain.connector.data.kindKey : '';
  return {
    id: chain.modulator.id,
    kindKey,
    channelKey: chain.channelKey,
    inMin: chain.inMin,
    inMax: chain.inMax,
    label: `${kindLabel(kindKey)} · ${channelLabel(kindKey, chain.channelKey)}`,
    connectorId: chain.connector.id,
    oscillatorId: chain.oscillator.id,
  };
}

/** One strip per complete Connector → Modulator → Oscillator chain. */
export function listMonitorStrips(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
): MonitorStrip[] {
  const strips: MonitorStrip[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'oscillator') continue;
    const chain = findModulationChain(nodes, edges, node.id);
    if (!chain.complete) continue;
    const strip = stripFromChain(chain);
    if (seen.has(strip.id)) continue;
    seen.add(strip.id);
    strips.push(strip);
  }
  return strips;
}

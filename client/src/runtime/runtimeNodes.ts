import type { Edge, Node } from '@xyflow/react';

import type { RuntimeEdge, RuntimeNode } from './modulationChain';

/** React Flow canvas nodes → runtime graph nodes (includes Effects). */
export function toRuntimeNodes(nodes: Node[]): RuntimeNode[] {
  return nodes
    .filter(
      (node) =>
        node.type === 'connector' ||
        node.type === 'modulator' ||
        node.type === 'effect' ||
        node.type === 'oscillator',
    )
    .map((node) => ({
      id: node.id,
      type: node.type as RuntimeNode['type'],
      data: node.data as Record<string, unknown>,
    }));
}

export function toRuntimeEdges(edges: Edge[]): RuntimeEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

/** Remove canvas nodes and every Wire that touches them. */

export type GraphNodeRef = { id: string };
export type GraphEdgeRef = { id: string; source: string; target: string };

export function removeNodesFromGraph<N extends GraphNodeRef, E extends GraphEdgeRef>(
  nodes: readonly N[],
  edges: readonly E[],
  removeIds: ReadonlySet<string>,
): { nodes: N[]; edges: E[] } {
  if (removeIds.size === 0) {
    return { nodes: [...nodes], edges: [...edges] };
  }
  return {
    nodes: nodes.filter((node) => !removeIds.has(node.id)),
    edges: edges.filter(
      (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
    ),
  };
}

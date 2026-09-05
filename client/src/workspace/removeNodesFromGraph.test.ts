// earthbeat-test: exception ui-surface — canvas node/wire removal wiring, not a domain invariant
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { removeNodesFromGraph } from './removeNodesFromGraph';

const idArb = fc.uuid();

describe('removeNodesFromGraph', () => {
  it('drops selected nodes and every edge that touches them', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 1, maxLength: 6 }),
        fc.nat({ max: 5 }),
        (nodeIds, removeCount) => {
          const nodes = nodeIds.map((id) => ({ id }));
          const edges =
            nodeIds.length < 2
              ? []
              : nodeIds.slice(0, -1).map((source, index) => ({
                  id: `e-${index}`,
                  source,
                  target: nodeIds[index + 1]!,
                }));
          const removeIds = new Set(nodeIds.slice(0, Math.min(removeCount, nodeIds.length)));
          const next = removeNodesFromGraph(nodes, edges, removeIds);
          const expectedNodes = nodes.filter((node) => !removeIds.has(node.id));
          const expectedEdges = edges.filter(
            (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
          );
          expect(next.nodes.map((node) => node.id)).toEqual(
            expectedNodes.map((node) => node.id),
          );
          expect(next.edges.map((edge) => edge.id)).toEqual(
            expectedEdges.map((edge) => edge.id),
          );
        },
      ),
    );
  });
});

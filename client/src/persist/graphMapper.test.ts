import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';

import {
  assertReplaceGraphVersion,
  domainGraphToFlow,
  flowToDomainGraph,
  type DomainGraph,
} from './graphMapper';

const idArb = fc.uuid();
const patchIdArb = fc.uuid();

const graphArb: fc.Arbitrary<DomainGraph> = fc
  .tuple(
    fc.uniqueArray(idArb, { minLength: 1, maxLength: 3 }),
    fc.uniqueArray(idArb, { minLength: 1, maxLength: 3 }),
    fc.uniqueArray(idArb, { minLength: 1, maxLength: 3 }),
  )
  .chain(([connectorIds, modulatorIds, oscillatorIds]) => {
    fc.pre(
      new Set([...connectorIds, ...modulatorIds, ...oscillatorIds]).size ===
        connectorIds.length + modulatorIds.length + oscillatorIds.length,
    );
    return patchIdArb.chain((patchId) => {
      const connectors = connectorIds.map((id, index) => ({
        id,
        patchId,
        kindKey: 'usgs_earthquakes',
        label: `C${index}`,
        positionX: index * 10,
        positionY: index * 5,
      }));
      const modulators = modulatorIds.map((id, index) => ({
        id,
        patchId,
        label: `M${index}`,
        positionX: index * 10,
        positionY: 40 + index * 5,
        channelKey: 'mag',
        targetParam: 'frequencyHz',
        inMin: 1,
        inMax: 8,
        outMin: 0.5,
        outMax: 4,
      }));
      const oscillators = oscillatorIds.map((id, index) => ({
        id,
        patchId,
        label: `O${index}`,
        positionX: index * 10,
        positionY: 80 + index * 5,
        waveform: 'sine',
        frequencyHz: 220,
        gain: 0.2,
      }));
      const wirePairs: Array<{ source: string; target: string }> = [];
      const c0 = connectorIds[0];
      const m0 = modulatorIds[0];
      const o0 = oscillatorIds[0];
      if (c0 && m0) wirePairs.push({ source: c0, target: m0 });
      if (m0 && o0) wirePairs.push({ source: m0, target: o0 });
      const wires = wirePairs.map((pair, index) => ({
        id: `wire-${index}`,
        patchId,
        sourceNodeId: pair.source,
        targetNodeId: pair.target,
        sourceHandle: 'out',
        targetHandle: 'in',
      }));
      return fc.constant({ connectors, modulators, oscillators, wires });
    });
  });

describe('graphMapper', () => {
  it('round-trips domain graphs through React Flow nodes and edges', () => {
    fc.assert(
      fc.property(graphArb, (graph) => {
        const patchId = graph.connectors[0]?.patchId ?? graph.modulators[0]?.patchId ?? '';
        const { nodes, edges } = domainGraphToFlow(graph);
        const back = flowToDomainGraph(patchId, nodes, edges);
        expect(back.connectors.map((row) => row.id).sort()).toEqual(
          graph.connectors.map((row) => row.id).sort(),
        );
        expect(back.modulators.map((row) => row.id).sort()).toEqual(
          graph.modulators.map((row) => row.id).sort(),
        );
        expect(back.oscillators.map((row) => row.id).sort()).toEqual(
          graph.oscillators.map((row) => row.id).sort(),
        );
        expect(back.wires.map((row) => row.id).sort()).toEqual(
          graph.wires.map((row) => row.id).sort(),
        );
        for (const osc of back.oscillators) {
          const original = graph.oscillators.find((row) => row.id === osc.id);
          expect(osc.frequencyHz).toBe(original?.frequencyHz);
          expect(osc.gain).toBe(original?.gain);
        }
        for (const mod of back.modulators) {
          const original = graph.modulators.find((row) => row.id === mod.id);
          expect(mod.outMin).toBe(original?.outMin);
          expect(mod.outMax).toBe(original?.outMax);
        }
      }),
    );
  });

  it('keeps wire endpoints equal to flow edge source and target', () => {
    fc.assert(
      fc.property(graphArb, (graph) => {
        const patchId = graph.connectors[0]?.patchId ?? '';
        const { nodes, edges } = domainGraphToFlow(graph);
        const back = flowToDomainGraph(patchId, nodes as Node[], edges as Edge[]);
        for (const wire of back.wires) {
          const edge = edges.find((entry) => entry.id === wire.id);
          expect(wire.sourceNodeId).toBe(edge?.source);
          expect(wire.targetNodeId).toBe(edge?.target);
        }
      }),
    );
  });
});

describe('assertReplaceGraphVersion', () => {
  it('accepts matching versions and rejects mismatched ones', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), fc.integer({ min: 1, max: 10_000 }), (a, b) => {
        const result = assertReplaceGraphVersion(a, b);
        const expectOk = a === b;
        expect(result.ok).toBe(expectOk);
        const reason = result.ok ? undefined : result.reason;
        const expectedReason = expectOk ? undefined : ('conflict' as const);
        expect(reason).toBe(expectedReason);
      }),
    );
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  findModulationChain,
  findVoiceGraph,
  type RuntimeEdge,
  type RuntimeNode,
} from './modulationChain';

const idArb = fc.uuid();

function connector(id: string): RuntimeNode {
  return { id, type: 'connector', data: { kindKey: 'usgs_earthquakes' } };
}

function modulator(
  id: string,
  mapping: {
    channelKey: string;
    targetParam: string;
    inMin: number;
    inMax: number;
    outMin: number;
    outMax: number;
  },
): RuntimeNode {
  return { id, type: 'modulator', data: { ...mapping } };
}

function oscillator(id: string): RuntimeNode {
  return {
    id,
    type: 'oscillator',
    data: { frequencyHz: 220, gain: 0.2, waveform: 'sine' },
  };
}

const mappingArb = fc.record({
  channelKey: fc.constantFrom('mag', 'depthKm', 'sig'),
  targetParam: fc.constantFrom('frequencyHz', 'gain'),
  inMin: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  inMax: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  outMin: fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  outMax: fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
});

describe('findModulationChain', () => {
  it('reports incomplete when the oscillator has no inbound modulator edge', () => {
    fc.assert(
      fc.property(idArb, idArb, mappingArb, (oscId, modId, mapping) => {
        fc.pre(oscId !== modId);
        const nodes = [oscillator(oscId), modulator(modId, mapping)];
        const edges: RuntimeEdge[] = [];
        const result = findModulationChain(nodes, edges, oscId);
        const expectComplete = edges.length > 0;
        expect(result.complete).toBe(expectComplete);
        expect(result.oscillator.id).toBe(oscId);
      }),
    );
  });

  it('reports complete only for Connector → Modulator → Oscillator wiring', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, mappingArb, (connId, modId, oscId, mapping) => {
        fc.pre(new Set([connId, modId, oscId]).size === 3);
        const nodes = [
          connector(connId),
          modulator(modId, mapping),
          oscillator(oscId),
        ];
        const edges: RuntimeEdge[] = [
          { id: `${connId}-${modId}`, source: connId, target: modId },
          { id: `${modId}-${oscId}`, source: modId, target: oscId },
        ];
        const result = findModulationChain(nodes, edges, oscId);
        const expectComplete = true;
        expect(result.complete).toBe(expectComplete);
        expect(result.complete ? result.connector.id : oscId).toBe(connId);
        expect(result.complete ? result.modulator.id : oscId).toBe(modId);
        expect(result.oscillator.id).toBe(oscId);
        expect(result.complete ? result.channelKey : mapping.channelKey).toBe(mapping.channelKey);
        expect(result.complete ? result.targetParam : mapping.targetParam).toBe(mapping.targetParam);
        expect(result.complete ? result.inMin : mapping.inMin).toBe(mapping.inMin);
        expect(result.complete ? result.inMax : mapping.inMax).toBe(mapping.inMax);
        expect(result.complete ? result.outMin : mapping.outMin).toBe(mapping.outMin);
        expect(result.complete ? result.outMax : mapping.outMax).toBe(mapping.outMax);
      }),
    );
  });

  it('stays incomplete when the upstream of the modulator is not a connector', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, mappingArb, (fakeId, modId, oscId, mapping) => {
        fc.pre(new Set([fakeId, modId, oscId]).size === 3);
        const nodes = [
          oscillator(fakeId),
          modulator(modId, mapping),
          oscillator(oscId),
        ];
        const edges: RuntimeEdge[] = [
          { id: `${fakeId}-${modId}`, source: fakeId, target: modId },
          { id: `${modId}-${oscId}`, source: modId, target: oscId },
        ];
        const result = findModulationChain(nodes, edges, oscId);
        const upstreamIsConnector = nodes.find((node) => node.id === fakeId)?.type === 'connector';
        expect(result.complete).toBe(upstreamIsConnector);
      }),
    );
  });

  it('stays complete when Effects sit between Modulator and Oscillator', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        idArb,
        mappingArb,
        (connId, modId, effectId, oscId, mapping) => {
          fc.pre(new Set([connId, modId, effectId, oscId]).size === 4);
          const nodes: RuntimeNode[] = [
            connector(connId),
            modulator(modId, mapping),
            {
              id: effectId,
              type: 'effect',
              data: {
                kindKey: 'scale_snap',
                tonic: 'C',
                scaleKey: 'major',
                enabled: true,
                a4Hz: 440,
              },
            },
            oscillator(oscId),
          ];
          const edges: RuntimeEdge[] = [
            { id: `${connId}-${modId}`, source: connId, target: modId },
            { id: `${modId}-${effectId}`, source: modId, target: effectId },
            { id: `${effectId}-${oscId}`, source: effectId, target: oscId },
          ];
          const result = findModulationChain(nodes, edges, oscId);
          const expectComplete = true;
          expect(result.complete).toBe(expectComplete);
          expect(result.complete ? result.modulator.id : oscId).toBe(modId);
          const expectedEffectIds = nodes
            .filter((node) => node.type === 'effect')
            .map((node) => node.id);
          expect(result.complete ? result.effects.map((node) => node.id) : expectedEffectIds).toEqual(
            expectedEffectIds,
          );
        },
      ),
    );
  });
});

describe('findVoiceGraph', () => {
  it('keeps gain Modulators off the frequency Effect path', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 6, maxLength: 6 }),
        (ids) => {
          const [connF, modF, effectId, oscId, connG, modG] = ids;
          const freqMapping = {
            channelKey: 'mag',
            targetParam: 'frequencyHz',
            inMin: 1,
            inMax: 8,
            outMin: 0.5,
            outMax: 4,
          };
          const gainMapping = {
            channelKey: 'mag',
            targetParam: 'gain',
            inMin: 1,
            inMax: 8,
            outMin: 0,
            outMax: 1,
          };
          const nodes: RuntimeNode[] = [
            connector(connF!),
            modulator(modF!, freqMapping),
            {
              id: effectId!,
              type: 'effect',
              data: {
                kindKey: 'scale_snap',
                tonic: 'C',
                scaleKey: 'major',
                enabled: true,
                a4Hz: 440,
              },
            },
            oscillator(oscId!),
            connector(connG!),
            modulator(modG!, gainMapping),
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: connF!, target: modF! },
            { id: 'b', source: modF!, target: effectId! },
            { id: 'c', source: effectId!, target: oscId! },
            { id: 'd', source: connG!, target: modG! },
            { id: 'e', source: modG!, target: oscId! },
          ];
          const graph = findVoiceGraph(nodes, edges, oscId!);
          const expectedFreqEffectIds = nodes
            .filter((node) => node.type === 'effect')
            .map((node) => node.id);
          const expectedGainEffectIds = nodes
            .filter((node) => node.type === 'effect' && node.id === '')
            .map((node) => node.id);
          expect(graph.frequencyChain?.modulator.id).toBe(modF);
          expect(graph.gainChain?.modulator.id).toBe(modG);
          expect(graph.frequencyEffects.map((effect) => effect.id)).toEqual(
            expectedFreqEffectIds,
          );
          expect(graph.gainChain?.effects.map((node) => node.id) ?? expectedGainEffectIds).toEqual(
            expectedGainEffectIds,
          );
        },
      ),
    );
  });
});

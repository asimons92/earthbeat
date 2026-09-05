import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { RuntimeEdge, RuntimeNode } from './modulationChain';
import { listMonitorStrips } from './monitorStrips';

const idArb = fc.uuid();

function connector(
  id: string,
  kindKey: string,
  interpolate?: boolean,
): RuntimeNode {
  return {
    id,
    type: 'connector',
    data: {
      kindKey,
      ...(interpolate === undefined ? {} : { interpolate }),
    },
  };
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

function stripKey(kindKey: string, channelKey: string): string {
  return `${kindKey}:${channelKey}`;
}

const mappingArb = fc.record({
  channelKey: fc.constantFrom('mag', 'depthKm', 'sig', 'waterLevel'),
  targetParam: fc.constantFrom('frequencyHz', 'gain'),
  inMin: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  inMax: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  outMin: fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
  outMax: fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
});

const kindArb = fc.constantFrom('usgs_earthquakes', 'noaa_coops_tides');

describe('listMonitorStrips', () => {
  it('never includes incomplete chains', () => {
    fc.assert(
      fc.property(idArb, idArb, mappingArb, (oscId, modId, mapping) => {
        fc.pre(oscId !== modId);
        const nodes = [oscillator(oscId), modulator(modId, mapping)];
        const edges: RuntimeEdge[] = [];
        const strips = listMonitorStrips(nodes, edges);
        expect(strips.length).toBe(edges.filter((edge) => edge.target === oscId).length);
      }),
    );
  });

  it('exposes the Modulator channelKey for each complete chain', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        mappingArb,
        kindArb,
        fc.option(fc.boolean(), { nil: undefined }),
        (connId, modId, oscId, mapping, kindKey, interpolate) => {
          fc.pre(new Set([connId, modId, oscId]).size === 3);
          const nodes = [
            connector(connId, kindKey, interpolate),
            modulator(modId, mapping),
            oscillator(oscId),
          ];
          const edges: RuntimeEdge[] = [
            { id: `${connId}-${modId}`, source: connId, target: modId },
            { id: `${modId}-${oscId}`, source: modId, target: oscId },
          ];
          const strips = listMonitorStrips(nodes, edges);
          expect(strips.length).toBe(edges.length / 2);
          expect(strips[0]!.channelKey).toBe(mapping.channelKey);
          expect(strips[0]!.id).toBe(stripKey(kindKey, mapping.channelKey));
          expect(strips[0]!.kindKey).toBe(kindKey);
          expect(strips[0]!.inMin).toBe(mapping.inMin);
          expect(strips[0]!.inMax).toBe(mapping.inMax);
          expect(strips[0]!.interpolate).toBe(
            typeof interpolate === 'boolean' ? interpolate : true,
          );
        },
      ),
    );
  });

  it('still lists Channel strips when Effects sit between Modulator and Oscillator', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        idArb,
        mappingArb,
        kindArb,
        (connId, modId, effectId, oscId, mapping, kindKey) => {
          fc.pre(new Set([connId, modId, effectId, oscId]).size === 4);
          const nodes: RuntimeNode[] = [
            connector(connId, kindKey),
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
          const strips = listMonitorStrips(nodes, edges);
          const expectedId = stripKey(kindKey, mapping.channelKey);
          expect(strips.map((strip) => strip.id)).toEqual([expectedId]);
          expect(strips.map((strip) => strip.channelKey)).toEqual([mapping.channelKey]);
        },
      ),
    );
  });

  it('lists one strip per unique kind and Channel across oscillators', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 6, maxLength: 6 }),
        mappingArb,
        mappingArb,
        (ids, mappingA, mappingB) => {
          const [c1, m1, o1, c2, m2, o2] = ids;
          const nodes = [
            connector(c1!, 'usgs_earthquakes'),
            modulator(m1!, mappingA),
            oscillator(o1!),
            connector(c2!, 'noaa_coops_tides'),
            modulator(m2!, mappingB),
            oscillator(o2!),
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: c1!, target: m1! },
            { id: 'b', source: m1!, target: o1! },
            { id: 'c', source: c2!, target: m2! },
            { id: 'd', source: m2!, target: o2! },
          ];
          const strips = listMonitorStrips(nodes, edges);
          const expectedKeys = new Set([
            stripKey('usgs_earthquakes', mappingA.channelKey),
            stripKey('noaa_coops_tides', mappingB.channelKey),
          ]);
          expect(new Set(strips.map((strip) => strip.id))).toEqual(expectedKeys);
          expect(strips.length).toBe(expectedKeys.size);
        },
      ),
    );
  });

  it('collapses duplicate kind and Channel chains to one strip', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 6, maxLength: 6 }),
        mappingArb,
        kindArb,
        (ids, mapping, kindKey) => {
          const [c1, m1, o1, c2, m2, o2] = ids;
          const mappingB = { ...mapping, targetParam: 'gain' as const };
          const nodes = [
            connector(c1!, kindKey),
            modulator(m1!, mapping),
            oscillator(o1!),
            connector(c2!, kindKey),
            modulator(m2!, mappingB),
            oscillator(o2!),
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: c1!, target: m1! },
            { id: 'b', source: m1!, target: o1! },
            { id: 'c', source: c2!, target: m2! },
            { id: 'd', source: m2!, target: o2! },
          ];
          const strips = listMonitorStrips(nodes, edges);
          const expectedId = stripKey(kindKey, mapping.channelKey);
          expect(strips.map((strip) => strip.id)).toEqual([expectedId]);
        },
      ),
    );
  });

  it('keeps separate strips when the same kind uses different Channels', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 6, maxLength: 6 }),
        mappingArb,
        mappingArb,
        kindArb,
        (ids, mappingA, mappingB, kindKey) => {
          fc.pre(mappingA.channelKey !== mappingB.channelKey);
          const [c1, m1, o1, c2, m2, o2] = ids;
          const nodes = [
            connector(c1!, kindKey),
            modulator(m1!, mappingA),
            oscillator(o1!),
            connector(c2!, kindKey),
            modulator(m2!, mappingB),
            oscillator(o2!),
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: c1!, target: m1! },
            { id: 'b', source: m1!, target: o1! },
            { id: 'c', source: c2!, target: m2! },
            { id: 'd', source: m2!, target: o2! },
          ];
          const strips = listMonitorStrips(nodes, edges);
          const expectedKeys = new Set([
            stripKey(kindKey, mappingA.channelKey),
            stripKey(kindKey, mappingB.channelKey),
          ]);
          expect(new Set(strips.map((strip) => strip.id))).toEqual(expectedKeys);
          expect(strips.length).toBe(expectedKeys.size);
        },
      ),
    );
  });

  it('keeps first-wins Smooth and scale when kind and Channel collide', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(idArb, { minLength: 6, maxLength: 6 }),
        mappingArb,
        mappingArb,
        kindArb,
        fc.boolean(),
        fc.boolean(),
        (ids, mappingA, mappingB, kindKey, interpolateA, interpolateB) => {
          fc.pre(mappingA.channelKey === mappingB.channelKey);
          fc.pre(
            mappingA.inMin !== mappingB.inMin ||
              mappingA.inMax !== mappingB.inMax ||
              interpolateA !== interpolateB,
          );
          const [c1, m1, o1, c2, m2, o2] = ids;
          const nodes = [
            connector(c1!, kindKey, interpolateA),
            modulator(m1!, mappingA),
            oscillator(o1!),
            connector(c2!, kindKey, interpolateB),
            modulator(m2!, mappingB),
            oscillator(o2!),
          ];
          const edges: RuntimeEdge[] = [
            { id: 'a', source: c1!, target: m1! },
            { id: 'b', source: m1!, target: o1! },
            { id: 'c', source: c2!, target: m2! },
            { id: 'd', source: m2!, target: o2! },
          ];
          const strips = listMonitorStrips(nodes, edges);
          const expectedId = stripKey(kindKey, mappingA.channelKey);
          expect(strips.map((strip) => strip.id)).toEqual([expectedId]);
          expect(strips[0]!.inMin).toBe(mappingA.inMin);
          expect(strips[0]!.inMax).toBe(mappingA.inMax);
          expect(strips[0]!.interpolate).toBe(interpolateA);
          expect(strips[0]!.connectorId).toBe(c1!);
          expect(strips[0]!.oscillatorId).toBe(o1!);
        },
      ),
    );
  });
});

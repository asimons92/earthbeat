import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { AudioFxStep } from './audioFxChain';
import { applyEffectModulationToSteps } from './resolveEffectModulation';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';

const idArb = fc.uuid();
const magArb = fc.double({ min: 1, max: 8, noNaN: true });
const gateOutArb = fc.double({ min: 0, max: 1, noNaN: true });

describe('applyEffectModulationToSteps', () => {
  it('leaves resting steps unchanged when no mod-handle Modulator wires exist', () => {
    fc.assert(
      fc.property(idArb, idArb, magArb, (effectId, otherId, gate) => {
        fc.pre(effectId !== otherId);
        const steps: AudioFxStep[] = [
          {
            id: effectId,
            kind: 'adsr',
            enabled: true,
            attackSec: 0.005,
            decaySec: 0.15,
            sustain: 0,
            releaseSec: 0.05,
            gate,
          },
        ];
        const nodes: RuntimeNode[] = [
          {
            id: effectId,
            type: 'effect',
            data: { kindKey: 'adsr', gate },
          },
        ];
        const edges: RuntimeEdge[] = [
          {
            id: 'signal',
            source: otherId,
            target: effectId,
            targetHandle: 'in',
          },
        ];
        const next = applyEffectModulationToSteps(steps, nodes, edges, {});
        expect(next).toEqual(steps);
      }),
    );
  });

  it('maps only the targeted ADSR gate from a complete Connector → Modulator → Effect mod chain', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        magArb,
        gateOutArb,
        gateOutArb,
        (connId, modId, effectId, mag, outMin, outMax) => {
          fc.pre(new Set([connId, modId, effectId]).size === 3);
          fc.pre(outMin !== outMax);
          const restingGate = 0;
          const restingAttack = 0.005;
          const steps: AudioFxStep[] = [
            {
              id: effectId,
              kind: 'adsr',
              enabled: true,
              attackSec: restingAttack,
              decaySec: 0.15,
              sustain: 0,
              releaseSec: 0.05,
              gate: restingGate,
            },
          ];
          const nodes: RuntimeNode[] = [
            {
              id: connId,
              type: 'connector',
              data: { kindKey: 'usgs_earthquakes' },
            },
            {
              id: modId,
              type: 'modulator',
              data: {
                channelKey: 'mag',
                targetParam: 'gate',
                inMin: 1,
                inMax: 8,
                outMin,
                outMax,
              },
            },
            {
              id: effectId,
              type: 'effect',
              data: { kindKey: 'adsr' },
            },
          ];
          const edges: RuntimeEdge[] = [
            { id: 'c-m', source: connId, target: modId, targetHandle: 'in' },
            {
              id: 'm-e',
              source: modId,
              target: effectId,
              targetHandle: 'mod',
            },
          ];
          const samples = {
            [connId]: {
              kindKey: 'usgs_earthquakes' as const,
              id: 'evt',
              mag,
              depthKm: 10,
              sig: 100,
              place: 'test',
              time: 1,
            },
          };
          const next = applyEffectModulationToSteps(steps, nodes, edges, samples);
          const step = next[0];
          const resting = steps[0];
          expect(step?.kind).toBe(resting?.kind);
          if (step?.kind !== 'adsr' || resting?.kind !== 'adsr') return;
          expect(step.attackSec).toBe(resting.attackSec);
          const t = Math.min(1, Math.max(0, (mag - 1) / (8 - 1)));
          const expectedGate = outMin + t * (outMax - outMin);
          expect(step.gate).toBeCloseTo(expectedGate, 10);
        },
      ),
    );
  });

  it('ignores a Modulator target param that does not belong to the Effect kind', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, magArb, (connId, modId, effectId, mag) => {
        fc.pre(new Set([connId, modId, effectId]).size === 3);
        const restingCutoff = 1000;
        const steps: AudioFxStep[] = [
          {
            id: effectId,
            kind: 'lowpass',
            enabled: true,
            cutoffHz: restingCutoff,
            q: 0.707,
          },
        ];
        const nodes: RuntimeNode[] = [
          {
            id: connId,
            type: 'connector',
            data: { kindKey: 'usgs_earthquakes' },
          },
          {
            id: modId,
            type: 'modulator',
            data: {
              channelKey: 'mag',
              targetParam: 'gate',
              inMin: 1,
              inMax: 8,
              outMin: 0,
              outMax: 1,
            },
          },
          {
            id: effectId,
            type: 'effect',
            data: { kindKey: 'lowpass' },
          },
        ];
        const edges: RuntimeEdge[] = [
          { id: 'c-m', source: connId, target: modId },
          {
            id: 'm-e',
            source: modId,
            target: effectId,
            targetHandle: 'mod',
          },
        ];
        const samples = {
          [connId]: {
            kindKey: 'usgs_earthquakes' as const,
            id: 'evt',
            mag,
            depthKm: 10,
            sig: 100,
            place: 'test',
            time: 1,
          },
        };
        const next = applyEffectModulationToSteps(steps, nodes, edges, samples);
        expect(next[0]).toEqual(steps[0]);
      }),
    );
  });
});

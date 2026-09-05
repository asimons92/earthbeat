import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { effectKinds } from '@/generated/catalog';

import {
  audioFxFailureLabel,
  audioFxFingerprint,
  audioFxIssueLabelsByNodeId,
  isAudioEffectKindKey,
  resolveOutboundAudioFxChain,
  type AudioFxStep,
} from './audioFxChain';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';

const idArb = fc.uuid();
const fanInReason = 'fan_in' as const;
const fanOutReason = 'fan_out' as const;

function oscillator(id: string): RuntimeNode {
  return {
    id,
    type: 'oscillator',
    data: { frequencyHz: 220, gain: 0.2, waveform: 'sine' },
  };
}

function scaleSnap(id: string): RuntimeNode {
  return {
    id,
    type: 'effect',
    data: {
      kindKey: 'scale_snap',
      tonic: 'C',
      scaleKey: 'major',
      enabled: true,
      a4Hz: 440,
    },
  };
}

function distortion(id: string, drive: number, enabled = true): RuntimeNode {
  return {
    id,
    type: 'effect',
    data: { kindKey: 'distortion', enabled, drive },
  };
}

function delay(
  id: string,
  params: { timeMs: number; feedback: number; mix: number; enabled?: boolean },
): RuntimeNode {
  return {
    id,
    type: 'effect',
    data: {
      kindKey: 'delay',
      enabled: params.enabled !== false,
      timeMs: params.timeMs,
      feedback: params.feedback,
      mix: params.mix,
    },
  };
}

const driveArb = fc.double({ min: 1, max: 20, noNaN: true });
const timeMsArb = fc.double({ min: 20, max: 1000, noNaN: true });
const feedbackArb = fc.double({ min: 0, max: 0.95, noNaN: true });
const mixArb = fc.double({ min: 0, max: 1, noNaN: true });
const catalogKindArb = fc.constantFrom(...effectKinds);

describe('isAudioEffectKindKey', () => {
  it('matches the catalog transforms audio flag for every EffectKind', () => {
    fc.assert(
      fc.property(catalogKindArb, (kind) => {
        const expectAudio = kind.transforms.some((entry) => entry === 'audio');
        expect(isAudioEffectKindKey(kind.key)).toBe(expectAudio);
      }),
    );
  });

  it('rejects kind keys missing from the catalog', () => {
    fc.assert(
      fc.property(fc.uuid(), (kindKey) => {
        fc.pre(!effectKinds.some((kind) => kind.key === kindKey));
        expect(isAudioEffectKindKey(kindKey)).toBe(isAudioEffectKindKey(''));
      }),
    );
  });
});

describe('resolveOutboundAudioFxChain', () => {
  it('returns an empty chain when the Oscillator has no outbound audio Effects', () => {
    fc.assert(
      fc.property(idArb, idArb, (oscId, snapId) => {
        fc.pre(oscId !== snapId);
        const nodes = [oscillator(oscId), scaleSnap(snapId)];
        const edges: RuntimeEdge[] = [
          { id: `${snapId}-${oscId}`, source: snapId, target: oscId },
        ];
        const result = resolveOutboundAudioFxChain(nodes, edges, oscId);
        const expectOk = nodes.some((node) => node.id === oscId && node.type === 'oscillator');
        expect(result.ok).toBe(expectOk);
        const expectedIds = edges
          .filter((edge) => edge.source === oscId)
          .map((edge) => edge.target);
        expect(result.ok ? result.steps.map((step) => step.id) : expectedIds).toEqual(expectedIds);
      }),
    );
  });

  it('walks Oscillator to Distortion to Delay in source-to-sink order', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        idArb,
        driveArb,
        timeMsArb,
        feedbackArb,
        mixArb,
        (oscId, distId, delayId, drive, timeMs, feedback, mix) => {
          fc.pre(new Set([oscId, distId, delayId]).size === 3);
          const nodes = [
            oscillator(oscId),
            distortion(distId, drive),
            delay(delayId, { timeMs, feedback, mix }),
          ];
          const edges: RuntimeEdge[] = [
            { id: `${oscId}-${distId}`, source: oscId, target: distId },
            { id: `${distId}-${delayId}`, source: distId, target: delayId },
          ];
          const result = resolveOutboundAudioFxChain(nodes, edges, oscId);
          const expectOk = edges.length > 1;
          const expectedIds = [distId, delayId];
          const expectedKinds = [
            String(nodes.find((node) => node.id === distId)!.data.kindKey),
            String(nodes.find((node) => node.id === delayId)!.data.kindKey),
          ];
          expect(result.ok).toBe(expectOk);
          expect(result.ok ? result.steps.map((step) => step.id) : expectedIds).toEqual(
            expectedIds,
          );
          expect(result.ok ? result.steps.map((step) => step.kind) : expectedKinds).toEqual(
            expectedKinds,
          );
        },
      ),
    );
  });

  it('ignores control Effects on the outbound walk', () => {
    fc.assert(
      fc.property(idArb, idArb, (oscId, snapId) => {
        fc.pre(oscId !== snapId);
        const nodes = [oscillator(oscId), scaleSnap(snapId)];
        const edges: RuntimeEdge[] = [
          { id: `${oscId}-${snapId}`, source: oscId, target: snapId },
        ];
        const result = resolveOutboundAudioFxChain(nodes, edges, oscId);
        const expectOk = true;
        const expectedIds = edges
          .filter((edge) => {
            const target = nodes.find((node) => node.id === edge.target);
            return (
              edge.source === oscId &&
              target &&
              isAudioEffectKindKey(String(target.data.kindKey))
            );
          })
          .map((edge) => edge.target);
        expect(result.ok).toBe(expectOk);
        expect(result.ok ? result.steps.map((step) => step.id) : expectedIds).toEqual(expectedIds);
      }),
    );
  });

  it('rejects fan-in into an audio Effect', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, driveArb, (oscA, oscB, distId, drive) => {
        fc.pre(new Set([oscA, oscB, distId]).size === 3);
        const nodes = [oscillator(oscA), oscillator(oscB), distortion(distId, drive)];
        const edges: RuntimeEdge[] = [
          { id: `${oscA}-${distId}`, source: oscA, target: distId },
          { id: `${oscB}-${distId}`, source: oscB, target: distId },
        ];
        const result = resolveOutboundAudioFxChain(nodes, edges, oscA);
        const expectOk = false;
        expect(result.ok).toBe(expectOk);
        expect(result.ok ? '' : result.reason).toBe(result.ok ? '' : fanInReason);
      }),
    );
  });

  it('rejects fan-out from the Oscillator to two audio Effects', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, driveArb, timeMsArb, (oscId, distId, delayId, drive, timeMs) => {
        fc.pre(new Set([oscId, distId, delayId]).size === 3);
        const nodes = [
          oscillator(oscId),
          distortion(distId, drive),
          delay(delayId, { timeMs, feedback: 0.35, mix: 0.35 }),
        ];
        const edges: RuntimeEdge[] = [
          { id: `${oscId}-${distId}`, source: oscId, target: distId },
          { id: `${oscId}-${delayId}`, source: oscId, target: delayId },
        ];
        const result = resolveOutboundAudioFxChain(nodes, edges, oscId);
        const expectOk = false;
        expect(result.ok).toBe(expectOk);
        expect(result.ok ? '' : result.reason).toBe(result.ok ? '' : fanOutReason);
      }),
    );
  });
});

describe('audioFxIssueLabelsByNodeId', () => {
  it('labels the Oscillator and both Effects on fan-out with the failure status', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, driveArb, timeMsArb, (oscId, distId, delayId, drive, timeMs) => {
        fc.pre(new Set([oscId, distId, delayId]).size === 3);
        const nodes = [
          oscillator(oscId),
          distortion(distId, drive),
          delay(delayId, { timeMs, feedback: 0.35, mix: 0.35 }),
        ];
        const edges: RuntimeEdge[] = [
          { id: `${oscId}-${distId}`, source: oscId, target: distId },
          { id: `${oscId}-${delayId}`, source: oscId, target: delayId },
        ];
        const labels = audioFxIssueLabelsByNodeId(nodes, edges);
        const expected = audioFxFailureLabel(fanOutReason);
        expect(labels.get(oscId)).toBe(expected);
        expect(labels.get(distId)).toBe(expected);
        expect(labels.get(delayId)).toBe(expected);
      }),
    );
  });

  it('omits labels when the outbound audio chain is legal', () => {
    fc.assert(
      fc.property(idArb, idArb, driveArb, (oscId, distId, drive) => {
        fc.pre(oscId !== distId);
        const nodes = [oscillator(oscId), distortion(distId, drive)];
        const edges: RuntimeEdge[] = [
          { id: `${oscId}-${distId}`, source: oscId, target: distId },
        ];
        const labels = audioFxIssueLabelsByNodeId(nodes, edges);
        expect(labels.size).toBe(audioFxIssueLabelsByNodeId(nodes, []).size);
      }),
    );
  });
});

describe('audioFxFingerprint', () => {
  it('changes when a step param or enable flag changes', () => {
    fc.assert(
      fc.property(idArb, driveArb, driveArb, (id, driveA, driveB) => {
        fc.pre(driveA !== driveB);
        const stepA: AudioFxStep = {
          id,
          kind: 'distortion',
          enabled: true,
          drive: driveA,
        };
        const stepB: AudioFxStep = { ...stepA, drive: driveB };
        const stepOff: AudioFxStep = { ...stepA, enabled: false };
        expect(audioFxFingerprint([stepA])).not.toBe(audioFxFingerprint([stepB]));
        expect(audioFxFingerprint([stepA])).not.toBe(audioFxFingerprint([stepOff]));
      }),
    );
  });

  it('is empty for an empty chain', () => {
    const emptySteps: AudioFxStep[] = [];
    const alsoEmpty: AudioFxStep[] = [];
    expect(audioFxFingerprint(emptySteps)).toBe(audioFxFingerprint(alsoEmpty));
  });
});

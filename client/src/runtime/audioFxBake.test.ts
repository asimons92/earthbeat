import { el, isNode } from '@elemaudio/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyAudioFxChain } from './audioFxBake';
import type { AudioFxStep } from './audioFxChain';
import {
  clampDrive,
  clampFeedback,
  DRIVE_MAX,
  DRIVE_MIN,
  FEEDBACK_MAX,
  FEEDBACK_MIN,
} from './audioFxParams';
import { elemNodeHash } from './oscillatorTone';

const dryTone = el.const({ key: 'dry-marker', value: 0.5 });

const driveArb = fc.double({ min: DRIVE_MIN, max: DRIVE_MAX, noNaN: true });
const timeMsArb = fc.double({ min: 20, max: 1000, noNaN: true });
const feedbackArb = fc.double({ min: FEEDBACK_MIN, max: FEEDBACK_MAX, noNaN: true });
const mixArb = fc.double({ min: 0, max: 1, noNaN: true });
const idArb = fc.uuid();

describe('clampDrive / clampFeedback', () => {
  it('clamps drive into the legal range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (raw) => {
        const clamped = clampDrive(raw);
        expect(clamped).toBeGreaterThanOrEqual(DRIVE_MIN);
        expect(clamped).toBeLessThanOrEqual(DRIVE_MAX);
      }),
    );
  });

  it('clamps feedback into the legal range', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: -1e6, max: 1e6 }), (raw) => {
        const clamped = clampFeedback(raw);
        expect(clamped).toBeGreaterThanOrEqual(FEEDBACK_MIN);
        expect(clamped).toBeLessThanOrEqual(FEEDBACK_MAX);
      }),
    );
  });
});

describe('applyAudioFxChain', () => {
  it('leaves the dry tone hash when the chain is empty or fully bypassed', () => {
    fc.assert(
      fc.property(idArb, driveArb, (id, drive) => {
        const dryHash = elemNodeHash(dryTone);
        const emptyHash = elemNodeHash(applyAudioFxChain(dryTone, []));
        const bypassed: AudioFxStep[] = [
          { id, kind: 'distortion', enabled: false, drive },
        ];
        const bypassHash = elemNodeHash(applyAudioFxChain(dryTone, bypassed));
        expect(emptyHash).toBe(dryHash);
        expect(bypassHash).toBe(dryHash);
      }),
    );
  });

  it('changes the dry tone when Distortion is enabled at typical Oscillator gain', () => {
    fc.assert(
      fc.property(idArb, driveArb, fc.double({ min: 0.05, max: 0.5, noNaN: true }), (id, drive, gain) => {
        const dry = el.mul(gain, dryTone);
        const step: AudioFxStep = { id, kind: 'distortion', enabled: true, drive };
        const wetHash = elemNodeHash(applyAudioFxChain(dry, [step]));
        const dryHash = elemNodeHash(dry);
        expect(wetHash).not.toBe(dryHash);
      }),
    );
  });

  it('changes the tone hash when drive changes on an enabled Distortion', () => {
    fc.assert(
      fc.property(idArb, driveArb, driveArb, (id, driveA, driveB) => {
        fc.pre(clampDrive(driveA) !== clampDrive(driveB));
        const stepA: AudioFxStep = { id, kind: 'distortion', enabled: true, drive: driveA };
        const stepB: AudioFxStep = { id, kind: 'distortion', enabled: true, drive: driveB };
        const hashA = elemNodeHash(applyAudioFxChain(dryTone, [stepA]));
        const hashB = elemNodeHash(applyAudioFxChain(dryTone, [stepB]));
        expect(hashA).not.toBe(hashB);
        expect(isNode(applyAudioFxChain(dryTone, [stepA]))).toBe(isNode(dryTone));
      }),
    );
  });

  it('changes the tone hash when delay time, feedback, or mix changes', () => {
    fc.assert(
      fc.property(
        idArb,
        timeMsArb,
        timeMsArb,
        feedbackArb,
        mixArb,
        (id, timeA, timeB, feedback, mix) => {
          fc.pre(timeA !== timeB);
          const base: AudioFxStep = {
            id,
            kind: 'delay',
            enabled: true,
            timeMs: timeA,
            feedback,
            mix,
          };
          const other: AudioFxStep = { ...base, timeMs: timeB };
          expect(elemNodeHash(applyAudioFxChain(dryTone, [base]))).not.toBe(
            elemNodeHash(applyAudioFxChain(dryTone, [other])),
          );
        },
      ),
    );
  });

  it('makes Distortion-then-Delay order matter for the graph hash', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        driveArb,
        timeMsArb,
        feedbackArb,
        mixArb,
        (distId, delayId, drive, timeMs, feedback, mix) => {
          fc.pre(distId !== delayId);
          const dist: AudioFxStep = {
            id: distId,
            kind: 'distortion',
            enabled: true,
            drive,
          };
          const del: AudioFxStep = {
            id: delayId,
            kind: 'delay',
            enabled: true,
            timeMs,
            feedback,
            mix,
          };
          const forward = elemNodeHash(applyAudioFxChain(dryTone, [dist, del]));
          const reverse = elemNodeHash(applyAudioFxChain(dryTone, [del, dist]));
          expect(forward).not.toBe(reverse);
        },
      ),
    );
  });
});

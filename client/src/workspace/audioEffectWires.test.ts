import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  canConnectPatchNodes,
  effectRoleFromTransforms,
  type PatchWireRole,
} from './patchWireRules';

const roles = [
  'connector',
  'modulator',
  'oscillator',
  'control_effect',
  'audio_effect',
] as const satisfies readonly PatchWireRole[];

const roleArb = fc.constantFrom(...roles);
const allowed = true;
const denied = false;

describe('effectRoleFromTransforms', () => {
  it('maps audio transform to audio_effect and anything else to control_effect', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasAudio) => {
        const transforms = hasAudio ? (['audio'] as const) : (['frequencyHz'] as const);
        const expected = hasAudio ? 'audio_effect' : 'control_effect';
        expect(effectRoleFromTransforms(transforms)).toBe(expected);
      }),
    );
  });
});

describe('canConnectPatchNodes', () => {
  it('allows Oscillator to audio Effect when the target has no inbound and source has no audio outbound', () => {
    fc.assert(
      fc.property(fc.constant(0), fc.constant(0), (inbound, outbound) => {
        expect(
          canConnectPatchNodes({
            sourceRole: 'oscillator',
            targetRole: 'audio_effect',
            targetInboundCount: inbound,
            sourceAudioOutboundCount: outbound,
          }),
        ).toBe(allowed);
      }),
    );
  });

  it('allows audio Effect to audio Effect on a free target with no prior audio outbound', () => {
    const fromAudio = canConnectPatchNodes({
      sourceRole: 'audio_effect',
      targetRole: 'audio_effect',
      targetInboundCount: 0,
      sourceAudioOutboundCount: 0,
    });
    const fromOsc = canConnectPatchNodes({
      sourceRole: 'oscillator',
      targetRole: 'audio_effect',
      targetInboundCount: 0,
      sourceAudioOutboundCount: 0,
    });
    expect(fromAudio).toBe(fromOsc);
  });

  it('rejects a second inbound into an audio Effect', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('oscillator', 'audio_effect') as fc.Arbitrary<PatchWireRole>,
        fc.integer({ min: 1, max: 8 }),
        (sourceRole, inbound) => {
          expect(
            canConnectPatchNodes({
              sourceRole,
              targetRole: 'audio_effect',
              targetInboundCount: inbound,
              sourceAudioOutboundCount: 0,
            }),
          ).toBe(denied);
        },
      ),
    );
  });

  it('rejects audio Effect into Oscillator and Oscillator into control Effect', () => {
    const audioIntoOsc = canConnectPatchNodes({
      sourceRole: 'audio_effect',
      targetRole: 'oscillator',
      targetInboundCount: 0,
      sourceAudioOutboundCount: 0,
    });
    const oscIntoControl = canConnectPatchNodes({
      sourceRole: 'oscillator',
      targetRole: 'control_effect',
      targetInboundCount: 0,
      sourceAudioOutboundCount: 0,
    });
    expect(audioIntoOsc).toBe(denied);
    expect(oscIntoControl).toBe(denied);
  });

  it('rejects Connector or Modulator into an audio Effect', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('connector', 'modulator') as fc.Arbitrary<PatchWireRole>,
        (sourceRole) => {
          expect(
            canConnectPatchNodes({
              sourceRole,
              targetRole: 'audio_effect',
              targetInboundCount: 0,
              sourceAudioOutboundCount: 0,
            }),
          ).toBe(denied);
        },
      ),
    );
  });

  it('keeps the control path from Modulator and control Effect into Oscillator', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('modulator', 'control_effect') as fc.Arbitrary<PatchWireRole>,
        (sourceRole) => {
          expect(
            canConnectPatchNodes({
              sourceRole,
              targetRole: 'oscillator',
              targetInboundCount: 0,
              sourceAudioOutboundCount: 0,
            }),
          ).toBe(allowed);
        },
      ),
    );
  });

  it('never allows an audio Effect as a source into a non-audio target', () => {
    fc.assert(
      fc.property(
        roleArb.filter((role) => role !== 'audio_effect'),
        (targetRole) => {
          expect(
            canConnectPatchNodes({
              sourceRole: 'audio_effect',
              targetRole,
              targetInboundCount: 0,
              sourceAudioOutboundCount: 0,
            }),
          ).toBe(denied);
        },
      ),
    );
  });
});

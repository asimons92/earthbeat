import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  canConnectPatchNodes,
  effectRoleFromTransforms,
  isModTargetHandle,
  resolvePatchWireHandle,
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

const emptySignal = {
  targetSignalInboundCount: 0,
  targetModInboundCount: 0,
  sourceAudioOutboundCount: 0,
} as const;

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

describe('resolvePatchWireHandle / isModTargetHandle', () => {
  it('treats only the literal mod handle as modulation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, 'in', 'out', 'mod', 'MOD', '') as fc.Arbitrary<
          string | null | undefined
        >,
        (handle) => {
          const resolved = resolvePatchWireHandle(handle);
          expect(resolved === 'mod').toBe(handle === 'mod');
          expect(isModTargetHandle(handle)).toBe(handle === 'mod');
        },
      ),
    );
  });
});

describe('canConnectPatchNodes', () => {
  it('allows Oscillator to audio Effect when the signal target is free and source has no audio outbound', () => {
    fc.assert(
      fc.property(fc.nat({ max: 8 }), (modInbound) => {
        expect(
          canConnectPatchNodes({
            sourceRole: 'oscillator',
            targetRole: 'audio_effect',
            targetSignalInboundCount: 0,
            targetModInboundCount: modInbound,
            sourceAudioOutboundCount: 0,
            targetHandle: 'in',
          }),
        ).toBe(allowed);
      }),
    );
  });

  it('allows audio Effect to audio Effect on a free signal target with no prior audio outbound', () => {
    const fromAudio = canConnectPatchNodes({
      sourceRole: 'audio_effect',
      targetRole: 'audio_effect',
      ...emptySignal,
      targetHandle: 'in',
    });
    const fromOsc = canConnectPatchNodes({
      sourceRole: 'oscillator',
      targetRole: 'audio_effect',
      ...emptySignal,
      targetHandle: 'in',
    });
    expect(fromAudio).toBe(fromOsc);
  });

  it('rejects a second signal inbound into an audio Effect', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('oscillator', 'audio_effect') as fc.Arbitrary<PatchWireRole>,
        fc.integer({ min: 1, max: 8 }),
        fc.nat({ max: 4 }),
        (sourceRole, signalInbound, modInbound) => {
          expect(
            canConnectPatchNodes({
              sourceRole,
              targetRole: 'audio_effect',
              targetSignalInboundCount: signalInbound,
              targetModInboundCount: modInbound,
              sourceAudioOutboundCount: 0,
              targetHandle: 'in',
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
      ...emptySignal,
    });
    const oscIntoControl = canConnectPatchNodes({
      sourceRole: 'oscillator',
      targetRole: 'control_effect',
      ...emptySignal,
    });
    expect(audioIntoOsc).toBe(denied);
    expect(oscIntoControl).toBe(denied);
  });

  it('rejects Connector into an audio Effect on either handle', () => {
    fc.assert(
      fc.property(fc.constantFrom('in', 'mod', null) as fc.Arbitrary<string | null>, (handle) => {
        expect(
          canConnectPatchNodes({
            sourceRole: 'connector',
            targetRole: 'audio_effect',
            ...emptySignal,
            targetHandle: handle,
          }),
        ).toBe(denied);
      }),
    );
  });

  it('rejects Modulator into an audio Effect on the signal handle', () => {
    expect(
      canConnectPatchNodes({
        sourceRole: 'modulator',
        targetRole: 'audio_effect',
        ...emptySignal,
        targetHandle: 'in',
      }),
    ).toBe(denied);
  });

  it('allows Modulator into audio or control Effect on the mod handle even when signal inbound is taken', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('audio_effect', 'control_effect') as fc.Arbitrary<PatchWireRole>,
        fc.nat({ max: 3 }),
        fc.nat({ max: 3 }),
        (targetRole, signalInbound, modInbound) => {
          expect(
            canConnectPatchNodes({
              sourceRole: 'modulator',
              targetRole,
              targetSignalInboundCount: signalInbound,
              targetModInboundCount: modInbound,
              sourceAudioOutboundCount: 0,
              targetHandle: 'mod',
            }),
          ).toBe(allowed);
        },
      ),
    );
  });

  it('rejects non-Modulator sources on the mod handle', () => {
    fc.assert(
      fc.property(
        roleArb.filter((role) => role !== 'modulator'),
        fc.constantFrom('audio_effect', 'control_effect') as fc.Arbitrary<PatchWireRole>,
        (sourceRole, targetRole) => {
          expect(
            canConnectPatchNodes({
              sourceRole,
              targetRole,
              ...emptySignal,
              targetHandle: 'mod',
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
              ...emptySignal,
              targetHandle: 'in',
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
              ...emptySignal,
              targetHandle: 'in',
            }),
          ).toBe(denied);
        },
      ),
    );
  });

  it('signal inbound occupancy is independent of mod inbound occupancy', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), (modInbound) => {
        const signalFree = canConnectPatchNodes({
          sourceRole: 'oscillator',
          targetRole: 'audio_effect',
          targetSignalInboundCount: 0,
          targetModInboundCount: modInbound,
          sourceAudioOutboundCount: 0,
          targetHandle: 'in',
        });
        const signalTaken = canConnectPatchNodes({
          sourceRole: 'oscillator',
          targetRole: 'audio_effect',
          targetSignalInboundCount: 1,
          targetModInboundCount: modInbound,
          sourceAudioOutboundCount: 0,
          targetHandle: 'in',
        });
        expect(signalFree).toBe(allowed);
        expect(signalTaken).toBe(denied);
      }),
    );
  });
});

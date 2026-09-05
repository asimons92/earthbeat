/**
 * Pure connection rules for control Effects (into Oscillator) and audio Effects (after Oscillator).
 */

export type PatchWireRole =
  | 'connector'
  | 'modulator'
  | 'oscillator'
  | 'control_effect'
  | 'audio_effect';

export type CanConnectPatchArgs = {
  sourceRole: PatchWireRole;
  targetRole: PatchWireRole;
  /** Existing inbound wire count on the target (before this connection). */
  targetInboundCount: number;
  /** Existing outbound wires from the source into audio Effects (before this connection). */
  sourceAudioOutboundCount: number;
};

/**
 * Whether a new wire is legal.
 * Audio Effects allow one inbound and form a single linear chain from one Oscillator.
 */
export function canConnectPatchNodes(args: CanConnectPatchArgs): boolean {
  const { sourceRole, targetRole, targetInboundCount, sourceAudioOutboundCount } = args;

  if (targetRole === 'audio_effect' && targetInboundCount > 0) {
    return false;
  }

  if (targetRole === 'audio_effect') {
    if (sourceRole === 'oscillator') {
      return sourceAudioOutboundCount === 0;
    }
    if (sourceRole === 'audio_effect') {
      return sourceAudioOutboundCount === 0;
    }
    return false;
  }

  if (sourceRole === 'audio_effect') {
    return false;
  }

  if (sourceRole === 'oscillator') {
    return false;
  }

  if (sourceRole === 'control_effect') {
    return targetRole === 'control_effect' || targetRole === 'oscillator';
  }

  if (sourceRole === 'modulator') {
    return (
      targetRole === 'oscillator' ||
      targetRole === 'control_effect' ||
      targetRole === 'modulator'
    );
  }

  if (sourceRole === 'connector') {
    return targetRole === 'modulator';
  }

  return false;
}

export function effectRoleFromTransforms(transforms: readonly unknown[]): 'control_effect' | 'audio_effect' {
  if (transforms.some((entry) => entry === 'audio')) {
    return 'audio_effect';
  }
  return 'control_effect';
}

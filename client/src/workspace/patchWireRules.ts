/**
 * Pure connection rules for control Effects (into Oscillator), audio Effects (after Oscillator),
 * and Modulator → Effect mod wires (separate from the signal path).
 */

export type PatchWireRole =
  | 'connector'
  | 'modulator'
  | 'oscillator'
  | 'control_effect'
  | 'audio_effect';

/** Signal path uses handle `in`. Modulation uses handle `mod`. */
export type PatchWireHandle = 'in' | 'mod';

export type CanConnectPatchArgs = {
  sourceRole: PatchWireRole;
  targetRole: PatchWireRole;
  /** Existing signal (`in`) inbound count on the target before this connection. */
  targetSignalInboundCount: number;
  /** Existing mod inbound count on the target before this connection. */
  targetModInboundCount: number;
  /** Existing outbound wires from the source into audio Effects on the signal path. */
  sourceAudioOutboundCount: number;
  /** Target handle for the new wire. Missing or unknown treats as signal `in`. */
  targetHandle?: string | null;
};

export function resolvePatchWireHandle(targetHandle?: string | null): PatchWireHandle {
  return targetHandle === 'mod' ? 'mod' : 'in';
}

/**
 * Whether a new wire is legal.
 * Audio Effects allow one signal inbound and form a single linear chain from one Oscillator.
 * Modulators may wire into Effect `mod` without consuming that signal slot.
 */
export function canConnectPatchNodes(args: CanConnectPatchArgs): boolean {
  const {
    sourceRole,
    targetRole,
    targetSignalInboundCount,
    sourceAudioOutboundCount,
    targetHandle,
  } = args;
  const handle = resolvePatchWireHandle(targetHandle);

  if (handle === 'mod') {
    if (sourceRole !== 'modulator') return false;
    return targetRole === 'audio_effect' || targetRole === 'control_effect';
  }

  if (targetRole === 'audio_effect' && targetSignalInboundCount > 0) {
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

export function effectRoleFromTransforms(
  transforms: readonly unknown[],
): 'control_effect' | 'audio_effect' {
  if (transforms.some((entry) => entry === 'audio')) {
    return 'audio_effect';
  }
  return 'control_effect';
}

/** True when an edge targets the mod handle (modulation), not the signal path. */
export function isModTargetHandle(targetHandle?: string | null): boolean {
  return resolvePatchWireHandle(targetHandle) === 'mod';
}

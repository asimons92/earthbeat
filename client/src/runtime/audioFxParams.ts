/** Clamp and default ranges for Distortion and Delay audio Effects. */

export const DRIVE_MIN = 1;
export const DRIVE_MAX = 20;
export const DRIVE_DEFAULT = 2;

export const TIME_MS_MIN = 20;
export const TIME_MS_MAX = 1000;
export const TIME_MS_DEFAULT = 250;

export const FEEDBACK_MIN = 0;
export const FEEDBACK_MAX = 0.95;
export const FEEDBACK_DEFAULT = 0.35;

export const MIX_MIN = 0;
export const MIX_MAX = 1;
export const MIX_DEFAULT = 0.35;

/** Maximum delay line length in seconds for Elementary el.delay size. */
export const DELAY_MAX_SECONDS = 2;

export function clampDrive(drive: number): number {
  if (!Number.isFinite(drive)) return DRIVE_DEFAULT;
  return Math.min(DRIVE_MAX, Math.max(DRIVE_MIN, drive));
}

export function clampTimeMs(timeMs: number): number {
  if (!Number.isFinite(timeMs)) return TIME_MS_DEFAULT;
  return Math.min(TIME_MS_MAX, Math.max(TIME_MS_MIN, timeMs));
}

export function clampFeedback(feedback: number): number {
  if (!Number.isFinite(feedback)) return FEEDBACK_DEFAULT;
  return Math.min(FEEDBACK_MAX, Math.max(FEEDBACK_MIN, feedback));
}

export function clampMix(mix: number): number {
  if (!Number.isFinite(mix)) return MIX_DEFAULT;
  return Math.min(MIX_MAX, Math.max(MIX_MIN, mix));
}

/** Clamp and default ranges for audio Effect knobs. */

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

export const CUTOFF_HZ_MIN = 20;
export const CUTOFF_HZ_MAX = 20000;
export const CUTOFF_HZ_DEFAULT = 1000;

export const Q_MIN = 0.1;
export const Q_MAX = 20;
export const Q_DEFAULT = 0.707;

export const ATTACK_SEC_MIN = 0.001;
export const ATTACK_SEC_MAX = 2;
export const ATTACK_SEC_DEFAULT = 0.005;

export const DECAY_SEC_MIN = 0.001;
export const DECAY_SEC_MAX = 2;
export const DECAY_SEC_DEFAULT = 0.15;

export const SUSTAIN_MIN = 0;
export const SUSTAIN_MAX = 1;
export const SUSTAIN_DEFAULT = 0;

export const RELEASE_SEC_MIN = 0.001;
export const RELEASE_SEC_MAX = 2;
export const RELEASE_SEC_DEFAULT = 0.05;

export const GATE_MIN = 0;
export const GATE_MAX = 1;
export const GATE_DEFAULT = 0;

/** Maximum delay line length in seconds for Elementary el.delay size. */
export const DELAY_MAX_SECONDS = 2;

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampDrive(drive: number): number {
  return clampFinite(drive, DRIVE_MIN, DRIVE_MAX, DRIVE_DEFAULT);
}

export function clampTimeMs(timeMs: number): number {
  return clampFinite(timeMs, TIME_MS_MIN, TIME_MS_MAX, TIME_MS_DEFAULT);
}

export function clampFeedback(feedback: number): number {
  return clampFinite(feedback, FEEDBACK_MIN, FEEDBACK_MAX, FEEDBACK_DEFAULT);
}

export function clampMix(mix: number): number {
  return clampFinite(mix, MIX_MIN, MIX_MAX, MIX_DEFAULT);
}

export function clampCutoffHz(cutoffHz: number, sampleRateHz: number = 48000): number {
  const nyquist = Math.max(CUTOFF_HZ_MIN + 1, sampleRateHz / 2 - 1);
  const max = Math.min(CUTOFF_HZ_MAX, nyquist);
  return clampFinite(cutoffHz, CUTOFF_HZ_MIN, max, CUTOFF_HZ_DEFAULT);
}

export function clampQ(q: number): number {
  return clampFinite(q, Q_MIN, Q_MAX, Q_DEFAULT);
}

export function clampAttackSec(attackSec: number): number {
  return clampFinite(attackSec, ATTACK_SEC_MIN, ATTACK_SEC_MAX, ATTACK_SEC_DEFAULT);
}

export function clampDecaySec(decaySec: number): number {
  return clampFinite(decaySec, DECAY_SEC_MIN, DECAY_SEC_MAX, DECAY_SEC_DEFAULT);
}

export function clampSustain(sustain: number): number {
  return clampFinite(sustain, SUSTAIN_MIN, SUSTAIN_MAX, SUSTAIN_DEFAULT);
}

export function clampReleaseSec(releaseSec: number): number {
  return clampFinite(releaseSec, RELEASE_SEC_MIN, RELEASE_SEC_MAX, RELEASE_SEC_DEFAULT);
}

export function clampGate(gate: number): number {
  return clampFinite(gate, GATE_MIN, GATE_MAX, GATE_DEFAULT);
}

/** Round Drive to one decimal (matches inspector knob readout). */
export function roundDrive(drive: number): number {
  if (!Number.isFinite(drive)) return drive;
  return Math.round(drive * 10) / 10;
}

/** Round Delay time to whole milliseconds. */
export function roundTimeMs(timeMs: number): number {
  if (!Number.isFinite(timeMs)) return timeMs;
  return Math.round(timeMs);
}

/** Round Feedback to two decimals. */
export function roundFeedback(feedback: number): number {
  if (!Number.isFinite(feedback)) return feedback;
  return Math.round(feedback * 100) / 100;
}

/** Round Mix to two decimals. */
export function roundMix(mix: number): number {
  if (!Number.isFinite(mix)) return mix;
  return Math.round(mix * 100) / 100;
}

export function roundCutoffHz(cutoffHz: number): number {
  if (!Number.isFinite(cutoffHz)) return cutoffHz;
  return Math.round(cutoffHz);
}

export function roundQ(q: number): number {
  if (!Number.isFinite(q)) return q;
  return Math.round(q * 1000) / 1000;
}

export function roundEnvelopeSec(seconds: number): number {
  if (!Number.isFinite(seconds)) return seconds;
  return Math.round(seconds * 1000) / 1000;
}

export function roundSustain(sustain: number): number {
  if (!Number.isFinite(sustain)) return sustain;
  return Math.round(sustain * 100) / 100;
}

export function roundGate(gate: number): number {
  if (!Number.isFinite(gate)) return gate;
  return Math.round(gate * 100) / 100;
}

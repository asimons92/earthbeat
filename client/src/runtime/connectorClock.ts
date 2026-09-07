/**
 * Per-Connector tempo clocks for scrub (tides/waves) and queue (USGS).
 */

import {
  effectiveLoopSeconds,
  effectivePlaybackHz,
} from './playbackSpeed';

/** Wrap any finite phase into [0, 1). */
export function wrapUnitPhase(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  const wrapped = phase - Math.floor(phase);
  return wrapped < 1 ? wrapped : 0;
}

export type ScrubClock = {
  mode: 'scrub';
  /** Playhead in [0, 1). */
  phase: number;
  playing: boolean;
};

export type QueueClock = {
  mode: 'queue';
  /** Index into the local playback queue. */
  cursor: number;
  queueLength: number;
  /** Fractional hits not yet applied. */
  hitDebt: number;
  playing: boolean;
};

export function createScrubClock(phase: number = 0): ScrubClock {
  return {
    mode: 'scrub',
    phase: wrapUnitPhase(phase),
    playing: false,
  };
}

export function createQueueClock(queueLength: number, cursor: number = 0): QueueClock {
  const length = Math.max(0, Math.floor(queueLength));
  const safeCursor = length === 0 ? 0 : ((Math.floor(cursor) % length) + length) % length;
  return {
    mode: 'queue',
    cursor: safeCursor,
    queueLength: length,
    hitDebt: 0,
    playing: false,
  };
}

export function setClockPlaying<T extends { playing: boolean }>(
  clock: T,
  playing: boolean,
): T {
  return { ...clock, playing };
}

/**
 * Advance scrub phase by dtSeconds when playing.
 * effectiveLoop = defaultLoopSeconds / normalize(playbackSpeed).
 */
export function advanceScrubClock(
  clock: ScrubClock,
  dtSeconds: number,
  defaultLoopSeconds: number,
  playbackSpeed: unknown,
): ScrubClock {
  if (!clock.playing) return clock;
  if (!(dtSeconds > 0) || !(defaultLoopSeconds > 0)) return clock;
  const loop = effectiveLoopSeconds(defaultLoopSeconds, playbackSpeed);
  if (!(loop > 0)) return clock;
  return {
    ...clock,
    phase: wrapUnitPhase(clock.phase + dtSeconds / loop),
  };
}

/**
 * Keep phase fraction when a new series snapshot replaces the points.
 */
export function retainScrubPhaseOnSeriesReplace(clock: ScrubClock): ScrubClock {
  return {
    ...clock,
    phase: wrapUnitPhase(clock.phase),
  };
}

/**
 * Advance queue cursor by dtSeconds * effectiveHz when playing.
 * effectiveHz = defaultPlaybackHz * normalize(playbackSpeed).
 */
export function advanceQueueClock(
  clock: QueueClock,
  dtSeconds: number,
  defaultPlaybackHz: number,
  playbackSpeed: unknown,
): QueueClock {
  if (!clock.playing) return clock;
  if (clock.queueLength <= 0) return clock;
  if (!(dtSeconds > 0) || !(defaultPlaybackHz > 0)) return clock;
  const hz = effectivePlaybackHz(defaultPlaybackHz, playbackSpeed);
  if (!(hz > 0)) return clock;
  const hits = clock.hitDebt + dtSeconds * hz;
  const whole = Math.floor(hits);
  const debt = hits - whole;
  const cursor = (clock.cursor + whole) % clock.queueLength;
  return {
    ...clock,
    cursor,
    hitDebt: debt,
  };
}

/** Apply a new queue length from a snapshot; keep cursor in range. */
export function replaceQueueSnapshot(clock: QueueClock, queueLength: number): QueueClock {
  const length = Math.max(0, Math.floor(queueLength));
  if (length === 0) {
    return { ...clock, queueLength: 0, cursor: 0, hitDebt: 0 };
  }
  return {
    ...clock,
    queueLength: length,
    cursor: clock.cursor % length,
  };
}

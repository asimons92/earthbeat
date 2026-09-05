import { EventEmitter } from 'node:events';

import {
  DEFAULT_LOOP_SECONDS,
  DEFAULT_PLAYBACK_HZ,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STATION,
  fetchWaterLevels,
  type TideObservation,
} from './noaaCoops.js';
import {
  advanceTidePhase,
  sampleTidePhase,
  type TideSeriesPoint,
} from './tideScrub.js';

export type TideSample = {
  kindKey: 'noaa_coops_tides';
  id: string;
  stationId: string;
  waterLevel: number | null;
  /** Nearest scrub point without linear interpolation. */
  waterLevelStep: number | null;
  time: number;
};

export type TideStreamOptions = {
  hz?: number;
  pollIntervalMs?: number;
  loopSeconds?: number;
  station?: string;
};

export class TideStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly tickIntervalMs: number;
  private readonly loopSeconds: number;
  private readonly station: string;
  private series: TideSeriesPoint[] = [];
  private observations: TideObservation[] = [];
  private phase = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private backoffUntil = 0;

  constructor({
    hz = DEFAULT_PLAYBACK_HZ,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    loopSeconds = DEFAULT_LOOP_SECONDS,
    station = DEFAULT_STATION,
  }: TideStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.tickIntervalMs = 1000 / hz;
    this.loopSeconds = loopSeconds;
    this.station = station;
  }

  async start(): Promise<void> {
    if (this.tickTimer !== null) {
      return;
    }
    await this.refresh();
    this.pollTimer = setInterval(() => {
      void this.refresh();
    }, this.pollIntervalMs);
    this.tickTimer = setInterval(() => {
      this.tick();
    }, this.tickIntervalMs);
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    if (Date.now() < this.backoffUntil) return;
    this.refreshing = true;
    try {
      const observations = await fetchWaterLevels({ station: this.station });
      this.observations = observations;
      this.series = observations.map((row) => ({
        waterLevel: row.waterLevel,
        time: row.time,
      }));
      this.backoffUntil = 0;
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 429) {
        this.backoffUntil = Date.now() + this.pollIntervalMs;
      }
      this.emit('error', error);
    } finally {
      this.refreshing = false;
    }
  }

  private tick(): void {
    if (this.series.length === 0) return;
    const waterLevel = sampleTidePhase(this.series, this.phase, { interpolate: true });
    const waterLevelStep = sampleTidePhase(this.series, this.phase, { interpolate: false });
    const index = Math.min(
      this.observations.length - 1,
      Math.floor((this.phase - Math.floor(this.phase)) * this.observations.length),
    );
    const anchor = this.observations[Math.max(0, index)] ?? this.observations[0];
    const sample: TideSample = {
      kindKey: 'noaa_coops_tides',
      id: `scrub-${anchor?.id ?? this.station}-${Math.floor(this.phase * 1000)}`,
      stationId: anchor?.stationId ?? this.station,
      waterLevel: waterLevel ?? null,
      waterLevelStep: waterLevelStep ?? null,
      time: anchor?.time ?? Date.now(),
    };
    this.emit('sample', sample);
    this.phase = advanceTidePhase(this.phase, this.tickIntervalMs / 1000, this.loopSeconds);
  }
}
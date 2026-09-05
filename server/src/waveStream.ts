import { EventEmitter } from 'node:events';

import {
  DEFAULT_LOOP_SECONDS,
  DEFAULT_PLAYBACK_HZ,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STATION,
  fetchBuoyMet,
  type BuoyWaveObservation,
} from './ndbcBuoy.js';
import {
  advanceWavePhase,
  sampleWavePhase,
  type WaveSeriesPoint,
} from './waveScrub.js';

export type WaveSample = {
  kindKey: 'ndbc_buoy_waves';
  id: string;
  stationId: string;
  waveHeight: number | null;
  /** Nearest scrub point without linear interpolation. */
  waveHeightStep: number | null;
  wavePeriod: number | null;
  /** Nearest scrub point without linear interpolation. */
  wavePeriodStep: number | null;
  time: number;
};

export type WaveStreamOptions = {
  hz?: number;
  pollIntervalMs?: number;
  loopSeconds?: number;
  station?: string;
};

export class WaveStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly tickIntervalMs: number;
  private readonly loopSeconds: number;
  private readonly station: string;
  private series: WaveSeriesPoint[] = [];
  private observations: BuoyWaveObservation[] = [];
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
  }: WaveStreamOptions = {}) {
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
      const observations = await fetchBuoyMet({ station: this.station });
      this.observations = observations;
      this.series = observations.map((row) => ({
        waveHeight: row.waveHeight,
        wavePeriod: row.wavePeriod,
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
    const waveHeight = sampleWavePhase(this.series, this.phase, 'waveHeight', {
      interpolate: true,
    });
    const waveHeightStep = sampleWavePhase(this.series, this.phase, 'waveHeight', {
      interpolate: false,
    });
    const wavePeriod = sampleWavePhase(this.series, this.phase, 'wavePeriod', {
      interpolate: true,
    });
    const wavePeriodStep = sampleWavePhase(this.series, this.phase, 'wavePeriod', {
      interpolate: false,
    });
    const index = Math.min(
      this.observations.length - 1,
      Math.floor((this.phase - Math.floor(this.phase)) * this.observations.length),
    );
    const anchor = this.observations[Math.max(0, index)] ?? this.observations[0];
    const sample: WaveSample = {
      kindKey: 'ndbc_buoy_waves',
      id: `scrub-${anchor?.id ?? this.station}-${Math.floor(this.phase * 1000)}`,
      stationId: anchor?.stationId ?? this.station,
      waveHeight: waveHeight ?? null,
      waveHeightStep: waveHeightStep ?? null,
      wavePeriod: wavePeriod ?? null,
      wavePeriodStep: wavePeriodStep ?? null,
      time: anchor?.time ?? Date.now(),
    };
    this.emit('sample', sample);
    this.phase = advanceWavePhase(this.phase, this.tickIntervalMs / 1000, this.loopSeconds);
  }
}

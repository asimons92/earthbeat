import { EventEmitter } from 'node:events';

import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STATION,
  fetchBuoyMet,
  type BuoyWaveObservation,
} from './ndbcBuoy.js';
import { type WaveSeriesPoint } from './waveScrub.js';

export type WaveSeriesSnapshot = {
  kindKey: 'ndbc_buoy_waves';
  stationId: string;
  points: WaveSeriesPoint[];
};

export type WaveStreamOptions = {
  pollIntervalMs?: number;
  station?: string;
  fetchMet?: typeof fetchBuoyMet;
};

export class WaveStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly station: string;
  private readonly fetchMet: typeof fetchBuoyMet;
  private series: WaveSeriesPoint[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private backoffUntil = 0;

  constructor({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    station = DEFAULT_STATION,
    fetchMet = fetchBuoyMet,
  }: WaveStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.station = station;
    this.fetchMet = fetchMet;
  }

  async start(): Promise<void> {
    if (this.pollTimer !== null) {
      return;
    }
    await this.refresh();
    this.pollTimer = setInterval(() => {
      void this.refresh();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  isPolling(): boolean {
    return this.pollTimer !== null;
  }

  getSeriesSnapshot(): WaveSeriesSnapshot {
    return {
      kindKey: 'ndbc_buoy_waves',
      stationId: this.station,
      points: this.series.slice(),
    };
  }

  private emitSeries(): void {
    this.emit('series', this.getSeriesSnapshot());
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return;
    if (Date.now() < this.backoffUntil) return;
    this.refreshing = true;
    try {
      const observations: BuoyWaveObservation[] = await this.fetchMet({
        station: this.station,
      });
      this.series = observations.map((row) => ({
        waveHeight: row.waveHeight,
        wavePeriod: row.wavePeriod,
        time: row.time,
      }));
      this.backoffUntil = 0;
      this.emitSeries();
      this.emit('refresh', { pointCount: this.series.length });
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
}

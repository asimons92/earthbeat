import { EventEmitter } from 'node:events';

import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STATION,
  fetchWaterLevels,
  type TideObservation,
} from './noaaCoops.js';
import { type TideSeriesPoint } from './tideScrub.js';

export type TideSeriesSnapshot = {
  kindKey: 'noaa_coops_tides';
  stationId: string;
  points: TideSeriesPoint[];
};

export type TideStreamOptions = {
  pollIntervalMs?: number;
  station?: string;
  fetchLevels?: typeof fetchWaterLevels;
};

export class TideStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly station: string;
  private readonly fetchLevels: typeof fetchWaterLevels;
  private series: TideSeriesPoint[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private backoffUntil = 0;

  constructor({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    station = DEFAULT_STATION,
    fetchLevels = fetchWaterLevels,
  }: TideStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.station = station;
    this.fetchLevels = fetchLevels;
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

  getSeriesSnapshot(): TideSeriesSnapshot {
    return {
      kindKey: 'noaa_coops_tides',
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
      const observations: TideObservation[] = await this.fetchLevels({
        station: this.station,
      });
      this.series = observations.map((row) => ({
        waterLevel: row.waterLevel,
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

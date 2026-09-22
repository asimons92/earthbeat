import { EventEmitter } from 'node:events';

import {
  DEFAULT_POLL_INTERVAL_MS,
  fetchSwpcSolarWind,
  type SwpcSolarWindObservation,
} from './swpcSolarWind.js';

export type SolarWindSeriesPoint = {
  speed: number;
  density: number;
  bz: number;
  source: string;
  time: number;
};

export type SolarWindSeriesSnapshot = {
  kindKey: 'swpc_solar_wind';
  points: SolarWindSeriesPoint[];
};

export type SolarWindStreamOptions = {
  pollIntervalMs?: number;
  fetchSolarWind?: typeof fetchSwpcSolarWind;
};

export class SolarWindStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly fetchSolarWind: typeof fetchSwpcSolarWind;
  private series: SolarWindSeriesPoint[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private backoffUntil = 0;

  constructor({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    fetchSolarWind = fetchSwpcSolarWind,
  }: SolarWindStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.fetchSolarWind = fetchSolarWind;
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

  getSeriesSnapshot(): SolarWindSeriesSnapshot {
    return {
      kindKey: 'swpc_solar_wind',
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
      const observations: SwpcSolarWindObservation[] = await this.fetchSolarWind();
      if (observations.length === 0) {
        this.emit('error', new Error('SWPC solar wind returned no joined rows'));
        return;
      }
      this.series = observations.map((row) => ({
        speed: row.speed,
        density: row.density,
        bz: row.bz,
        source: row.source,
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

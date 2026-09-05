import { EventEmitter } from 'node:events';

import { pruneSeenIds } from './pruneSeenIds.js';
import {
  DEFAULT_PLAYBACK_HZ,
  DEFAULT_POLL_INTERVAL_MS,
  fetchDailyEarthquakes,
  type UsgsEarthquakeFeature,
} from './usgs.js';

export type EarthquakeSample = {
  id: string;
  mag: number | null;
  depthKm: number | null;
  sig: number | null;
  place: string;
  time: number;
};

export type EarthquakeStreamOptions = {
  hz?: number;
  pollIntervalMs?: number;
};

function toSample(feature: UsgsEarthquakeFeature): EarthquakeSample {
  const depth = feature.geometry?.coordinates?.[2];
  return {
    id: feature.id,
    mag: feature.properties.mag,
    depthKm: typeof depth === 'number' ? depth : null,
    sig: feature.properties.sig ?? null,
    place: feature.properties.place,
    time: feature.properties.time,
  };
}

export class EarthquakeStream extends EventEmitter {
  private readonly pollIntervalMs: number;
  private readonly tickIntervalMs: number;
  private readonly queue: EarthquakeSample[] = [];
  private readonly seenIds = new Set<string>();
  private cursor = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor({
    hz = DEFAULT_PLAYBACK_HZ,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  }: EarthquakeStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.tickIntervalMs = 1000 / hz;
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

  /** Test helper: current seen id count after prune cycles. */
  getSeenIdCount(): number {
    return this.seenIds.size;
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      const feed = await fetchDailyEarthquakes();
      const appended = this.appendNewEarthquakes(feed.features);
      const feedIds = feed.features.map((feature) => feature.id);
      const queueIds = this.queue.map((sample) => sample.id);
      pruneSeenIds(this.seenIds, feedIds, queueIds);
      if (appended > 0) {
        this.emit('refresh', { appended, queueLength: this.queue.length });
      }
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.refreshing = false;
    }
  }

  private appendNewEarthquakes(features: UsgsEarthquakeFeature[]): number {
    const newcomers = features
      .filter((feature) => !this.seenIds.has(feature.id))
      .map(toSample)
      .sort((a, b) => a.time - b.time);
    for (const sample of newcomers) {
      this.seenIds.add(sample.id);
      this.queue.push(sample);
    }
    return newcomers.length;
  }

  private tick(): void {
    if (this.queue.length === 0) {
      return;
    }
    const sample = this.queue[this.cursor];
    if (sample === undefined) {
      return;
    }
    this.cursor = (this.cursor + 1) % this.queue.length;
    this.emit('sample', sample);
  }
}

import { EventEmitter } from 'node:events';

import { pruneSeenIds } from './pruneSeenIds.js';
import {
  DEFAULT_POLL_INTERVAL_MS,
  fetchDailyEarthquakes,
  type UsgsEarthquakeFeature,
} from './usgs.js';

export type EarthquakeSample = {
  kindKey: 'usgs_earthquakes';
  id: string;
  mag: number | null;
  depthKm: number | null;
  sig: number | null;
  place: string;
  time: number;
};

export type EarthquakeQueueSnapshot = {
  kindKey: 'usgs_earthquakes';
  items: EarthquakeSample[];
};

export type EarthquakeStreamOptions = {
  pollIntervalMs?: number;
  fetchFeed?: typeof fetchDailyEarthquakes;
};

function toSample(feature: UsgsEarthquakeFeature): EarthquakeSample {
  const depth = feature.geometry?.coordinates?.[2];
  return {
    kindKey: 'usgs_earthquakes',
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
  private readonly fetchFeed: typeof fetchDailyEarthquakes;
  private readonly queue: EarthquakeSample[] = [];
  private readonly seenIds = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor({
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    fetchFeed = fetchDailyEarthquakes,
  }: EarthquakeStreamOptions = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.fetchFeed = fetchFeed;
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

  /** True when the poll timer is running (no sample tick timers). */
  isPolling(): boolean {
    return this.pollTimer !== null;
  }

  /** Current playback queue for SSE subscribers. */
  getQueueSnapshot(): EarthquakeQueueSnapshot {
    return {
      kindKey: 'usgs_earthquakes',
      items: this.queue.slice(),
    };
  }

  /** Test helper: current seen id count after prune cycles. */
  getSeenIdCount(): number {
    return this.seenIds.size;
  }

  private emitQueue(): void {
    this.emit('queue', this.getQueueSnapshot());
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      const feed = await this.fetchFeed();
      this.appendNewEarthquakes(feed.features);
      const feedIds = feed.features.map((feature) => feature.id);
      const queueIds = this.queue.map((sample) => sample.id);
      pruneSeenIds(this.seenIds, feedIds, queueIds);
      this.emitQueue();
      this.emit('refresh', { queueLength: this.queue.length });
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
}

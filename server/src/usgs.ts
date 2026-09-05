/**
 * USGS feed defaults mirrored from clay/model.json catalog.connectorKinds
 * (usgs_earthquakes). Per-Connector overrides wait for Patch persistence.
 */
export const USGS_ALL_DAY_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

export const DEFAULT_POLL_INTERVAL_MS = 60_000;
export const DEFAULT_PLAYBACK_HZ = 4;

export type UsgsEarthquakeProperties = {
  mag: number | null;
  place: string;
  time: number;
  sig?: number | null;
};

export type UsgsEarthquakeFeature = {
  type: 'Feature';
  id: string;
  properties: UsgsEarthquakeProperties;
  geometry?: {
    type: string;
    coordinates?: number[];
  };
};

export type UsgsEarthquakeFeed = {
  type: 'FeatureCollection';
  features: UsgsEarthquakeFeature[];
};

export async function fetchDailyEarthquakes(): Promise<UsgsEarthquakeFeed> {
  const response = await fetch(USGS_ALL_DAY_URL);
  if (!response.ok) {
    throw new Error(`USGS request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as UsgsEarthquakeFeed;
}

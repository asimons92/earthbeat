/**
 * NOAA CO-OPS defaults mirrored from clay/model.json catalog.connectorKinds
 * (noaa_coops_tides). Per-Connector overrides wait for inspector config.
 */

export const NOAA_COOPS_DATAGETTER_URL =
  'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

export const DEFAULT_STATION = '9414290';
export const DEFAULT_PRODUCT = 'water_level';
export const DEFAULT_DATUM = 'MLLW';
export const DEFAULT_UNITS = 'metric';
export const DEFAULT_TIME_ZONE = 'gmt';
export const DEFAULT_APPLICATION = 'earthbeat';
export const DEFAULT_RANGE_HOURS = 24;
export const DEFAULT_POLL_INTERVAL_MS = 360_000;
export const DEFAULT_PLAYBACK_HZ = 1;
export const DEFAULT_LOOP_SECONDS = 120;

export type NoaaWaterLevelRow = {
  t: string;
  v: string;
};

export type NoaaWaterLevelResponse = {
  metadata?: { id?: string; name?: string };
  data?: NoaaWaterLevelRow[];
  error?: { message?: string };
};

export type TideObservation = {
  id: string;
  stationId: string;
  waterLevel: number;
  time: number;
};

function parseCoopsTimeToMs(value: string): number | null {
  // CO-OPS gmt times look like "2024-01-15 18:06"
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? ms : null;
}

export function buildWaterLevelUrl(options?: {
  station?: string;
  rangeHours?: number;
}): string {
  const params = new URLSearchParams({
    station: options?.station ?? DEFAULT_STATION,
    product: DEFAULT_PRODUCT,
    datum: DEFAULT_DATUM,
    units: DEFAULT_UNITS,
    time_zone: DEFAULT_TIME_ZONE,
    application: DEFAULT_APPLICATION,
    format: 'json',
    range: String(options?.rangeHours ?? DEFAULT_RANGE_HOURS),
  });
  return `${NOAA_COOPS_DATAGETTER_URL}?${params.toString()}`;
}

export function mapWaterLevelResponse(
  body: NoaaWaterLevelResponse,
  stationFallback = DEFAULT_STATION,
): TideObservation[] {
  if (body.error?.message) {
    throw new Error(`CO-OPS error: ${body.error.message}`);
  }
  const stationId = body.metadata?.id ?? stationFallback;
  const rows = body.data ?? [];
  const out: TideObservation[] = [];
  for (const row of rows) {
    const time = parseCoopsTimeToMs(row.t);
    const waterLevel = Number.parseFloat(row.v);
    if (time === null || !Number.isFinite(waterLevel)) continue;
    out.push({
      id: `${stationId}-${time}`,
      stationId,
      waterLevel,
      time,
    });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export async function fetchWaterLevels(options?: {
  station?: string;
  rangeHours?: number;
}): Promise<TideObservation[]> {
  const url = buildWaterLevelUrl(options);
  const response = await fetch(url);
  if (response.status === 429) {
    const error = new Error(`CO-OPS rate limited: ${response.status}`);
    (error as Error & { status?: number }).status = 429;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`CO-OPS request failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as NoaaWaterLevelResponse;
  return mapWaterLevelResponse(body, options?.station ?? DEFAULT_STATION);
}

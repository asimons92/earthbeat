/**
 * NDBC buoy defaults mirrored from clay/model.json catalog.connectorKinds
 * (ndbc_buoy_waves). Per-Connector overrides wait for inspector config.
 */

export const NDBC_REALTIME2_BASE_URL =
  'https://www.ndbc.noaa.gov/data/realtime2';

export const DEFAULT_STATION = '46026';
export const DEFAULT_POLL_INTERVAL_MS = 1_800_000;
export const DEFAULT_PLAYBACK_HZ = 1;
export const DEFAULT_LOOP_SECONDS = 90;
export const DEFAULT_RANGE_HOURS = 48;

/** Column indices in NDBC standard meteorological realtime2 .txt rows. */
const COL_YY = 0;
const COL_MM = 1;
const COL_DD = 2;
const COL_HH = 3;
const COL_MIN = 4;
const COL_WVHT = 8;
const COL_DPD = 9;

export type BuoyWaveObservation = {
  id: string;
  stationId: string;
  waveHeight: number;
  wavePeriod: number;
  time: number;
};

export function buildBuoyMetUrl(station = DEFAULT_STATION): string {
  return `${NDBC_REALTIME2_BASE_URL}/${station}.txt`;
}

function parseNdbcNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === 'MM') return null;
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseNdbcRowTimeMs(parts: string[]): number | null {
  const yearRaw = parseNdbcNumber(parts[COL_YY]);
  const month = parseNdbcNumber(parts[COL_MM]);
  const day = parseNdbcNumber(parts[COL_DD]);
  const hour = parseNdbcNumber(parts[COL_HH]);
  const minute = parseNdbcNumber(parts[COL_MIN]);
  if (
    yearRaw === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null
  ) {
    return null;
  }
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Parse NDBC standard meteorological text. Drops header lines, MM / invalid
 * WVHT or DPD, and keeps only the newest rangeHours window. Sorted ascending.
 */
export function mapNdbcMetText(
  text: string,
  stationId = DEFAULT_STATION,
  rangeHours = DEFAULT_RANGE_HOURS,
): BuoyWaveObservation[] {
  const out: BuoyWaveObservation[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length <= COL_DPD) continue;
    const time = parseNdbcRowTimeMs(parts);
    const waveHeight = parseNdbcNumber(parts[COL_WVHT]);
    const wavePeriod = parseNdbcNumber(parts[COL_DPD]);
    if (time === null || waveHeight === null || wavePeriod === null) continue;
    out.push({
      id: `${stationId}-${time}`,
      stationId,
      waveHeight,
      wavePeriod,
      time,
    });
  }
  out.sort((a, b) => a.time - b.time);
  if (out.length === 0 || !(rangeHours > 0)) return out;
  const newest = out[out.length - 1]!.time;
  const cutoff = newest - rangeHours * 3_600_000;
  return out.filter((row) => row.time >= cutoff);
}

export async function fetchBuoyMet(options?: {
  station?: string;
  rangeHours?: number;
}): Promise<BuoyWaveObservation[]> {
  const station = options?.station ?? DEFAULT_STATION;
  const url = buildBuoyMetUrl(station);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'earthbeat/0.1 (ndbc_buoy_waves)' },
  });
  if (response.status === 429) {
    const error = new Error(`NDBC rate limited: ${response.status}`);
    (error as Error & { status?: number }).status = 429;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`NDBC request failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return mapNdbcMetText(text, station, options?.rangeHours ?? DEFAULT_RANGE_HOURS);
}

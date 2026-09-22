/**
 * NOAA SWPC real-time solar wind. Defaults mirror clay/model.json
 * catalog.connectorKinds (swpc_solar_wind).
 */

export const SWPC_RTSW_BASE_URL = 'https://services.swpc.noaa.gov/json/rtsw/';
export const DEFAULT_WIND_FILE = 'rtsw_wind_1m.json';
export const DEFAULT_MAG_FILE = 'rtsw_mag_1m.json';
export const DEFAULT_POLL_INTERVAL_MS = 60_000;
export const DEFAULT_PLAYBACK_HZ = 1;
export const DEFAULT_LOOP_SECONDS = 120;
export const DEFAULT_RANGE_HOURS = 24;
export const SOLAR_WIND_USER_AGENT = 'earthbeat/0.1 (swpc_solar_wind)';

const HOUR_MS = 3_600_000;

export type SwpcSolarWindObservation = {
  id: string;
  source: string;
  speed: number;
  density: number;
  bz: number;
  time: number;
};

type WindPoint = {
  time: number;
  source: string;
  speed: number;
  density: number;
};

type MagPoint = {
  time: number;
  source: string;
  bz: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** SWPC time_tag has no offset. Date.parse of that form is local, so force UTC. */
function parseTimeTagUtc(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const tagged = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(tagged);
  return Number.isFinite(ms) ? ms : null;
}

function pointKey(time: number, source: string): string {
  return `${time}|${source}`;
}

function collectWind(rows: readonly unknown[]): Map<string, WindPoint> {
  const byKey = new Map<string, WindPoint>();
  for (const row of rows) {
    if (!isRecord(row) || row.active !== true || typeof row.source !== 'string') continue;
    const time = parseTimeTagUtc(row.time_tag);
    const speed = finiteNumber(row.proton_speed);
    const density = finiteNumber(row.proton_density);
    if (time === null || speed === null || density === null) continue;
    byKey.set(pointKey(time, row.source), {
      time,
      source: row.source,
      speed,
      density,
    });
  }
  return byKey;
}

function collectMag(rows: readonly unknown[]): Map<string, MagPoint> {
  const byKey = new Map<string, MagPoint>();
  for (const row of rows) {
    if (!isRecord(row) || row.active !== true || typeof row.source !== 'string') continue;
    const time = parseTimeTagUtc(row.time_tag);
    const bz = finiteNumber(row.bz_gsm);
    if (time === null || bz === null) continue;
    byKey.set(pointKey(time, row.source), {
      time,
      source: row.source,
      bz,
    });
  }
  return byKey;
}

/**
 * Join active wind and mag rows on UTC time and source.
 * A later valid row for the same time and source replaces the earlier one.
 * Rows outside rangeHours of the newest kept time are dropped.
 */
export function mapSwpcSolarWind(
  windRows: readonly unknown[],
  magRows: readonly unknown[],
  rangeHours = DEFAULT_RANGE_HOURS,
): SwpcSolarWindObservation[] {
  const wind = collectWind(windRows);
  const mag = collectMag(magRows);
  const joined: SwpcSolarWindObservation[] = [];
  for (const [key, windPoint] of wind) {
    const magPoint = mag.get(key);
    if (!magPoint) continue;
    joined.push({
      id: `${windPoint.source}-${windPoint.time}`,
      source: windPoint.source,
      speed: windPoint.speed,
      density: windPoint.density,
      bz: magPoint.bz,
      time: windPoint.time,
    });
  }
  joined.sort((a, b) => a.time - b.time || a.source.localeCompare(b.source));
  if (joined.length === 0 || !(rangeHours > 0)) return joined;
  const newest = joined[joined.length - 1]!.time;
  const cutoff = newest - rangeHours * HOUR_MS;
  return joined.filter((row) => row.time >= cutoff);
}

export function buildSwpcProductUrl(fileName: string): string {
  return `${SWPC_RTSW_BASE_URL}${fileName}`;
}

async function fetchSwpcJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': SOLAR_WIND_USER_AGENT },
  });
  if (response.status === 429) {
    const error = new Error(`SWPC rate limited: ${response.status}`);
    (error as Error & { status?: number }).status = 429;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`SWPC request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchSwpcSolarWind(options?: {
  rangeHours?: number;
  windFile?: string;
  magFile?: string;
}): Promise<SwpcSolarWindObservation[]> {
  const windUrl = buildSwpcProductUrl(options?.windFile ?? DEFAULT_WIND_FILE);
  const magUrl = buildSwpcProductUrl(options?.magFile ?? DEFAULT_MAG_FILE);
  const [windBody, magBody] = await Promise.all([fetchSwpcJson(windUrl), fetchSwpcJson(magUrl)]);
  const windRows = Array.isArray(windBody) ? windBody : [];
  const magRows = Array.isArray(magBody) ? magBody : [];
  return mapSwpcSolarWind(windRows, magRows, options?.rangeHours ?? DEFAULT_RANGE_HOURS);
}

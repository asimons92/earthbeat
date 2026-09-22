/** Numeric channel extraction from kind-tagged connector samples. */

export type UsgsConnectorSample = {
  kindKey: 'usgs_earthquakes';
  id: string;
  mag: number | null;
  depthKm: number | null;
  sig: number | null;
  place: string;
  time: number;
};

export type NoaaConnectorSample = {
  kindKey: 'noaa_coops_tides';
  id: string;
  stationId: string;
  waterLevel: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  waterLevelStep?: number | null;
  time: number;
};

export type NdbcWaveConnectorSample = {
  kindKey: 'ndbc_buoy_waves';
  id: string;
  stationId: string;
  waveHeight: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  waveHeightStep?: number | null;
  wavePeriod: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  wavePeriodStep?: number | null;
  time: number;
};

export type SwpcSolarWindConnectorSample = {
  kindKey: 'swpc_solar_wind';
  id: string;
  source: string;
  speed: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  speedStep?: number | null;
  density: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  densityStep?: number | null;
  bz: number | null;
  /** Nearest scrub point; used when Connector interpolate is off. */
  bzStep?: number | null;
  time: number;
};

export type ConnectorSample =
  | UsgsConnectorSample
  | NoaaConnectorSample
  | NdbcWaveConnectorSample
  | SwpcSolarWindConnectorSample;

/** Read a numeric channel from a sample. Unknown keys return null (never invent). */
export function channelFromSample(
  sample: ConnectorSample,
  channelKey: string,
  options?: { interpolate?: boolean },
): number | null {
  if (sample.kindKey === 'usgs_earthquakes') {
    if (channelKey === 'mag') return sample.mag;
    if (channelKey === 'depthKm') return sample.depthKm;
    if (channelKey === 'sig') return sample.sig;
    return null;
  }
  if (sample.kindKey === 'noaa_coops_tides') {
    if (channelKey === 'waterLevel') {
      const interpolate = options?.interpolate !== false;
      if (!interpolate && sample.waterLevelStep != null) {
        return sample.waterLevelStep;
      }
      return sample.waterLevel;
    }
    return null;
  }
  if (sample.kindKey === 'ndbc_buoy_waves') {
    const interpolate = options?.interpolate !== false;
    if (channelKey === 'waveHeight') {
      if (!interpolate && sample.waveHeightStep != null) {
        return sample.waveHeightStep;
      }
      return sample.waveHeight;
    }
    if (channelKey === 'wavePeriod') {
      if (!interpolate && sample.wavePeriodStep != null) {
        return sample.wavePeriodStep;
      }
      return sample.wavePeriod;
    }
    return null;
  }
  if (sample.kindKey === 'swpc_solar_wind') {
    const interpolate = options?.interpolate !== false;
    if (channelKey === 'speed') {
      if (!interpolate && sample.speedStep != null) return sample.speedStep;
      return sample.speed;
    }
    if (channelKey === 'density') {
      if (!interpolate && sample.densityStep != null) return sample.densityStep;
      return sample.density;
    }
    if (channelKey === 'bz') {
      if (!interpolate && sample.bzStep != null) return sample.bzStep;
      return sample.bz;
    }
    return null;
  }
  return null;
}

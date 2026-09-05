/** Mirrors clay/model.json catalog until Clay generates shared types. */

export const usgsConnector = {
  key: 'usgs_earthquakes',
  label: 'USGS Quakes',
  description: 'USGS all-day earthquake feed',
  channels: [
    {
      key: 'mag',
      label: 'Magnitude',
      unit: 'Mw',
      min: 1,
      max: 8,
    },
  ],
} as const;

export const oscillatorDefaults = {
  waveform: 'sine',
  baseFrequencyHz: 220,
  gain: 0.2,
} as const;

export const demoModulation = {
  channelKey: 'mag',
  targetParam: 'frequency',
  inMin: 1,
  inMax: 8,
  outMin: 110,
  outMax: 880,
} as const;

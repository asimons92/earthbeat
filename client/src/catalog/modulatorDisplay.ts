/** Round and format Modulator map bounds for canvas status and knob commits. */

const VALUE_DECIMALS = 2;
const VALUE_FACTOR = 10 ** VALUE_DECIMALS;

/** Round a Modulator in or out bound to two decimals (matches inspector knobs). */
export function roundModulatorValue(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * VALUE_FACTOR) / VALUE_FACTOR;
}

export type ModulatorStatusRanges = {
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
  targetParam: string;
};

/** Canvas / status line for a Modulator transfer map. */
export function formatModulatorStatus(data: ModulatorStatusRanges): string {
  const inMin = roundModulatorValue(data.inMin);
  const inMax = roundModulatorValue(data.inMax);
  const outMin = roundModulatorValue(data.outMin);
  const outMax = roundModulatorValue(data.outMax);
  const outIsRatio = data.targetParam === 'frequencyHz';
  const outRange = outIsRatio ? `${outMin}×–${outMax}×` : `${outMin}–${outMax}`;
  return `${inMin}–${inMax} → ${outRange}`;
}

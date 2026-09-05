export type ModulatorMappingData = {
  label: string;
  channelKey: string;
  targetParam: string;
  inMin: number;
  inMax: number;
  outMin: number;
  outMax: number;
  status: string;
};

export type ModulatorChannelOption = {
  key: string;
  label: string;
  min: number;
  max: number;
  mapHintMin?: number;
  mapHintMax?: number;
};

export type ModulatorTargetOption = {
  key: string;
  label: string;
  modulationOutMin: number;
  modulationOutMax: number;
  modulationKind?: string;
};

/** Blank Modulator row for New modulator. Mapping keys stay empty until wires autofill. */
export function blankModulatorData(index: number): ModulatorMappingData {
  return {
    label: index === 0 ? 'Modulator' : `Modulator ${index + 1}`,
    channelKey: '',
    targetParam: '',
    inMin: 0,
    inMax: 1,
    outMin: 0,
    outMax: 1,
    status: '—',
  };
}

function refreshPresentation(
  data: ModulatorMappingData,
  channels: readonly ModulatorChannelOption[],
  targets: readonly ModulatorTargetOption[],
): ModulatorMappingData {
  if (data.channelKey.length === 0 || data.targetParam.length === 0) {
    return data;
  }
  const channel = channels.find((entry) => entry.key === data.channelKey);
  const target = targets.find((entry) => entry.key === data.targetParam);
  const left = channel?.label ?? data.channelKey;
  const right = target?.label ?? data.targetParam;
  const outIsRatio = target?.modulationKind === 'ratio' || data.targetParam === 'frequencyHz';
  const outRange = outIsRatio
    ? `${data.outMin}×–${data.outMax}×`
    : `${data.outMin}–${data.outMax}`;
  return {
    ...data,
    label: `${left} → ${right}`,
    status: `${data.inMin}–${data.inMax} → ${outRange}`,
  };
}

/**
 * On Connector → Modulator wire: fill channel and in-range when empty or invalid for this kind.
 * Leave a still-valid channel alone.
 */
export function autofillModulatorChannel(
  data: ModulatorMappingData,
  channels: readonly ModulatorChannelOption[],
  targets: readonly ModulatorTargetOption[] = [],
): ModulatorMappingData {
  if (channels.length === 0) return data;
  const valid = channels.some((channel) => channel.key === data.channelKey);
  if (valid) {
    return refreshPresentation(data, channels, targets);
  }
  const first = channels[0]!;
  const next: ModulatorMappingData = {
    ...data,
    channelKey: first.key,
    inMin: first.mapHintMin ?? first.min,
    inMax: first.mapHintMax ?? first.max,
  };
  return refreshPresentation(next, channels, targets);
}

/**
 * On Modulator → Oscillator wire (Effects allowed in between): fill target and out-range
 * when empty or invalid. Leave a still-valid target alone.
 */
export function autofillModulatorTarget(
  data: ModulatorMappingData,
  targets: readonly ModulatorTargetOption[],
  channels: readonly ModulatorChannelOption[] = [],
): ModulatorMappingData {
  if (targets.length === 0) return data;
  const valid = targets.some((target) => target.key === data.targetParam);
  if (valid) {
    return refreshPresentation(data, channels, targets);
  }
  const first = targets[0]!;
  const next: ModulatorMappingData = {
    ...data,
    targetParam: first.key,
    outMin: first.modulationOutMin,
    outMax: first.modulationOutMax,
  };
  return refreshPresentation(next, channels, targets);
}

export function modulatorMappingFromUnknown(
  data: Record<string, unknown>,
): ModulatorMappingData {
  return {
    label: typeof data.label === 'string' ? data.label : 'Modulator',
    channelKey: typeof data.channelKey === 'string' ? data.channelKey : '',
    targetParam: typeof data.targetParam === 'string' ? data.targetParam : '',
    inMin: typeof data.inMin === 'number' && Number.isFinite(data.inMin) ? data.inMin : 0,
    inMax: typeof data.inMax === 'number' && Number.isFinite(data.inMax) ? data.inMax : 1,
    outMin: typeof data.outMin === 'number' && Number.isFinite(data.outMin) ? data.outMin : 0,
    outMax: typeof data.outMax === 'number' && Number.isFinite(data.outMax) ? data.outMax : 1,
    status: typeof data.status === 'string' ? data.status : '—',
  };
}

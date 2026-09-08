import { effectDefaults, getEffectKind, scaleSnapScales } from '@/generated/catalog';
import {
  roundCutoffHz,
  roundDrive,
  roundEnvelopeSec,
  roundFeedback,
  roundGate,
  roundQ,
  roundTimeMs,
} from '@/runtime/audioFxParams';

import { resolveConnectorKind } from './resolveConnectorKind';

export type EffectKindLike = {
  key: string;
  label: string;
  transforms?: readonly unknown[];
  defaultTonic?: string;
  defaultScaleKey?: string;
  defaultEnabled?: boolean;
  a4Hz?: number;
  defaultDrive?: number;
  defaultTimeMs?: number;
  defaultFeedback?: number;
  defaultMix?: number;
  defaultCutoffHz?: number;
  defaultQ?: number;
  defaultAttackSec?: number;
  defaultDecaySec?: number;
  defaultSustain?: number;
  defaultReleaseSec?: number;
  defaultGate?: number;
};

export type EffectNodeDraft = {
  id: string;
  type: 'effect';
  position: { x: number; y: number };
  data: {
    label: string;
    kindKey: string;
    tonic: string;
    scaleKey: string;
    enabled: boolean;
    a4Hz: number;
    drive: number;
    timeMs: number;
    feedback: number;
    mix: number;
    cutoffHz: number;
    q: number;
    attackSec: number;
    decaySec: number;
    sustain: number;
    releaseSec: number;
    gate: number;
    status: string;
  };
};

export function effectStatusLine(data: {
  kindKey: string;
  enabled: boolean;
  tonic: string;
  scaleKey: string;
  drive: number;
  timeMs: number;
  feedback: number;
  cutoffHz?: number;
  q?: number;
  attackSec?: number;
  decaySec?: number;
  sustain?: number;
  gate?: number;
}): string {
  if (!data.enabled) return 'bypassed';
  const kind = getEffectKind(data.kindKey);
  const transforms = kind?.transforms ?? [];
  if (transforms.some((entry) => entry === 'audio')) {
    if (data.kindKey === 'distortion') {
      return `drive ${roundDrive(data.drive)}`;
    }
    if (data.kindKey === 'delay') {
      return `${roundTimeMs(data.timeMs)}ms fb ${roundFeedback(data.feedback)}`;
    }
    if (
      data.kindKey === 'lowpass' ||
      data.kindKey === 'highpass' ||
      data.kindKey === 'bandpass'
    ) {
      return `${roundCutoffHz(data.cutoffHz ?? effectDefaults.cutoffHz)}Hz Q ${roundQ(data.q ?? effectDefaults.q)}`;
    }
    if (data.kindKey === 'adsr') {
      return `A ${roundEnvelopeSec(data.attackSec ?? effectDefaults.attackSec)} D ${roundEnvelopeSec(data.decaySec ?? effectDefaults.decaySec)} G ${roundGate(data.gate ?? effectDefaults.gate)}`;
    }
  }
  const scale = scaleSnapScales.find((entry) => entry.key === data.scaleKey);
  return `${data.tonic} ${scale?.label ?? data.scaleKey}`;
}

/**
 * Build a canvas Effect node from a catalog kind key.
 * Returns undefined when the kind is not in the catalog.
 */
export function buildEffectNode<T extends EffectKindLike>(args: {
  kindKey: string;
  kindsByKey: Readonly<Record<string, T>>;
  existingEffectCount: number;
  position: { x: number; y: number };
  newId: string;
}): EffectNodeDraft | undefined {
  const kind = resolveConnectorKind(args.kindsByKey, args.kindKey);
  if (!kind) return undefined;

  const tonic = kind.defaultTonic ?? effectDefaults.tonic;
  const scaleKey = kind.defaultScaleKey ?? effectDefaults.scaleKey;
  const enabled = kind.defaultEnabled !== false;
  const a4Hz = typeof kind.a4Hz === 'number' ? kind.a4Hz : effectDefaults.a4Hz;
  const drive =
    typeof kind.defaultDrive === 'number' ? kind.defaultDrive : effectDefaults.drive;
  const timeMs =
    typeof kind.defaultTimeMs === 'number' ? kind.defaultTimeMs : effectDefaults.timeMs;
  const feedback =
    typeof kind.defaultFeedback === 'number'
      ? kind.defaultFeedback
      : effectDefaults.feedback;
  const mix = typeof kind.defaultMix === 'number' ? kind.defaultMix : effectDefaults.mix;
  const cutoffHz =
    typeof kind.defaultCutoffHz === 'number'
      ? kind.defaultCutoffHz
      : effectDefaults.cutoffHz;
  const q = typeof kind.defaultQ === 'number' ? kind.defaultQ : effectDefaults.q;
  const attackSec =
    typeof kind.defaultAttackSec === 'number'
      ? kind.defaultAttackSec
      : effectDefaults.attackSec;
  const decaySec =
    typeof kind.defaultDecaySec === 'number'
      ? kind.defaultDecaySec
      : effectDefaults.decaySec;
  const sustain =
    typeof kind.defaultSustain === 'number'
      ? kind.defaultSustain
      : effectDefaults.sustain;
  const releaseSec =
    typeof kind.defaultReleaseSec === 'number'
      ? kind.defaultReleaseSec
      : effectDefaults.releaseSec;
  const gate =
    typeof kind.defaultGate === 'number' ? kind.defaultGate : effectDefaults.gate;
  const label =
    args.existingEffectCount === 0
      ? kind.label
      : `${kind.label} ${args.existingEffectCount + 1}`;

  const data = {
    label,
    kindKey: kind.key,
    tonic,
    scaleKey,
    enabled,
    a4Hz,
    drive,
    timeMs,
    feedback,
    mix,
    cutoffHz,
    q,
    attackSec,
    decaySec,
    sustain,
    releaseSec,
    gate,
    status: '',
  };
  data.status = effectStatusLine(data);

  return {
    id: args.newId,
    type: 'effect',
    position: args.position,
    data,
  };
}

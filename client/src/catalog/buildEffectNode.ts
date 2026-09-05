import { resolveConnectorKind } from './resolveConnectorKind';

export type EffectKindLike = {
  key: string;
  label: string;
  defaultTonic?: string;
  defaultScaleKey?: string;
  defaultEnabled?: boolean;
  a4Hz?: number;
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
    status: string;
  };
};

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

  const tonic = kind.defaultTonic ?? 'C';
  const scaleKey = kind.defaultScaleKey ?? 'major';
  const enabled = kind.defaultEnabled !== false;
  const a4Hz = typeof kind.a4Hz === 'number' ? kind.a4Hz : 440;
  const label =
    args.existingEffectCount === 0
      ? kind.label
      : `${kind.label} ${args.existingEffectCount + 1}`;

  return {
    id: args.newId,
    type: 'effect',
    position: args.position,
    data: {
      label,
      kindKey: kind.key,
      tonic,
      scaleKey,
      enabled,
      a4Hz,
      status: enabled ? `${tonic} ${scaleKey}` : 'bypassed',
    },
  };
}

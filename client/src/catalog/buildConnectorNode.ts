import { resolveConnectorKind, type ConnectorKindLike } from './resolveConnectorKind';

export type ConnectorNodeDraft = {
  id: string;
  type: 'connector';
  position: { x: number; y: number };
  data: {
    label: string;
    kindKey: string;
    status: string;
  };
};

/**
 * Build a canvas Connector node from a catalog kind key.
 * Returns undefined when the kind is not in the catalog (never invents kindKey).
 */
export function buildConnectorNode<T extends ConnectorKindLike>(args: {
  kindKey: string;
  kindsByKey: Readonly<Record<string, T>>;
  existingConnectorCount: number;
  position: { x: number; y: number };
  newId: string;
  status?: string;
}): ConnectorNodeDraft | undefined {
  const kind = resolveConnectorKind(args.kindsByKey, args.kindKey);
  if (!kind) return undefined;

  const label =
    args.existingConnectorCount === 0
      ? kind.label
      : `${kind.label} ${args.existingConnectorCount + 1}`;

  return {
    id: args.newId,
    type: 'connector',
    position: args.position,
    data: {
      label,
      kindKey: kind.key,
      status: args.status ?? 'M —',
    },
  };
}

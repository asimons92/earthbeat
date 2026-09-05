/** Lookup a ConnectorKind (catalog entry for a natural-signal API) by key. */
export type ConnectorKindLike = {
  key: string;
  label: string;
};

export function resolveConnectorKind<T extends ConnectorKindLike>(
  kindsByKey: Readonly<Record<string, T>>,
  kindKey: string,
): T | undefined {
  if (Object.prototype.hasOwnProperty.call(kindsByKey, kindKey)) {
    return kindsByKey[kindKey];
  }
  return undefined;
}

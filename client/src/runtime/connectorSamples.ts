/**
 * Latest Connector samples keyed by Connector node id (not kindKey).
 * Red-phase stub map helpers.
 */

export type ConnectorSampleMap<T> = Readonly<Record<string, T>>;

export function emptyConnectorSamples<T>(): ConnectorSampleMap<T> {
  return {};
}

export function setConnectorSample<T>(
  map: ConnectorSampleMap<T>,
  connectorId: string,
  sample: T,
): ConnectorSampleMap<T> {
  return { ...map, [connectorId]: sample };
}

export function getConnectorSample<T>(
  map: ConnectorSampleMap<T>,
  connectorId: string,
): T | undefined {
  return map[connectorId];
}

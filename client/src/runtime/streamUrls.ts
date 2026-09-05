/** Map ConnectorKind keys to SSE paths. */

const STREAM_BY_KIND: Record<string, string> = {
  usgs_earthquakes: '/api/earthquakes/stream',
  noaa_coops_tides: '/api/tides/stream',
  ndbc_buoy_waves: '/api/waves/stream',
};

export function streamUrlForKind(kindKey: string): string | undefined {
  return STREAM_BY_KIND[kindKey];
}

export function streamUrlsForKindKeys(kindKeys: Iterable<string>): Map<string, string> {
  const urls = new Map<string, string>();
  for (const key of kindKeys) {
    const url = streamUrlForKind(key);
    if (url) urls.set(key, url);
  }
  return urls;
}

export function connectorKindKeysFromNodes(
  nodes: Array<{ type?: string; data?: Record<string, unknown> }>,
): Set<string> {
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'connector') continue;
    const kindKey = node.data?.kindKey;
    if (typeof kindKey === 'string' && kindKey.length > 0) {
      keys.add(kindKey);
    }
  }
  return keys;
}

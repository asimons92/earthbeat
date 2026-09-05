import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';

import { createPatchAudioEngine, type PatchAudioEngine } from './audioEngine';
import {
  createPatchTransportState,
  reducePatchTransport,
  shouldHoldSharedStream,
  type PatchTransportState,
} from './patchTransport';
import {
  resolveVoiceParams,
  type ConnectorSample,
} from './resolveVoiceParams';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';
import { findModulationChain } from './modulationChain';
import { listMonitorStrips, type MonitorStrip } from './monitorStrips';
import {
  appendSampleToHistory,
  emptySampleHistory,
  pruneSampleHistory,
  type SampleHistoryState,
} from './sampleHistory';
import { planVoiceCleanup } from './voiceCleanup';
import { connectorKindKeysFromNodes, streamUrlsForKindKeys } from './streamUrls';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'error';

function toRuntimeNodes(nodes: Node[]): RuntimeNode[] {
  return nodes
    .filter(
      (node) =>
        node.type === 'connector' || node.type === 'modulator' || node.type === 'oscillator',
    )
    .map((node) => ({
      id: node.id,
      type: node.type as RuntimeNode['type'],
      data: node.data as Record<string, unknown>,
    }));
}

function toRuntimeEdges(edges: Edge[]): RuntimeEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function isConnectorSample(value: unknown): value is ConnectorSample {
  if (!value || typeof value !== 'object') return false;
  const kindKey = (value as { kindKey?: unknown }).kindKey;
  return kindKey === 'usgs_earthquakes' || kindKey === 'noaa_coops_tides';
}

export function usePatchRuntime(nodes: Node[], edges: Edge[]) {
  const [transport, setTransport] = useState<PatchTransportState>(() => createPatchTransportState());
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('off');
  const [lastSample, setLastSample] = useState<ConnectorSample | null>(null);
  const [lastSamplesByKind, setLastSamplesByKind] = useState<
    Partial<Record<string, ConnectorSample>>
  >({});
  const [sampleHistoryByStripIdRaw, setSampleHistoryByStripId] =
    useState<SampleHistoryState>(emptySampleHistory);
  const [playStartedAtMs, setPlayStartedAtMs] = useState<number | null>(null);

  const engineRef = useRef<PatchAudioEngine | null>(null);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const samplesByKindRef = useRef<Partial<Record<string, ConnectorSample>>>({});
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const transportRef = useRef(transport);
  const syncStreamsRef = useRef<() => void>(() => {});
  const stripsRef = useRef<MonitorStrip[]>([]);

  const monitorStrips = useMemo(
    () => listMonitorStrips(toRuntimeNodes(nodes), toRuntimeEdges(edges)),
    [nodes, edges],
  );

  const sampleHistoryByStripId = useMemo(
    () => pruneSampleHistory(
      sampleHistoryByStripIdRaw,
      monitorStrips.map((strip) => strip.id),
    ),
    [sampleHistoryByStripIdRaw, monitorStrips],
  );

  useEffect(() => {
    stripsRef.current = monitorStrips;
  }, [monitorStrips]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  const applySamplesToVoices = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const playing = transportRef.current.playingOscillatorIds;
    const runtimeNodes = toRuntimeNodes(nodesRef.current);
    const runtimeEdges = toRuntimeEdges(edgesRef.current);

    for (const oscillatorId of playing) {
      const chain = findModulationChain(runtimeNodes, runtimeEdges, oscillatorId);
      const kindKey =
        chain.complete && typeof chain.connector.data.kindKey === 'string'
          ? chain.connector.data.kindKey
          : null;
      const sample = kindKey ? (samplesByKindRef.current[kindKey] ?? null) : null;
      const params = resolveVoiceParams(runtimeNodes, runtimeEdges, oscillatorId, sample);
      const osc = runtimeNodes.find((node) => node.id === oscillatorId);
      const restingFreq =
        typeof osc?.data.frequencyHz === 'number' ? osc.data.frequencyHz : params.frequencyHz;
      const restingGain = typeof osc?.data.gain === 'number' ? osc.data.gain : params.gain;
      const voice = await engine.ensureVoice(oscillatorId, restingFreq, restingGain);
      await voice.setFrequency(params.frequencyHz);
      await voice.setGain(params.gain);
      await engine.setVoiceAudible(oscillatorId, true);
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnectAllStreams = useCallback(() => {
    clearReconnectTimer();
    for (const source of eventSourcesRef.current.values()) {
      source.close();
    }
    eventSourcesRef.current.clear();
    reconnectAttemptRef.current = 0;
    setLiveStatus('off');
  }, [clearReconnectTimer]);

  const openStream = useCallback(
    (kindKey: string, url: string) => {
      if (eventSourcesRef.current.has(kindKey)) return;

      setLiveStatus((current) => (current === 'live' ? current : 'connecting'));
      const source = new EventSource(url);
      eventSourcesRef.current.set(kindKey, source);

      source.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!isConnectorSample(parsed)) {
            setLiveStatus('error');
            return;
          }
          samplesByKindRef.current = {
            ...samplesByKindRef.current,
            [parsed.kindKey]: parsed,
          };
          setLastSamplesByKind(samplesByKindRef.current);
          setLastSample(parsed);
          setSampleHistoryByStripId((prev) =>
            appendSampleToHistory(prev, stripsRef.current, parsed),
          );
          setLiveStatus('live');
          reconnectAttemptRef.current = 0;
          void applySamplesToVoices();
        } catch {
          setLiveStatus('error');
        }
      };

      source.onerror = () => {
        source.close();
        eventSourcesRef.current.delete(kindKey);
        setLiveStatus('error');

        if (!shouldHoldSharedStream(transportRef.current)) {
          return;
        }

        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current = attempt + 1;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (shouldHoldSharedStream(transportRef.current)) {
            syncStreamsRef.current();
          }
        }, delay);
      };
    },
    [applySamplesToVoices, clearReconnectTimer],
  );

  const syncStreams = useCallback(() => {
    const hold = shouldHoldSharedStream(transportRef.current);
    if (!hold) {
      disconnectAllStreams();
      return;
    }

    const kindKeys = connectorKindKeysFromNodes(nodesRef.current);
    const desired = streamUrlsForKindKeys(kindKeys);

    for (const [kindKey, source] of [...eventSourcesRef.current.entries()]) {
      if (!desired.has(kindKey)) {
        source.close();
        eventSourcesRef.current.delete(kindKey);
      }
    }

    for (const [kindKey, url] of desired) {
      openStream(kindKey, url);
    }

    if (desired.size === 0) {
      setLiveStatus('off');
    }
  }, [disconnectAllStreams, openStream]);

  useEffect(() => {
    syncStreamsRef.current = syncStreams;
  }, [syncStreams]);

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = await createPatchAudioEngine();
    }
    if (engineRef.current.ctx.state === 'suspended') {
      await engineRef.current.ctx.resume();
    }
    return engineRef.current;
  }, []);

  const getTimeDomainSnapshot = useCallback((out: Float32Array) => {
    const engine = engineRef.current;
    if (!engine) return false;
    return engine.getTimeDomainSnapshot(out);
  }, []);

  const syncTransportSideEffects = useCallback(
    async (next: PatchTransportState, prev: PatchTransportState) => {
      transportRef.current = next;
      const hold = shouldHoldSharedStream(next);
      if (hold) {
        await ensureEngine();
        syncStreams();
        if (prev.playingOscillatorIds.size === 0 && next.playingOscillatorIds.size > 0) {
          setPlayStartedAtMs(Date.now());
        }
      } else {
        disconnectAllStreams();
        samplesByKindRef.current = {};
        setLastSamplesByKind({});
        setLastSample(null);
        setSampleHistoryByStripId(emptySampleHistory());
        setPlayStartedAtMs(null);
      }

      const engine = engineRef.current;
      if (!engine) return;

      for (const id of prev.playingOscillatorIds) {
        if (!next.playingOscillatorIds.has(id)) {
          await engine.setVoiceAudible(id, false);
        }
      }

      if (hold) {
        await applySamplesToVoices();
      }
    },
    [applySamplesToVoices, disconnectAllStreams, ensureEngine, syncStreams],
  );

  const dispatchTransport = useCallback(
    (event: Parameters<typeof reducePatchTransport>[1]) => {
      setTransport((prev) => {
        const next = reducePatchTransport(prev, event);
        queueMicrotask(() => {
          void syncTransportSideEffects(next, prev);
        });
        return next;
      });
    },
    [syncTransportSideEffects],
  );

  const playOscillator = useCallback(
    (oscillatorId: string) => {
      dispatchTransport({ type: 'play', oscillatorId });
    },
    [dispatchTransport],
  );

  const stopOscillator = useCallback(
    (oscillatorId: string) => {
      dispatchTransport({ type: 'stop', oscillatorId });
    },
    [dispatchTransport],
  );

  const playAllOscillators = useCallback(() => {
    const ids = nodes
      .filter((node) => node.type === 'oscillator')
      .map((node) => node.id);
    dispatchTransport({ type: 'playAll', oscillatorIds: ids });
  }, [dispatchTransport, nodes]);

  const stopAllOscillators = useCallback(() => {
    dispatchTransport({ type: 'stopAll' });
  }, [dispatchTransport]);

  useEffect(() => {
    const graphOscillatorIds = new Set(
      nodes.filter((node) => node.type === 'oscillator').map((node) => node.id),
    );
    const engine = engineRef.current;
    const engineVoiceIds = new Set(engine?.listVoiceIds() ?? []);
    const { stopIds, removeIds } = planVoiceCleanup(
      graphOscillatorIds,
      transport.playingOscillatorIds,
      engineVoiceIds,
    );
    for (const id of stopIds) {
      dispatchTransport({ type: 'stop', oscillatorId: id });
    }
    if (engine) {
      for (const id of removeIds) {
        void engine.removeVoice(id);
      }
    }
  }, [nodes, dispatchTransport, transport.playingOscillatorIds]);

  useEffect(() => {
    if (!shouldHoldSharedStream(transport)) return;
    syncStreams();
    void applySamplesToVoices();
  }, [nodes, edges, transport, applySamplesToVoices, syncStreams]);

  useEffect(() => {
    return () => {
      disconnectAllStreams();
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        void engine.dispose();
      }
    };
  }, [disconnectAllStreams]);

  return {
    transport,
    liveStatus,
    lastSample,
    lastSamplesByKind,
    monitorStrips,
    sampleHistoryByStripId,
    playStartedAtMs,
    isPlaying: transport.playingOscillatorIds.size > 0,
    getTimeDomainSnapshot,
    playOscillator,
    stopOscillator,
    playAllOscillators,
    stopAllOscillators,
    isOscillatorPlaying: (id: string) => transport.playingOscillatorIds.has(id),
  };
}

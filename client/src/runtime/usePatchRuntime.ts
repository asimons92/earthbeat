import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';

import { getConnectorKind, oscillatorDefaults } from '@/generated/catalog';

import { createPatchAudioEngine, type PatchAudioEngine } from './audioEngine';
import { audioFxFingerprint, resolveOutboundAudioFxChain } from './audioFxChain';
import {
  advanceQueueClock,
  advanceScrubClock,
  createQueueClock,
  createScrubClock,
  replaceQueueSnapshot,
  retainScrubPhaseOnSeriesReplace,
  setClockPlaying,
  type QueueClock,
  type ScrubClock,
} from './connectorClock';
import {
  emptyConnectorSamples,
  setConnectorSample,
  type ConnectorSampleMap,
} from './connectorSamples';
import {
  createPatchTransportState,
  reducePatchTransport,
  shouldHoldSharedStream,
  type PatchTransportState,
} from './patchTransport';
import { PLAYBACK_SPEED_DEFAULT, monitorPlaybackSpeed } from './playbackSpeed';
import {
  monitorHistoryKeyFromClock,
  shouldAppendMonitorHistory,
  shouldPublishUiAt,
  type MonitorHistoryKey,
} from './playbackPublish';
import {
  resolveVoiceParams,
  type ConnectorSample,
} from './resolveVoiceParams';
import { listMonitorStrips, type MonitorStrip } from './monitorStrips';
import {
  appendSampleToHistory,
  emptySampleHistory,
  pruneSampleHistory,
  type SampleHistoryState,
} from './sampleHistory';
import {
  isTideSeriesSnapshot,
  isUsgsQueueSnapshot,
  isWaveSeriesSnapshot,
  sampleFromKindSnapshot,
  type KindSnapshot,
} from './sampleFromSnapshot';
import { planVoiceCleanup } from './voiceCleanup';
import { planVoiceParamApply } from './voiceParamApply';
import {
  canApplyVoice,
  filterLiveApplyTargets,
  planIdleEnginePurge,
  planStoppedVoiceRemoval,
  transportEventForPatchLoad,
} from './voiceStop';
import { connectorKindKeysFromNodes, streamUrlsForKindKeys } from './streamUrls';
import { toRuntimeEdges, toRuntimeNodes } from './runtimeNodes';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'error';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

type ConnectorClock = ScrubClock | QueueClock;

function catalogLoopSeconds(kindKey: string): number {
  const kind = getConnectorKind(kindKey) as
    | { defaultLoopSeconds?: number; defaultPlaybackHz?: number }
    | undefined;
  if (typeof kind?.defaultLoopSeconds === 'number' && kind.defaultLoopSeconds > 0) {
    return kind.defaultLoopSeconds;
  }
  return 120;
}

function catalogPlaybackHz(kindKey: string): number {
  const kind = getConnectorKind(kindKey);
  if (typeof kind?.defaultPlaybackHz === 'number' && kind.defaultPlaybackHz > 0) {
    return kind.defaultPlaybackHz;
  }
  return 1;
}

function ensureConnectorClock(
  existing: ConnectorClock | undefined,
  kindKey: string,
  queueLength: number,
): ConnectorClock {
  if (kindKey === 'usgs_earthquakes') {
    if (existing?.mode === 'queue') {
      return replaceQueueSnapshot(existing, queueLength);
    }
    return createQueueClock(queueLength);
  }
  if (existing?.mode === 'scrub') {
    return retainScrubPhaseOnSeriesReplace(existing);
  }
  return createScrubClock();
}

function ensureMonitorClock(
  existing: ConnectorClock | undefined,
  kindKey: string,
  queueLength: number,
): ConnectorClock {
  return ensureConnectorClock(existing, kindKey, queueLength);
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
  const snapshotsByKindRef = useRef<Partial<Record<string, KindSnapshot>>>({});
  const samplesByConnectorRef = useRef<ConnectorSampleMap<ConnectorSample>>(emptyConnectorSamples());
  const clocksByConnectorRef = useRef<Map<string, ConnectorClock>>(new Map());
  const monitorClocksByKindRef = useRef<Map<string, ConnectorClock>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef<number | null>(null);
  const lastUiPublishMsRef = useRef<number | null>(null);
  const monitorHistoryKeysRef = useRef<Map<string, MonitorHistoryKey>>(new Map());
  const voiceApplyInFlightRef = useRef(false);
  const voiceApplyQueuedRef = useRef(false);
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
    const snapshotPlaying = transportRef.current.playingOscillatorIds;
    const runtimeNodes = toRuntimeNodes(nodesRef.current);
    const runtimeEdges = toRuntimeEdges(edgesRef.current);

    for (const oscillatorId of filterLiveApplyTargets(
      snapshotPlaying,
      transportRef.current.playingOscillatorIds,
    )) {
      if (!canApplyVoice(transportRef.current.playingOscillatorIds, oscillatorId)) continue;
      const params = resolveVoiceParams(
        runtimeNodes,
        runtimeEdges,
        oscillatorId,
        samplesByConnectorRef.current,
      );
      const osc = runtimeNodes.find((node) => node.id === oscillatorId);
      const restingFreq =
        typeof osc?.data.frequencyHz === 'number' ? osc.data.frequencyHz : params.frequencyHz;
      const restingGain = typeof osc?.data.gain === 'number' ? osc.data.gain : params.gain;
      const waveform =
        typeof osc?.data.waveform === 'string' ? osc.data.waveform : oscillatorDefaults.waveform;
      if (!canApplyVoice(transportRef.current.playingOscillatorIds, oscillatorId)) continue;
      const fxChain = resolveOutboundAudioFxChain(runtimeNodes, runtimeEdges, oscillatorId);
      const fxSteps = fxChain.ok ? fxChain.steps : [];
      const fxFp = audioFxFingerprint(fxSteps);
      const voice = await engine.ensureVoice(
        oscillatorId,
        restingFreq,
        restingGain,
        waveform,
        fxSteps,
        fxFp,
      );
      if (!canApplyVoice(transportRef.current.playingOscillatorIds, oscillatorId)) {
        await engine.removeVoice(oscillatorId);
        continue;
      }
      const applyPlan = planVoiceParamApply(waveform, params.frequencyHz, params.gain);
      if (applyPlan.frequencyHz !== null) {
        await voice.setFrequency(applyPlan.frequencyHz);
      }
      await voice.setGain(applyPlan.gain);
      if (!canApplyVoice(transportRef.current.playingOscillatorIds, oscillatorId)) {
        await engine.removeVoice(oscillatorId);
        continue;
      }
      await engine.setVoiceAudible(oscillatorId, true);
    }
  }, []);

  const scheduleVoiceApply = useCallback(() => {
    if (voiceApplyInFlightRef.current) {
      voiceApplyQueuedRef.current = true;
      return;
    }
    voiceApplyInFlightRef.current = true;
    void (async () => {
      try {
        do {
          voiceApplyQueuedRef.current = false;
          await applySamplesToVoices();
        } while (voiceApplyQueuedRef.current);
      } finally {
        voiceApplyInFlightRef.current = false;
      }
    })();
  }, [applySamplesToVoices]);

  const tickPlayback = useCallback(
    (nowMs: number) => {
      const holding = shouldHoldSharedStream(transportRef.current);
      const last = lastFrameMsRef.current;
      lastFrameMsRef.current = nowMs;
      if (!holding) {
        lastFrameMsRef.current = null;
        return;
      }
      const dtSeconds = last === null ? 0 : Math.min(0.25, Math.max(0, (nowMs - last) / 1000));

      let samples = samplesByConnectorRef.current;
      const kindSamples: Partial<Record<string, ConnectorSample>> = {};
      const historySamples: ConnectorSample[] = [];

      for (const node of nodesRef.current) {
        if (node.type !== 'connector') continue;
        const kindKey = typeof node.data.kindKey === 'string' ? node.data.kindKey : '';
        const snapshot = snapshotsByKindRef.current[kindKey];
        if (!snapshot) continue;

        const queueLength =
          snapshot.kindKey === 'usgs_earthquakes' ? snapshot.items.length : 0;
        let clock = clocksByConnectorRef.current.get(node.id);
        clock = ensureConnectorClock(clock, kindKey, queueLength);
        clock = setClockPlaying(clock, true);

        const playbackSpeed =
          typeof node.data.playbackSpeed === 'number'
            ? node.data.playbackSpeed
            : PLAYBACK_SPEED_DEFAULT;

        if (clock.mode === 'scrub') {
          clock = advanceScrubClock(
            clock,
            dtSeconds,
            catalogLoopSeconds(kindKey),
            playbackSpeed,
          );
        } else {
          clock = advanceQueueClock(
            clock,
            dtSeconds,
            catalogPlaybackHz(kindKey),
            playbackSpeed,
          );
        }
        clocksByConnectorRef.current.set(node.id, clock);

        const sample = sampleFromKindSnapshot(snapshot, clock);
        if (sample) {
          samples = setConnectorSample(samples, node.id, sample);
        }
      }

      const monitorKinds = new Set(stripsRef.current.map((strip) => strip.kindKey));
      for (const kindKey of monitorKinds) {
        const snapshot = snapshotsByKindRef.current[kindKey];
        if (!snapshot) continue;
        const queueLength =
          snapshot.kindKey === 'usgs_earthquakes' ? snapshot.items.length : 0;
        let clock = monitorClocksByKindRef.current.get(kindKey);
        clock = ensureMonitorClock(clock, kindKey, queueLength);
        clock = setClockPlaying(clock, true);
        if (clock.mode === 'scrub') {
          clock = advanceScrubClock(
            clock,
            dtSeconds,
            catalogLoopSeconds(kindKey),
            monitorPlaybackSpeed(),
          );
        } else {
          clock = advanceQueueClock(
            clock,
            dtSeconds,
            catalogPlaybackHz(kindKey),
            monitorPlaybackSpeed(),
          );
        }
        monitorClocksByKindRef.current.set(kindKey, clock);
        const sample = sampleFromKindSnapshot(snapshot, clock);
        if (sample) {
          kindSamples[kindKey] = sample;
          const historyKey = monitorHistoryKeyFromClock(clock);
          const previousKey = monitorHistoryKeysRef.current.get(kindKey);
          if (shouldAppendMonitorHistory(previousKey, historyKey)) {
            monitorHistoryKeysRef.current.set(kindKey, historyKey);
            historySamples.push(sample);
          }
        }
      }

      samplesByConnectorRef.current = samples;
      // Clocks and voice params stay on every animation frame.
      scheduleVoiceApply();

      if (historySamples.length > 0) {
        setSampleHistoryByStripId((prev) => {
          let next = prev;
          for (const sample of historySamples) {
            next = appendSampleToHistory(next, stripsRef.current, sample);
          }
          return next;
        });
      }

      if (
        Object.keys(kindSamples).length > 0 &&
        shouldPublishUiAt(nowMs, lastUiPublishMsRef.current)
      ) {
        lastUiPublishMsRef.current = nowMs;
        setLastSamplesByKind((prev) => ({ ...prev, ...kindSamples }));
        const anySample = Object.values(kindSamples)[0];
        if (anySample) setLastSample(anySample);
      }
    },
    [scheduleVoiceApply],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameMsRef.current = null;
    lastUiPublishMsRef.current = null;
  }, []);

  const startRaf = useCallback(() => {
    if (rafRef.current !== null) return;
    const loop = (nowMs: number) => {
      tickPlayback(nowMs);
      if (shouldHoldSharedStream(transportRef.current)) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        lastFrameMsRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [tickPlayback]);

  const applySnapshot = useCallback((kindKey: string, snapshot: KindSnapshot) => {
    snapshotsByKindRef.current = {
      ...snapshotsByKindRef.current,
      [kindKey]: snapshot,
    };
    const queueLength =
      snapshot.kindKey === 'usgs_earthquakes' ? snapshot.items.length : 0;

    for (const node of nodesRef.current) {
      if (node.type !== 'connector') continue;
      if (node.data.kindKey !== kindKey) continue;
      const existing = clocksByConnectorRef.current.get(node.id);
      clocksByConnectorRef.current.set(
        node.id,
        ensureConnectorClock(existing, kindKey, queueLength),
      );
    }

    const monitorExisting = monitorClocksByKindRef.current.get(kindKey);
    monitorClocksByKindRef.current.set(
      kindKey,
      ensureMonitorClock(monitorExisting, kindKey, queueLength),
    );

    setLiveStatus('live');
    reconnectAttemptRef.current = 0;
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

      const onPayload = (event: MessageEvent<string>) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isUsgsQueueSnapshot(parsed) && kindKey === 'usgs_earthquakes') {
            applySnapshot(kindKey, parsed);
            return;
          }
          if (isTideSeriesSnapshot(parsed) && kindKey === 'noaa_coops_tides') {
            applySnapshot(kindKey, parsed);
            return;
          }
          if (isWaveSeriesSnapshot(parsed) && kindKey === 'ndbc_buoy_waves') {
            applySnapshot(kindKey, parsed);
            return;
          }
          setLiveStatus('error');
        } catch {
          setLiveStatus('error');
        }
      };

      source.addEventListener('queue', onPayload as EventListener);
      source.addEventListener('series', onPayload as EventListener);

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
    [applySnapshot, clearReconnectTimer],
  );

  const syncStreams = useCallback(() => {
    const hold = shouldHoldSharedStream(transportRef.current);
    if (!hold) {
      disconnectAllStreams();
      stopRaf();
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
    } else {
      startRaf();
    }
  }, [disconnectAllStreams, openStream, startRaf, stopRaf]);

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
        for (const [id, clock] of clocksByConnectorRef.current) {
          clocksByConnectorRef.current.set(id, setClockPlaying(clock, true));
        }
        for (const [kind, clock] of monitorClocksByKindRef.current) {
          monitorClocksByKindRef.current.set(kind, setClockPlaying(clock, true));
        }
      } else {
        disconnectAllStreams();
        stopRaf();
        for (const [id, clock] of clocksByConnectorRef.current) {
          clocksByConnectorRef.current.set(id, setClockPlaying(clock, false));
        }
        for (const [kind, clock] of monitorClocksByKindRef.current) {
          monitorClocksByKindRef.current.set(kind, setClockPlaying(clock, false));
        }
        samplesByConnectorRef.current = emptyConnectorSamples();
        monitorHistoryKeysRef.current.clear();
        lastUiPublishMsRef.current = null;
        setLastSamplesByKind({});
        setLastSample(null);
        setSampleHistoryByStripId(emptySampleHistory());
        setPlayStartedAtMs(null);
      }

      const engine = engineRef.current;
      if (!engine) return;

      const stoppedIds = planStoppedVoiceRemoval(
        prev.playingOscillatorIds,
        next.playingOscillatorIds,
      );
      for (const id of stoppedIds) {
        await engine.removeVoice(id);
      }

      if (next.playingOscillatorIds.size === 0) {
        await engine.clearAllVoices();
      } else {
        for (const id of planIdleEnginePurge(
          next.playingOscillatorIds,
          new Set(engine.listVoiceIds()),
        )) {
          await engine.removeVoice(id);
        }
      }

      if (hold) {
        await applySamplesToVoices();
      }
    },
    [applySamplesToVoices, disconnectAllStreams, ensureEngine, stopRaf, syncStreams],
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

  const resetTransportForPatchLoad = useCallback(() => {
    clocksByConnectorRef.current.clear();
    monitorClocksByKindRef.current.clear();
    monitorHistoryKeysRef.current.clear();
    lastUiPublishMsRef.current = null;
    snapshotsByKindRef.current = {};
    samplesByConnectorRef.current = emptyConnectorSamples();
    dispatchTransport(transportEventForPatchLoad());
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

    const connectorIds = new Set(
      nodes.filter((node) => node.type === 'connector').map((node) => node.id),
    );
    for (const id of [...clocksByConnectorRef.current.keys()]) {
      if (!connectorIds.has(id)) clocksByConnectorRef.current.delete(id);
    }
  }, [nodes, dispatchTransport, transport.playingOscillatorIds]);

  useEffect(() => {
    if (!shouldHoldSharedStream(transport)) return;
    syncStreams();
    scheduleVoiceApply();
  }, [nodes, edges, transport, scheduleVoiceApply, syncStreams]);

  useEffect(() => {
    return () => {
      stopRaf();
      disconnectAllStreams();
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        void engine.dispose();
      }
    };
  }, [disconnectAllStreams, stopRaf]);

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
    resetTransportForPatchLoad,
    isOscillatorPlaying: (id: string) => transport.playingOscillatorIds.has(id),
  };
}

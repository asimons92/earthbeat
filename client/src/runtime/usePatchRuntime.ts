import { useCallback, useEffect, useRef, useState } from 'react';
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
  type EarthquakeSample,
} from './resolveVoiceParams';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';
import { planVoiceCleanup } from './voiceCleanup';

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

const STREAM_URL = '/api/earthquakes/stream';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

export function usePatchRuntime(nodes: Node[], edges: Edge[]) {
  const [transport, setTransport] = useState<PatchTransportState>(() => createPatchTransportState());
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('off');
  const [lastSample, setLastSample] = useState<EarthquakeSample | null>(null);

  const engineRef = useRef<PatchAudioEngine | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleRef = useRef<EarthquakeSample | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const transportRef = useRef(transport);
  const connectStreamRef = useRef<() => void>(() => {});

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  const applySampleToVoices = useCallback(async (sample: EarthquakeSample | null) => {
    const engine = engineRef.current;
    if (!engine) return;
    const playing = transportRef.current.playingOscillatorIds;
    const runtimeNodes = toRuntimeNodes(nodesRef.current);
    const runtimeEdges = toRuntimeEdges(edgesRef.current);

    for (const oscillatorId of playing) {
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

  const disconnectStream = useCallback(() => {
    clearReconnectTimer();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setLiveStatus('off');
  }, [clearReconnectTimer]);

  const connectStream = useCallback(() => {
    if (eventSourceRef.current) return;

    setLiveStatus('connecting');
    const source = new EventSource(STREAM_URL);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const sample = JSON.parse(event.data) as EarthquakeSample;
        sampleRef.current = sample;
        setLastSample(sample);
        setLiveStatus('live');
        reconnectAttemptRef.current = 0;
        void applySampleToVoices(sample);
      } catch {
        setLiveStatus('error');
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setLiveStatus('error');
      sampleRef.current = null;
      void applySampleToVoices(null);

      if (!shouldHoldSharedStream(transportRef.current)) {
        return;
      }

      const attempt = reconnectAttemptRef.current;
      reconnectAttemptRef.current = attempt + 1;
      const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        if (shouldHoldSharedStream(transportRef.current)) {
          connectStreamRef.current();
        }
      }, delay);
    };
  }, [applySampleToVoices, clearReconnectTimer]);

  useEffect(() => {
    connectStreamRef.current = connectStream;
  }, [connectStream]);

  const ensureEngine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = await createPatchAudioEngine();
    }
    if (engineRef.current.ctx.state === 'suspended') {
      await engineRef.current.ctx.resume();
    }
    return engineRef.current;
  }, []);

  const syncTransportSideEffects = useCallback(
    async (next: PatchTransportState, prev: PatchTransportState) => {
      // Keep the ref in sync before any voice work. React state effects run later.
      transportRef.current = next;
      const hold = shouldHoldSharedStream(next);
      if (hold) {
        await ensureEngine();
        connectStream();
      } else {
        disconnectStream();
        sampleRef.current = null;
        setLastSample(null);
      }

      const engine = engineRef.current;
      if (!engine) return;

      for (const id of prev.playingOscillatorIds) {
        if (!next.playingOscillatorIds.has(id)) {
          await engine.setVoiceAudible(id, false);
        }
      }

      // Only drive playing voices. Re-applying after stop would unmute the base tone.
      if (hold) {
        await applySampleToVoices(sampleRef.current);
      }
    },
    [applySampleToVoices, connectStream, disconnectStream, ensureEngine],
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
    void applySampleToVoices(sampleRef.current);
  }, [nodes, edges, transport, applySampleToVoices]);

  useEffect(() => {
    return () => {
      disconnectStream();
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        void engine.dispose();
      }
    };
  }, [disconnectStream]);

  return {
    transport,
    liveStatus,
    lastSample,
    playOscillator,
    stopOscillator,
    playAllOscillators,
    stopAllOscillators,
    isOscillatorPlaying: (id: string) => transport.playingOscillatorIds.has(id),
  };
}

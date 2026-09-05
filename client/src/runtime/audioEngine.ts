import { el, type ElemNode } from '@elemaudio/core';
import WebRenderer from '@elemaudio/web-renderer';

import {
  buildOscillatorTone,
  OSCILLATOR_WAVEFORM_KEYS,
  planVoiceEnsure,
  resolveOscillatorWaveform,
} from './oscillatorTone';
import { enqueueSerialTask } from './serialTaskQueue';

export type VoiceControls = {
  setFrequency: (freqHz: number) => Promise<void>;
  setGain: (gain: number) => Promise<void>;
};

export type PatchAudioEngine = {
  ctx: AudioContext;
  ensureVoice: (
    oscillatorId: string,
    initialFreqHz: number,
    initialGain: number,
    waveform?: string,
  ) => Promise<VoiceControls>;
  setVoiceAudible: (oscillatorId: string, audible: boolean) => Promise<void>;
  removeVoice: (oscillatorId: string) => Promise<void>;
  /** Drop every voice and commit silence (Stop / idle). */
  clearAllVoices: () => Promise<void>;
  listVoiceIds: () => string[];
  /** Copy current time-domain analyser data into `out` (−1..1). Returns false if unavailable. */
  getTimeDomainSnapshot: (out: Float32Array) => boolean;
  dispose: () => Promise<void>;
};

type VoiceState = {
  controls: VoiceControls;
  setGainProps: (props: { value: number }) => Promise<void>;
  lastGain: number;
  audible: boolean;
  tone: ElemNode;
  waveform: string;
};

export async function createPatchAudioEngine(): Promise<PatchAudioEngine> {
  const ctx = new AudioContext();
  const core = new WebRenderer();
  const node = await core.initialize(ctx, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  node.connect(analyser);
  analyser.connect(ctx.destination);
  await ctx.resume();

  const voices = new Map<string, VoiceState>();
  /** Serialize graph rebuilds so a stale core.render cannot restore a removed voice. */
  let rebuildQueue: Promise<void> = Promise.resolve();

  function enqueueRebuild(): Promise<void> {
    rebuildQueue = enqueueSerialTask(rebuildQueue, async () => {
      const tones = [...voices.values()].map((voice) => voice.tone);
      if (tones.length === 0) {
        const silence = el.const({ value: 0 });
        await core.render(silence, silence);
        return;
      }
      let mix: ElemNode = tones[0]!;
      for (let i = 1; i < tones.length; i++) {
        mix = el.add(mix, tones[i]!);
      }
      await core.render(mix, mix);
    });
    return rebuildQueue;
  }

  async function createVoice(
    oscillatorId: string,
    initialFreqHz: number,
    initialGain: number,
    waveform: string,
  ): Promise<VoiceControls> {
    const resolvedWaveform = resolveOscillatorWaveform(waveform);
    const [freq, setFreqProps] = core.createRef('const', { value: initialFreqHz }, []) as [
      ElemNode,
      (props: { value: number }) => Promise<void>,
    ];
    const [gain, setGainProps] = core.createRef('const', { value: initialGain }, []) as [
      ElemNode,
      (props: { value: number }) => Promise<void>,
    ];
    const tone = el.mul(buildOscillatorTone(resolvedWaveform, freq), gain);

    const controls: VoiceControls = {
      setFrequency: async (freqHz) => {
        await setFreqProps({ value: freqHz });
      },
      setGain: async (nextGain) => {
        const voice = voices.get(oscillatorId);
        if (!voice) {
          await setGainProps({ value: nextGain });
          return;
        }
        voice.lastGain = nextGain;
        if (voice.audible) {
          await setGainProps({ value: nextGain });
        }
      },
    };

    voices.set(oscillatorId, {
      controls,
      setGainProps,
      lastGain: initialGain,
      audible: true,
      tone,
      waveform: resolvedWaveform,
    });

    await enqueueRebuild();
    return controls;
  }

  async function ensureVoice(
    oscillatorId: string,
    initialFreqHz: number,
    initialGain: number,
    waveform = OSCILLATOR_WAVEFORM_KEYS[0],
  ): Promise<VoiceControls> {
    const existing = voices.get(oscillatorId);
    const plan = planVoiceEnsure(existing?.waveform, waveform);

    if (plan === 'reuse' && existing) {
      return existing.controls;
    }

    if (plan === 'rebuild' && existing) {
      voices.delete(oscillatorId);
      await enqueueRebuild();
    }

    return createVoice(oscillatorId, initialFreqHz, initialGain, waveform);
  }

  async function setVoiceAudible(oscillatorId: string, audible: boolean) {
    const voice = voices.get(oscillatorId);
    if (!voice) return;
    voice.audible = audible;
    await voice.setGainProps({ value: audible ? voice.lastGain : 0 });
  }

  async function removeVoice(oscillatorId: string) {
    if (!voices.has(oscillatorId)) return;
    voices.delete(oscillatorId);
    await enqueueRebuild();
  }

  async function clearAllVoices() {
    if (voices.size === 0) {
      await enqueueRebuild();
      return;
    }
    voices.clear();
    await enqueueRebuild();
  }

  function listVoiceIds() {
    return [...voices.keys()];
  }

  function getTimeDomainSnapshot(out: Float32Array): boolean {
    if (ctx.state === 'closed') return false;
    analyser.getFloatTimeDomainData(out as Float32Array<ArrayBuffer>);
    return true;
  }

  async function dispose() {
    voices.clear();
    try {
      await enqueueRebuild();
    } catch {
      // Renderer may already be torn down.
    }
    analyser.disconnect();
    node.disconnect();
    await ctx.close();
  }

  return {
    ctx,
    ensureVoice,
    setVoiceAudible,
    removeVoice,
    clearAllVoices,
    listVoiceIds,
    getTimeDomainSnapshot,
    dispose,
  };
}

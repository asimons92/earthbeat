import { el, type ElemNode } from '@elemaudio/core';
import WebRenderer from '@elemaudio/web-renderer';

export type VoiceControls = {
  setFrequency: (freqHz: number) => Promise<void>;
  setGain: (gain: number) => Promise<void>;
};

export type PatchAudioEngine = {
  ctx: AudioContext;
  ensureVoice: (oscillatorId: string, initialFreqHz: number, initialGain: number) => Promise<VoiceControls>;
  setVoiceAudible: (oscillatorId: string, audible: boolean) => Promise<void>;
  dispose: () => Promise<void>;
};

type VoiceState = {
  controls: VoiceControls;
  setGainProps: (props: { value: number }) => Promise<void>;
  lastGain: number;
  audible: boolean;
  tone: ElemNode;
};

function sineTone(t: ElemNode) {
  return el.sin(el.mul(2 * Math.PI, t));
}

export async function createPatchAudioEngine(): Promise<PatchAudioEngine> {
  const ctx = new AudioContext();
  const core = new WebRenderer();
  const node = await core.initialize(ctx, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  node.connect(ctx.destination);
  await ctx.resume();

  const voices = new Map<string, VoiceState>();
  let renderGeneration = 0;

  async function rebuildGraph() {
    const generation = ++renderGeneration;
    const tones = [...voices.values()].map((voice) => voice.tone);
    if (tones.length === 0) {
      const silence = el.const({ value: 0 });
      if (generation === renderGeneration) {
        await core.render(silence, silence);
      }
      return;
    }
    let mix: ElemNode = tones[0]!;
    for (let i = 1; i < tones.length; i++) {
      mix = el.add(mix, tones[i]!);
    }
    if (generation === renderGeneration) {
      await core.render(mix, mix);
    }
  }

  async function ensureVoice(
    oscillatorId: string,
    initialFreqHz: number,
    initialGain: number,
  ): Promise<VoiceControls> {
    const existing = voices.get(oscillatorId);
    if (existing) {
      return existing.controls;
    }

    const [freq, setFreqProps] = core.createRef('const', { value: initialFreqHz }, []) as [
      ElemNode,
      (props: { value: number }) => Promise<void>,
    ];
    const [gain, setGainProps] = core.createRef('const', { value: initialGain }, []) as [
      ElemNode,
      (props: { value: number }) => Promise<void>,
    ];
    const tone = el.mul(sineTone(el.phasor(freq)), gain);

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
    });

    await rebuildGraph();
    return controls;
  }

  async function setVoiceAudible(oscillatorId: string, audible: boolean) {
    const voice = voices.get(oscillatorId);
    if (!voice) return;
    voice.audible = audible;
    await voice.setGainProps({ value: audible ? voice.lastGain : 0 });
  }

  async function dispose() {
    voices.clear();
    await ctx.close();
  }

  return {
    ctx,
    ensureVoice,
    setVoiceAudible,
    dispose,
  };
}

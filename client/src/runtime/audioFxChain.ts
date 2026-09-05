/** Outbound Oscillator → audio Effect* chain for Elementary tone baking. */

import { getEffectKind } from '@/generated/catalog';

import {
  clampDrive,
  clampFeedback,
  clampMix,
  clampTimeMs,
  DRIVE_DEFAULT,
  FEEDBACK_DEFAULT,
  MIX_DEFAULT,
  TIME_MS_DEFAULT,
} from './audioFxParams';
import type { RuntimeEdge, RuntimeNode } from './modulationChain';

export type DistortionFxStep = {
  id: string;
  kind: 'distortion';
  enabled: boolean;
  drive: number;
};

export type DelayFxStep = {
  id: string;
  kind: 'delay';
  enabled: boolean;
  timeMs: number;
  feedback: number;
  mix: number;
};

export type AudioFxStep = DistortionFxStep | DelayFxStep;

export type AudioFxChainOk = {
  ok: true;
  steps: AudioFxStep[];
};

export type AudioFxChainFail = {
  ok: false;
  reason: 'missing_oscillator' | 'fan_in' | 'fan_out' | 'unknown_audio_kind';
};

export type AudioFxChainResult = AudioFxChainOk | AudioFxChainFail;

export type AudioFxIssueReason = Exclude<AudioFxChainFail['reason'], 'missing_oscillator'>;

const AUDIO_KIND_DISTORTION = 'distortion';
const AUDIO_KIND_DELAY = 'delay';

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** True when the EffectKind catalog entry transforms audio (not control Hertz). */
export function isAudioEffectKindKey(kindKey: string): boolean {
  const kind = getEffectKind(kindKey);
  return (kind?.transforms ?? []).some((entry) => entry === 'audio');
}

export function isAudioEffectNode(node: RuntimeNode): boolean {
  if (node.type !== 'effect') return false;
  return isAudioEffectKindKey(asString(node.data.kindKey, ''));
}

function toAudioFxStep(node: RuntimeNode): AudioFxStep | null {
  if (!isAudioEffectNode(node)) return null;
  const kindKey = asString(node.data.kindKey, '');
  const enabled = asBoolean(node.data.enabled, true);
  if (kindKey === AUDIO_KIND_DISTORTION) {
    return {
      id: node.id,
      kind: 'distortion',
      enabled,
      drive: clampDrive(asNumber(node.data.drive, DRIVE_DEFAULT)),
    };
  }
  if (kindKey === AUDIO_KIND_DELAY) {
    return {
      id: node.id,
      kind: 'delay',
      enabled,
      timeMs: clampTimeMs(asNumber(node.data.timeMs, TIME_MS_DEFAULT)),
      feedback: clampFeedback(asNumber(node.data.feedback, FEEDBACK_DEFAULT)),
      mix: clampMix(asNumber(node.data.mix, MIX_DEFAULT)),
    };
  }
  return null;
}

/**
 * Walk Oscillator → audio Effect* in source-to-sink order.
 * Rejects fan-in (target with more than one inbound) and fan-out (more than one outbound audio edge).
 * Control Effects on the outbound path are skipped (not followed).
 */
export function resolveOutboundAudioFxChain(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  oscillatorId: string,
): AudioFxChainResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const osc = byId.get(oscillatorId);
  if (!osc || osc.type !== 'oscillator') {
    return { ok: false, reason: 'missing_oscillator' };
  }

  const inboundCount = new Map<string, number>();
  for (const edge of edges) {
    inboundCount.set(edge.target, (inboundCount.get(edge.target) ?? 0) + 1);
  }

  const steps: AudioFxStep[] = [];
  let cursor = oscillatorId;
  const visited = new Set<string>([oscillatorId]);

  while (true) {
    const outbound = edges.filter((edge) => {
      if (edge.source !== cursor) return false;
      const target = byId.get(edge.target);
      return target ? isAudioEffectNode(target) : false;
    });

    if (outbound.length === 0) {
      return { ok: true, steps };
    }
    if (outbound.length > 1) {
      return { ok: false, reason: 'fan_out' };
    }

    const nextEdge = outbound[0]!;
    const next = byId.get(nextEdge.target);
    if (!next) {
      return { ok: true, steps };
    }

    if ((inboundCount.get(next.id) ?? 0) > 1) {
      return { ok: false, reason: 'fan_in' };
    }
    if (visited.has(next.id)) {
      return { ok: false, reason: 'fan_in' };
    }

    const step = toAudioFxStep(next);
    if (!step) {
      return { ok: false, reason: 'unknown_audio_kind' };
    }

    steps.push(step);
    visited.add(next.id);
    cursor = next.id;
  }
}

/** Short canvas and inspector status when an outbound audio FX chain is illegal. */
export function audioFxFailureLabel(reason: AudioFxIssueReason): string {
  if (reason === 'fan_in') return 'FX fan-in — dry';
  if (reason === 'fan_out') return 'FX fan-out — dry';
  return 'unknown audio FX — dry';
}

/** Audio Effect ids reachable outbound from start along audio wires (ignores fan rules). */
function outboundAudioEffectIds(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
  startId: string,
): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const found: string[] = [];
  const queue = [startId];
  const visited = new Set<string>([startId]);
  while (queue.length > 0) {
    const cursor = queue.shift()!;
    for (const edge of edges) {
      if (edge.source !== cursor) continue;
      const target = byId.get(edge.target);
      if (!target || !isAudioEffectNode(target)) continue;
      if (visited.has(target.id)) continue;
      visited.add(target.id);
      found.push(target.id);
      queue.push(target.id);
    }
  }
  return found;
}

/**
 * Status labels for Oscillators and audio Effects on illegal outbound chains.
 * Legal chains and Oscillators with no audio Effects are omitted.
 */
export function audioFxIssueLabelsByNodeId(
  nodes: RuntimeNode[],
  edges: RuntimeEdge[],
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== 'oscillator') continue;
    const result = resolveOutboundAudioFxChain(nodes, edges, node.id);
    if (result.ok || result.reason === 'missing_oscillator') continue;
    const label = audioFxFailureLabel(result.reason);
    labels.set(node.id, label);
    for (const effectId of outboundAudioEffectIds(nodes, edges, node.id)) {
      labels.set(effectId, label);
    }
  }
  return labels;
}

/** Stable identity for voice rebuild when FX topology or params change. */
export function audioFxFingerprint(steps: AudioFxStep[]): string {
  if (steps.length === 0) return '';
  return steps
    .map((step) => {
      if (step.kind === 'distortion') {
        return `${step.id}:distortion:${step.enabled ? 1 : 0}:${step.drive}`;
      }
      return `${step.id}:delay:${step.enabled ? 1 : 0}:${step.timeMs}:${step.feedback}:${step.mix}`;
    })
    .join('|');
}

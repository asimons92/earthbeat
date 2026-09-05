import type { Connection, Edge, Node } from '@xyflow/react';

import { getEffectKind } from '@/generated/catalog';

import {
  canConnectPatchNodes,
  effectRoleFromTransforms,
  type PatchWireRole,
} from './patchWireRules';

function roleForNode(node: Node | undefined): PatchWireRole | null {
  if (!node) return null;
  if (node.type === 'connector') return 'connector';
  if (node.type === 'modulator') return 'modulator';
  if (node.type === 'oscillator') return 'oscillator';
  if (node.type === 'effect') {
    const kindKey = String((node.data as { kindKey?: unknown }).kindKey ?? '');
    const kind = getEffectKind(kindKey);
    return effectRoleFromTransforms(kind?.transforms ?? []);
  }
  return null;
}

function isAudioEffectNode(node: Node | undefined): boolean {
  return roleForNode(node) === 'audio_effect';
}

/** React Flow isValidConnection using control vs audio Effect rules. */
export function isValidPatchConnection(
  connection: Connection | Edge,
  nodes: Node[],
  edges: Edge[],
): boolean {
  const sourceId = connection.source;
  const targetId = connection.target;
  if (!sourceId || !targetId || sourceId === targetId) return false;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const source = byId.get(sourceId);
  const target = byId.get(targetId);
  const sourceRole = roleForNode(source);
  const targetRole = roleForNode(target);
  if (!sourceRole || !targetRole) return false;

  const targetInboundCount = edges.filter((edge) => edge.target === targetId).length;
  const sourceAudioOutboundCount = edges.filter((edge) => {
    if (edge.source !== sourceId) return false;
    return isAudioEffectNode(byId.get(edge.target));
  }).length;

  return canConnectPatchNodes({
    sourceRole,
    targetRole,
    targetInboundCount,
    sourceAudioOutboundCount,
  });
}

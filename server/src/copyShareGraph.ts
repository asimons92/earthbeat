type IdRow = { id: string; patchId: string };

type WireRow = IdRow & {
  sourceNodeId: string;
  targetNodeId: string;
};

export type CopyShareGraph = {
  connectors: IdRow[];
  modulators: IdRow[];
  oscillators: IdRow[];
  effects: IdRow[];
  wires: WireRow[];
};

function nodeRows(graph: CopyShareGraph): IdRow[] {
  return [...graph.connectors, ...graph.modulators, ...graph.oscillators, ...graph.effects];
}

function allRows(graph: CopyShareGraph): IdRow[] {
  return [...nodeRows(graph), ...graph.wires];
}

/** Mint new ids and retarget wires. The source graph is not changed. */
export function copyShareGraph<T extends CopyShareGraph>(
  graph: T,
  nextPatchId: string,
  mintedIds: readonly string[],
): T {
  const rows = allRows(graph);
  const sourceIds = rows.map((row) => row.id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error('Share copy rejected duplicate source ids');
  }

  const nodeIds = new Set(nodeRows(graph).map((row) => row.id));
  for (const wire of graph.wires) {
    if (!nodeIds.has(wire.sourceNodeId) || !nodeIds.has(wire.targetNodeId)) {
      throw new Error('Share copy rejected a dangling wire');
    }
  }

  if (mintedIds.length !== sourceIds.length) {
    throw new Error('Share copy rejected a mint list of the wrong length');
  }
  if (new Set(mintedIds).size !== mintedIds.length) {
    throw new Error('Share copy rejected duplicate mint ids');
  }
  const sourceIdSet = new Set(sourceIds);
  for (const id of mintedIds) {
    if (sourceIdSet.has(id)) {
      throw new Error('Share copy rejected a mint id that already belongs to the source');
    }
  }

  const idMap = new Map<string, string>();
  let cursor = 0;
  const take = (oldId: string): string => {
    const minted = mintedIds[cursor];
    cursor += 1;
    if (minted === undefined) {
      throw new Error('Share copy rejected a mint list of the wrong length');
    }
    idMap.set(oldId, minted);
    return minted;
  };

  const cloneRow = <Row extends IdRow>(row: Row): Row => {
    const copy = structuredClone(row);
    copy.id = take(row.id);
    copy.patchId = nextPatchId;
    return copy;
  };

  return {
    connectors: graph.connectors.map((row) => cloneRow(row)),
    modulators: graph.modulators.map((row) => cloneRow(row)),
    oscillators: graph.oscillators.map((row) => cloneRow(row)),
    effects: graph.effects.map((row) => cloneRow(row)),
    wires: graph.wires.map((row) => {
      const copy = cloneRow(row);
      const sourceNodeId = idMap.get(row.sourceNodeId);
      const targetNodeId = idMap.get(row.targetNodeId);
      if (sourceNodeId === undefined || targetNodeId === undefined) {
        throw new Error('Share copy rejected a dangling wire');
      }
      copy.sourceNodeId = sourceNodeId;
      copy.targetNodeId = targetNodeId;
      return copy;
    }),
  } as T;
}

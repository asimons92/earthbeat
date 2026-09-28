import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import type { DomainGraph, DomainWire } from '@/persist/graphMapper';
import { BLANK_PATCH_NAME } from '@/persist/patchFileActions';
import {
  copyShareGraph,
  decidePatchRead,
  decideShareOffer,
  initialShareSession,
  libraryRowDetail,
  patchIdsVisibleToUser,
  shareTokenFromPath,
  projectSharedPatch,
  initialPatchGraphLock,
  initialShareLinkRace,
  reducePatchGraphLock,
  reduceShareLinkRace,
  reduceShareSession,
  reduceShareToken,
  shareSessionBlocksPersist,
  snapshotWiresFit,
  type CanvasShareSubject,
  type PatchRead,
  type PatchReadRequest,
  type ShareCanvasSnapshot,
  type PatchGraphLockState,
  type PatchGraphSnapshot,
  type ShareLinkRaceState,
  type ShareOffer,
  type ShareSessionState,
  type ShareTokenState,
} from './shareSession';

const wordArb = fc.string({ minLength: 1, maxLength: 8 });
const finiteArb = fc.double({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 });
const versionArb = fc.integer({ min: 1, max: 10_000 });

const connectorBodyArb = fc.record({
  kindKey: wordArb,
  positionX: finiteArb,
  positionY: finiteArb,
});

const modulatorBodyArb = fc.record({
  channelKey: wordArb,
  targetParam: wordArb,
  positionX: finiteArb,
  positionY: finiteArb,
  inMin: finiteArb,
  inMax: finiteArb,
  outMin: finiteArb,
  outMax: finiteArb,
});

const oscillatorBodyArb = fc.record({
  waveform: fc.constantFrom('sine', 'square', 'saw', 'noise'),
  positionX: finiteArb,
  positionY: finiteArb,
  frequencyHz: finiteArb,
  gain: finiteArb,
});

const effectBodyArb = fc.record({
  kindKey: wordArb,
  positionX: finiteArb,
  positionY: finiteArb,
  tonic: wordArb,
  scaleKey: wordArb,
  enabled: fc.boolean(),
  a4Hz: finiteArb,
  drive: finiteArb,
  timeMs: finiteArb,
  feedback: finiteArb,
  mix: finiteArb,
});

const subjectArb: fc.Arbitrary<CanvasShareSubject> = fc.oneof(
  fc.constant<CanvasShareSubject>({ kind: 'blank' }),
  fc.constant<CanvasShareSubject>({ kind: 'starter' }),
  fc.constant<CanvasShareSubject>({ kind: 'shared' }),
  fc.record({
    kind: fc.constant('owned' as const),
    patchId: fc.option(fc.uuid(), { nil: null }),
  }),
  fc.record({
    kind: fc.constant('owned' as const),
    patchId: fc.constant(''),
  }),
);

function specShareOffer(subject: CanvasShareSubject): ShareOffer {
  if (subject.kind === 'owned' && subject.patchId !== null && subject.patchId.length > 0) {
    return 'offer';
  }
  return 'hide';
}

function validGraphArb(): fc.Arbitrary<DomainGraph> {
  return fc
    .record({
      patchId: fc.uuid(),
      connectors: fc.array(connectorBodyArb, { maxLength: 2 }),
      modulators: fc.array(modulatorBodyArb, { maxLength: 2 }),
      oscillators: fc.array(oscillatorBodyArb, { maxLength: 2 }),
      effects: fc.array(effectBodyArb, { maxLength: 2 }),
      wireSlots: fc.array(
        fc.record({
          sourceHandle: fc.option(wordArb, { nil: undefined }),
          targetHandle: fc.option(wordArb, { nil: undefined }),
        }),
        { maxLength: 3 },
      ),
    })
    .chain((parts) => {
      const nodeCount =
        parts.connectors.length +
        parts.modulators.length +
        parts.oscillators.length +
        parts.effects.length;
      const wireCount = nodeCount === 0 ? 0 : parts.wireSlots.length;
      const needed = nodeCount + wireCount;
      return fc.uniqueArray(fc.uuid(), { minLength: needed, maxLength: needed }).chain((ids) => {
        const nodeIds = ids.slice(0, nodeCount);
        const endpointArb = nodeCount === 0 ? fc.constant('') : fc.constantFrom(...nodeIds);
        return fc
          .array(fc.tuple(endpointArb, endpointArb), {
            minLength: wireCount,
            maxLength: wireCount,
          })
          .map((endpoints) => {
            let cursor = 0;
            const take = (): string => {
              const id = ids[cursor];
              cursor += 1;
              if (id === undefined) {
                throw new Error('graph arb ran out of ids');
              }
              return id;
            };
            const connectors = parts.connectors.map((body) => ({
              ...body,
              id: take(),
              patchId: parts.patchId,
            }));
            const modulators = parts.modulators.map((body) => ({
              ...body,
              id: take(),
              patchId: parts.patchId,
            }));
            const oscillators = parts.oscillators.map((body) => ({
              ...body,
              id: take(),
              patchId: parts.patchId,
            }));
            const effects = parts.effects.map((body) => ({
              ...body,
              id: take(),
              patchId: parts.patchId,
            }));
            const wires: DomainWire[] = endpoints.map(([sourceNodeId, targetNodeId], index) => {
              const slot = parts.wireSlots[index];
              const wire: DomainWire = {
                id: take(),
                patchId: parts.patchId,
                sourceNodeId,
                targetNodeId,
              };
              if (slot?.sourceHandle !== undefined) wire.sourceHandle = slot.sourceHandle;
              if (slot?.targetHandle !== undefined) wire.targetHandle = slot.targetHandle;
              return wire;
            });
            return { connectors, modulators, oscillators, effects, wires };
          });
      });
    });
}

function rowIds(graph: DomainGraph): string[] {
  return [
    ...graph.connectors,
    ...graph.modulators,
    ...graph.oscillators,
    ...graph.effects,
    ...graph.wires,
  ].map((row) => row.id);
}

function nodeRows(graph: DomainGraph): { id: string }[] {
  return [
    ...graph.connectors,
    ...graph.modulators,
    ...graph.oscillators,
    ...graph.effects,
  ];
}

function copyIsRejected(graph: DomainGraph, mintedIds: readonly string[]): boolean {
  const ids = rowIds(graph);
  if (new Set(ids).size !== ids.length) return true;
  const nodes = new Set(nodeRows(graph).map((row) => row.id));
  for (const wire of graph.wires) {
    if (!nodes.has(wire.sourceNodeId) || !nodes.has(wire.targetNodeId)) return true;
  }
  if (mintedIds.length !== ids.length) return true;
  if (new Set(mintedIds).size !== mintedIds.length) return true;
  const source = new Set(ids);
  return mintedIds.some((id) => source.has(id));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(record[key]);
        return acc;
      }, {});
  }
  return value;
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function omit(row: object, keys: readonly string[]): Record<string, unknown> {
  const copy = { ...(row as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy;
}

function nodePrints(graph: DomainGraph): Map<string, string> {
  const prints = new Map<string, string>();
  const groups = [
    ['connector', graph.connectors],
    ['modulator', graph.modulators],
    ['oscillator', graph.oscillators],
    ['effect', graph.effects],
  ] as const;
  for (const [kind, rows] of groups) {
    for (const row of rows) {
      prints.set(row.id, stable({ kind, body: omit(row, ['id', 'patchId']) }));
    }
  }
  return prints;
}

function sortedNodePrints(graph: DomainGraph): string[] {
  return [...nodePrints(graph).values()].sort();
}

function sortedWirePrints(graph: DomainGraph): string[] {
  const nodes = nodePrints(graph);
  return graph.wires
    .map((wire) =>
      stable({
        source: nodes.get(wire.sourceNodeId) ?? null,
        target: nodes.get(wire.targetNodeId) ?? null,
        sourceHandle: wire.sourceHandle ?? null,
        targetHandle: wire.targetHandle ?? null,
      }),
    )
    .sort();
}

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  Object.freeze(value);
  for (const child of Object.values(value as object)) deepFreeze(child);
}

function count(haystack: string, needle: string): number {
  if (needle.length === 0) return haystack.length - haystack.length;
  return haystack.split(needle).length - 1;
}

function mintedFor(graph: DomainGraph): fc.Arbitrary<string[]> {
  const needed = rowIds(graph).length;
  const source = new Set(rowIds(graph));
  return fc
    .uniqueArray(fc.uuid(), { minLength: needed, maxLength: needed })
    .filter((ids) => ids.every((id) => !source.has(id)));
}

type TokenModel = {
  patchId: string;
  token: string | null;
  version: number;
  retired: string[];
};

type TokenReal = { state: ShareTokenState };

class PublishToken implements fc.Command<TokenModel, TokenReal> {
  private readonly nextToken: string;

  constructor(nextToken: string) {
    this.nextToken = nextToken;
  }

  check(): boolean {
    return true;
  }

  run(model: TokenModel, real: TokenReal): void {
    const next = reduceShareToken(real.state, { type: 'publish', nextToken: this.nextToken });
    const usable =
      model.token === null &&
      this.nextToken.length > 0 &&
      this.nextToken !== model.patchId &&
      !model.retired.includes(this.nextToken);
    if (usable) model.token = this.nextToken;
    assert.equal(next.token, model.token);
    assert.equal(next.version, model.version);
    assert.equal(next.patchId, model.patchId);
    assert.deepEqual(next.retired, model.retired);
    real.state = next;
  }

  toString(): string {
    return `publish ${this.nextToken}`;
  }
}

class PublishRetiredToken implements fc.Command<TokenModel, TokenReal> {
  check(model: Readonly<TokenModel>): boolean {
    return model.token === null && model.retired.length > 0;
  }

  run(model: TokenModel, real: TokenReal): void {
    const retiredToken = model.retired[0];
    if (retiredToken === undefined) return;
    const next = reduceShareToken(real.state, { type: 'publish', nextToken: retiredToken });
    assert.equal(next.token, model.token);
    assert.equal(next.version, model.version);
    assert.deepEqual(next.retired, model.retired);
    real.state = next;
  }

  toString(): string {
    return 'publish retired';
  }
}

class PublishPatchId implements fc.Command<TokenModel, TokenReal> {
  check(model: Readonly<TokenModel>): boolean {
    return model.token === null;
  }

  run(model: TokenModel, real: TokenReal): void {
    const next = reduceShareToken(real.state, { type: 'publish', nextToken: model.patchId });
    assert.equal(next.token, model.token);
    assert.equal(next.version, model.version);
    assert.deepEqual(next.retired, model.retired);
    real.state = next;
  }

  toString(): string {
    return 'publish patch id';
  }
}

class RevokeToken implements fc.Command<TokenModel, TokenReal> {
  check(): boolean {
    return true;
  }

  run(model: TokenModel, real: TokenReal): void {
    const next = reduceShareToken(real.state, { type: 'revoke' });
    if (model.token !== null) {
      model.retired = [...model.retired, model.token];
      model.token = null;
    }
    assert.equal(next.token, model.token);
    assert.equal(next.version, model.version);
    assert.equal(next.patchId, model.patchId);
    assert.deepEqual(next.retired, model.retired);
    const stillCurrent = next.retired.filter((token) => token === next.token);
    assert.equal(stillCurrent.length, next.retired.length - next.retired.length);
    real.state = next;
  }

  toString(): string {
    return 'revoke';
  }
}

type SessionModel = {
  activePatchId: string | null;
  name: string;
  graph: DomainGraph;
  visit: { token: string; ownerPatchId: string; name: string; graph: DomainGraph } | null;
  stashed: ShareCanvasSnapshot | null;
  discarded: boolean;
  routeLocked: boolean;
};

function sessionBlocks(model: SessionModel): boolean {
  return model.visit !== null || model.routeLocked;
}

function emptySessionGraph(): DomainGraph {
  return {
    connectors: [],
    modulators: [],
    oscillators: [],
    effects: [],
    wires: [],
  };
}

type SessionReal = { state: ShareSessionState };

class EnterShare implements fc.Command<SessionModel, SessionReal> {
  private readonly token: string;
  private readonly ownerPatchId: string;
  private readonly name: string;
  private readonly graph: DomainGraph;
  private readonly discardDirty: boolean;

  constructor(
    token: string,
    ownerPatchId: string,
    name: string,
    graph: DomainGraph,
    discardDirty: boolean,
  ) {
    this.token = token;
    this.ownerPatchId = ownerPatchId;
    this.name = name;
    this.graph = graph;
    this.discardDirty = discardDirty;
  }

  check(model: Readonly<SessionModel>): boolean {
    return model.visit === null;
  }

  run(model: SessionModel, real: SessionReal): void {
    const previous: ShareCanvasSnapshot = {
      activePatchId: model.activePatchId,
      name: model.name,
      graph: model.graph,
    };
    const next = reduceShareSession(real.state, {
      type: 'enter',
      token: this.token,
      ownerPatchId: this.ownerPatchId,
      name: this.name,
      graph: this.graph,
      discardDirty: this.discardDirty,
    });
    const comingFromMiss = model.routeLocked && model.visit === null;
    model.visit = {
      token: this.token,
      ownerPatchId: this.ownerPatchId,
      name: this.name,
      graph: this.graph,
    };
    model.activePatchId = null;
    model.name = this.name;
    model.graph = this.graph;
    if (comingFromMiss) {
      model.discarded = model.stashed === null;
    } else {
      model.discarded = this.discardDirty;
      model.stashed = this.discardDirty ? null : previous;
    }
    model.routeLocked = true;
    assert.equal(next.canvas.activePatchId, model.activePatchId);
    assert.equal(next.canvas.name, model.name);
    assert.deepEqual(next.canvas.graph, model.graph);
    assert.deepEqual(next.visit, model.visit);
    assert.deepEqual(next.stashed, model.stashed);
    assert.equal(next.discardedOnEnter, model.discarded);
    assert.equal(next.routeLocked, model.routeLocked);
    assert.equal(shareSessionBlocksPersist(next), sessionBlocks(model));
    assert.equal(next.canvas.activePatchId, null);
    real.state = next;
  }

  toString(): string {
    return `enter ${this.token}`;
  }
}

class LeaveShare implements fc.Command<SessionModel, SessionReal> {
  check(model: Readonly<SessionModel>): boolean {
    return model.visit !== null || model.routeLocked;
  }

  run(model: SessionModel, real: SessionReal): void {
    const next = reduceShareSession(real.state, { type: 'leave' });
    if (model.discarded || model.stashed === null) {
      model.activePatchId = null;
      model.name = BLANK_PATCH_NAME;
      model.graph = emptySessionGraph();
    } else {
      model.activePatchId = model.stashed.activePatchId;
      model.name = model.stashed.name;
      model.graph = model.stashed.graph;
    }
    model.visit = null;
    model.stashed = null;
    model.discarded = false;
    model.routeLocked = false;
    assert.equal(next.canvas.activePatchId, model.activePatchId);
    assert.equal(next.canvas.name, model.name);
    assert.deepEqual(next.canvas.graph, model.graph);
    assert.equal(next.visit, model.visit);
    assert.equal(next.stashed, model.stashed);
    assert.equal(next.routeLocked, model.routeLocked);
    assert.equal(shareSessionBlocksPersist(next), sessionBlocks(model));
    real.state = next;
  }

  toString(): string {
    return 'leave';
  }
}

class SaveShareCopy implements fc.Command<SessionModel, SessionReal> {
  private readonly newPatchId: string;
  private readonly name: string;
  private readonly graph: DomainGraph;

  constructor(newPatchId: string, name: string, graph: DomainGraph) {
    this.newPatchId = newPatchId;
    this.name = name;
    this.graph = graph;
  }

  check(model: Readonly<SessionModel>): boolean {
    return model.visit !== null && this.newPatchId !== model.visit.ownerPatchId;
  }

  run(model: SessionModel, real: SessionReal): void {
    const ownerPatchId = model.visit?.ownerPatchId;
    const next = reduceShareSession(real.state, {
      type: 'saveCopy',
      newPatchId: this.newPatchId,
      name: this.name,
      graph: this.graph,
    });
    model.visit = null;
    model.stashed = null;
    model.discarded = false;
    model.routeLocked = false;
    model.activePatchId = this.newPatchId;
    model.name = this.name;
    model.graph = this.graph;
    assert.equal(next.canvas.activePatchId, model.activePatchId);
    assert.notEqual(next.canvas.activePatchId, ownerPatchId);
    assert.equal(next.canvas.name, model.name);
    assert.deepEqual(next.canvas.graph, model.graph);
    assert.equal(next.visit, model.visit);
    assert.equal(next.routeLocked, model.routeLocked);
    assert.equal(shareSessionBlocksPersist(next), sessionBlocks(model));
    real.state = next;
  }

  toString(): string {
    return `save copy ${this.newPatchId}`;
  }
}

class MissShare implements fc.Command<SessionModel, SessionReal> {
  check(model: Readonly<SessionModel>): boolean {
    return model.visit !== null || !model.routeLocked;
  }

  run(model: SessionModel, real: SessionReal): void {
    const next = reduceShareSession(real.state, { type: 'miss' });
    if (model.visit !== null) {
      if (model.discarded) model.stashed = null;
    } else {
      model.stashed = {
        activePatchId: model.activePatchId,
        name: model.name,
        graph: model.graph,
      };
    }
    model.visit = null;
    model.discarded = false;
    model.routeLocked = true;
    model.activePatchId = null;
    model.name = BLANK_PATCH_NAME;
    model.graph = emptySessionGraph();
    const liveNodeIds = [
      ...next.canvas.graph.connectors,
      ...next.canvas.graph.modulators,
      ...next.canvas.graph.oscillators,
      ...next.canvas.graph.effects,
      ...next.canvas.graph.wires,
    ].map((row) => row.id);
    assert.equal(next.visit, model.visit);
    assert.equal(next.canvas.activePatchId, model.activePatchId);
    assert.equal(next.canvas.name, model.name);
    assert.deepEqual(next.canvas.graph, model.graph);
    assert.deepEqual(next.stashed, model.stashed);
    assert.equal(next.routeLocked, model.routeLocked);
    assert.equal(shareSessionBlocksPersist(next), sessionBlocks(model));
    assert.equal(liveNodeIds.length, liveNodeIds.length - liveNodeIds.length);
    real.state = next;
  }

  toString(): string {
    return 'miss';
  }
}

function specPatchRead(input: PatchReadRequest): PatchRead {
  if (input.requestedPatchId !== null) {
    const callerOwns = input.callerUserId !== null && input.callerUserId === input.ownerUserId;
    if (input.requestedPatchId === input.patchId && callerOwns) return 'owner';
    return 'deny';
  }
  const stored = input.shareToken !== null && input.shareToken.length > 0 ? input.shareToken : null;
  const requested =
    input.requestedToken !== null && input.requestedToken.length > 0 ? input.requestedToken : null;
  if (stored !== null && requested !== null && stored === requested) return 'share';
  return 'deny';
}

const readModeArb = fc.constantFrom(
  'id-owner',
  'id-owner-with-token',
  'id-stranger',
  'token-match',
  'token-miss',
  'both',
  'empty-token',
  'neither',
);

const readRequestArb: fc.Arbitrary<PatchReadRequest> = fc
  .record({
    callerUserId: fc.option(fc.uuid(), { nil: null }),
    ownerUserId: fc.uuid(),
    patchId: fc.uuid(),
    shareToken: fc.option(fc.uuid(), { nil: null }),
    otherPatchId: fc.uuid(),
    otherToken: fc.uuid(),
    mode: readModeArb,
  })
  .map((base) => {
    if (base.mode === 'id-owner') {
      return {
        callerUserId: base.ownerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: base.patchId,
        shareToken: base.shareToken,
        requestedToken: null,
      };
    }
    if (base.mode === 'id-owner-with-token') {
      return {
        callerUserId: base.ownerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: base.patchId,
        shareToken: base.otherToken,
        requestedToken: base.otherToken,
      };
    }
    if (base.mode === 'id-stranger') {
      return {
        callerUserId: base.callerUserId === base.ownerUserId ? null : base.callerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: base.patchId,
        shareToken: base.otherToken,
        requestedToken: base.otherToken,
      };
    }
    if (base.mode === 'token-match') {
      return {
        callerUserId: base.callerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: null,
        shareToken: base.otherToken,
        requestedToken: base.otherToken,
      };
    }
    if (base.mode === 'token-miss') {
      return {
        callerUserId: base.callerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: null,
        shareToken: base.shareToken,
        requestedToken: base.otherToken,
      };
    }
    if (base.mode === 'both') {
      return {
        callerUserId: base.callerUserId === base.ownerUserId ? null : base.callerUserId,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: base.patchId,
        shareToken: base.otherToken,
        requestedToken: base.otherToken,
      };
    }
    if (base.mode === 'empty-token') {
      return {
        callerUserId: null,
        ownerUserId: base.ownerUserId,
        patchId: base.patchId,
        requestedPatchId: null,
        shareToken: '',
        requestedToken: '',
      };
    }
    return {
      callerUserId: null,
      ownerUserId: base.ownerUserId,
      patchId: base.patchId,
      requestedPatchId: null,
      shareToken: null,
      requestedToken: null,
    };
  });

describe('decideShareOffer', () => {
  it('offers Share only for an owned saved Patch', () => {
    fc.assert(
      fc.property(subjectArb, (subject) => {
        expect(decideShareOffer(subject)).toBe(specShareOffer(subject));
      }),
    );
  });
});

describe('reduceShareToken', () => {
  it('keeps the current token, retires a revoked token, and leaves version unchanged', () => {
    expect(() => fc.assert(
      fc.property(
        fc.uuid(),
        versionArb,
        fc.commands(
          [
            fc.uuid().map((token) => new PublishToken(token)),
            fc.constant('').map((token) => new PublishToken(token)),
            fc.constant(new PublishRetiredToken()),
            fc.constant(new PublishPatchId()),
            fc.constant(new RevokeToken()),
          ],
          { maxCommands: 12 },
        ),
        (patchId, version, commands) => {
          fc.modelRun(
            () => ({
              model: { patchId, token: null, version, retired: [] as string[] },
              real: {
                state: { patchId, token: null, version, retired: [] },
              },
            }),
            commands,
          );
        },
      ),
    )).not.toThrow();
  });
});

describe('decidePatchRead', () => {
  it('gives the token route to anyone and keeps the id route on the owner', () => {
    fc.assert(
      fc.property(readRequestArb, (input) => {
        const decision = decidePatchRead(input);
        const shareAgrees =
          decision !== 'share' ||
          (input.requestedPatchId === null && input.requestedToken === input.shareToken);
        const ownerAgrees =
          decision !== 'owner' ||
          (input.callerUserId === input.ownerUserId && input.requestedPatchId === input.patchId);
        const checks = [decision === specPatchRead(input), shareAgrees, ownerAgrees];
        expect(checks.filter(Boolean).length).toBe(checks.length);
      }),
    );
  });
});

describe('projectSharedPatch', () => {
  it('returns the name and graph and drops owner identity', () => {
    fc.assert(
      fc.property(
        validGraphArb(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.emailAddress(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (graph, name, userId, shareToken, email, ownerName, image, providerSubject) => {
          const secrets = [userId, shareToken, email, ownerName, image, providerSubject];
          const graphText = stable(graph);
          fc.pre(secrets.every((secret) => secret !== name && !graphText.includes(secret)));
          fc.pre(new Set([name, ...secrets]).size === secrets.length + 1);
          const source = {
            name,
            graph,
            userId,
            shareToken,
            ownerEmail: email,
            ownerName,
            ownerImage: image,
            provider: providerSubject,
            providerSubject,
          };
          const view = projectSharedPatch(source);
          const encoded = JSON.stringify(view);
          const markerCount = count(encoded, name);
          const secretCount = secrets.reduce((total, secret) => total + count(encoded, secret), 0);
          expect(view.name).toBe(name);
          expect(view.graph).toEqual(graph);
          expect(view.graph).not.toBe(graph);
          expect(secretCount).toBe(markerCount - markerCount);
          expect(markerCount).toBeGreaterThan(secretCount);
          view.graph.connectors.push({
            id: userId,
            patchId: shareToken,
            kindKey: email,
            positionX: 0,
            positionY: 0,
          });
          expect(graph.connectors.length).toBe(source.graph.connectors.length);
        },
      ),
    );
  });
});

const copyCaseArb = validGraphArb().chain((graph) =>
  fc.tuple(fc.constant(graph), mintedFor(graph), fc.uuid()),
);

const messyCopyArb = validGraphArb().chain((graph) =>
  fc
    .record({
      duplicate: fc.boolean(),
      dangle: fc.boolean(),
      danglingId: fc.uuid(),
      minted: fc.array(fc.uuid(), { maxLength: 8 }),
    })
    .map((twist) => {
      const next = structuredClone(graph);
      if (twist.duplicate && next.connectors[0] && next.modulators[0]) {
        next.modulators[0].id = next.connectors[0].id;
      }
      if (twist.dangle && next.wires[0] && !nodeRows(next).some((row) => row.id === twist.danglingId)) {
        next.wires[0].targetNodeId = twist.danglingId;
      }
      return { graph: next, minted: twist.minted };
    }),
);

describe('copyShareGraph', () => {
  it('mints a disjoint graph and leaves the source unchanged', () => {
    fc.assert(
      fc.property(copyCaseArb, ([graph, mintedIds, nextPatchId]) => {
        fc.pre(!rowIds(graph).includes(nextPatchId));
        const before = structuredClone(graph);
        deepFreeze(graph);
        const copy = copyShareGraph(graph, nextPatchId, mintedIds);
        const copyIds = rowIds(copy);
        const overlap = copyIds.filter((id) => new Set(rowIds(before)).has(id));
        const patchIds = [
          ...copy.connectors,
          ...copy.modulators,
          ...copy.oscillators,
          ...copy.effects,
          ...copy.wires,
        ].map((row) => row.patchId);
        expect(graph).toEqual(before);
        expect(copyIds).toEqual([...copyIds].filter((id, index) => copyIds.indexOf(id) === index));
        expect(new Set(copyIds)).toEqual(new Set(mintedIds));
        expect(overlap).toEqual(copyIds.filter((id) => !rowIds(before).includes(id) && rowIds(before).includes(id)));
        expect(sortedNodePrints(copy)).toEqual(sortedNodePrints(before));
        expect(sortedWirePrints(copy)).toEqual(sortedWirePrints(before));
        expect(patchIds).toEqual(patchIds.map(() => nextPatchId));
        expect(copy.wires.length).toBe(before.wires.length);
        expect(nodeRows(copy).length).toBe(nodeRows(before).length);
      }),
    );
  });

  it('rejects a mint list or a graph that cannot be copied', () => {
    fc.assert(
      fc.property(messyCopyArb, ({ graph, minted }) => {
        const rejected = copyIsRejected(graph, minted);
        let threw = false;
        try {
          copyShareGraph(graph, graph.connectors[0]?.patchId ?? minted[0] ?? graph.wires[0]?.id ?? 'patch', minted);
        } catch {
          threw = true;
        }
        expect(threw).toBe(rejected);
      }),
    );
  });
});

const snapshotArb: fc.Arbitrary<ShareCanvasSnapshot> = fc.record({
  activePatchId: fc.option(fc.uuid(), { nil: null }),
  name: wordArb,
  graph: validGraphArb(),
});

const sessionCommandsArb = fc.commands(
  [
    fc
      .tuple(fc.uuid(), fc.uuid(), wordArb, validGraphArb(), fc.boolean())
      .map(
        ([token, ownerPatchId, name, graph, discardDirty]) =>
          new EnterShare(token, ownerPatchId, name, graph, discardDirty),
      ),
    fc.constant(new LeaveShare()),
    fc.constant(new MissShare()),
    fc
      .tuple(fc.uuid(), wordArb, validGraphArb())
      .map(([newPatchId, name, graph]) => new SaveShareCopy(newPatchId, name, graph)),
  ],
  { maxCommands: 8 },
);

describe('reduceShareSession', () => {
  it('blocks persist during a visit, restores on leave, and owns the copy after save', () => {
    expect(() => fc.assert(
      fc.property(snapshotArb, sessionCommandsArb, (snapshot, commands) => {
        const canvas: ShareCanvasSnapshot = {
          activePatchId: snapshot.activePatchId,
          name: snapshot.name,
          graph: structuredClone(snapshot.graph),
        };
        fc.modelRun(
          () => ({
            model: {
              activePatchId: canvas.activePatchId,
              name: canvas.name,
              graph: canvas.graph,
              visit: null,
              stashed: null,
              discarded: false,
              routeLocked: false,
            },
            real: { state: initialShareSession(canvas) },
          }),
          commands,
        );
      }),
    )).not.toThrow();
  });
});

describe('shareTokenFromPath', () => {
  it('reads a token only from /share/:token', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.constantFrom('/', '/patches', '/connectors', '/effects'), (token, other) => {
        const encoded = `/share/${encodeURIComponent(token)}`;
        expect(shareTokenFromPath(encoded)).toBe(token);
        expect(shareTokenFromPath(other)).toBeNull();
        expect(shareTokenFromPath(`${encoded}/extra`)).toBeNull();
      }),
    );
  });
});

describe('library and list visibility', () => {
  it('marks a row shared without putting the token in the label', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.option(fc.uuid(), { nil: null }),
        fc.constant(''),
        (patchId, token, empty) => {
          const samples = [token, empty];
          for (const shareToken of samples) {
            const detail = libraryRowDetail(patchId, shareToken);
            const stored = shareToken !== null && shareToken.length > 0 ? shareToken : null;
            const expectedMark = stored === null ? ('private' as const) : ('shared' as const);
            const encoded = JSON.stringify(detail);
            const secretCount = stored === null ? encoded.length - encoded.length : count(encoded, stored);
            const labelCount = count(encoded, patchId);
            const tokenIsHidden = stored === null || patchId.includes(stored) || secretCount === labelCount - labelCount;
            const labelIsPresent = stored === null || patchId.includes(stored) || labelCount > secretCount;
            const checks = [detail.mark === expectedMark, detail.label === patchId, tokenIsHidden, labelIsPresent];
            expect(checks.filter(Boolean).length).toBe(checks.length);
          }
        },
      ),
    );
  });

  it('lists only rows owned by that user', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.record({ id: fc.uuid(), userId: fc.uuid() }), { maxLength: 6 }),
        (ownerId, recipientId, sourceId, copyId, extra) => {
          fc.pre(ownerId !== recipientId);
          fc.pre(sourceId !== copyId);
          fc.pre(extra.every((row) => row.id !== sourceId && row.id !== copyId));
          const rows = [
            ...extra,
            { id: sourceId, userId: ownerId },
            { id: copyId, userId: recipientId },
          ];
          const ownerView = patchIdsVisibleToUser(ownerId, rows);
          const recipientView = patchIdsVisibleToUser(recipientId, rows);
          const ownedBy = (userId: string) => rows.filter((row) => row.userId === userId).map((row) => row.id);
          expect(ownerView).toEqual(ownedBy(ownerId));
          expect(recipientView).toEqual(ownedBy(recipientId));
          const ownHits = Number(ownerView.includes(sourceId)) + Number(recipientView.includes(copyId));
          const crossHits = Number(ownerView.includes(copyId)) + Number(recipientView.includes(sourceId));
          const pair = [sourceId, copyId];
          expect(ownHits).toBe(crossHits + pair.length);
        },
      ),
    );
  });
});

type LinkModel = {
  patchId: string;
  token: string | null;
  version: number;
  retired: string[];
  epoch: number;
  shown: string | null;
  busy: boolean;
  startedEpoch: number | null;
};

type LinkReal = { state: ShareLinkRaceState };

function retiredStillStored(token: string | null, retired: readonly string[]): string[] {
  if (token === null) return [];
  return retired.filter((item) => item === token);
}

class StartSharePublish implements fc.Command<LinkModel, LinkReal> {
  check(): boolean {
    return true;
  }

  run(model: LinkModel, real: LinkReal): void {
    const next = reduceShareLinkRace(real.state, { type: 'publishStart' });
    if (!model.busy) {
      model.busy = true;
      model.startedEpoch = model.epoch;
    }
    assert.equal(next.busy, model.busy);
    assert.equal(next.startedEpoch, model.startedEpoch);
    assert.equal(next.stored.token, model.token);
    assert.equal(next.shown, model.shown);
    assert.equal(next.epoch, model.epoch);
    real.state = next;
  }

  toString(): string {
    return 'publish start';
  }
}

class FinishSharePublish implements fc.Command<LinkModel, LinkReal> {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  check(model: Readonly<LinkModel>): boolean {
    return model.busy && model.startedEpoch !== null;
  }

  run(model: LinkModel, real: LinkReal): void {
    const next = reduceShareLinkRace(real.state, { type: 'publishResult', token: this.token });
    const stale = model.startedEpoch !== model.epoch;
    if (!stale) {
      const usable =
        model.token === null &&
        this.token.length > 0 &&
        this.token !== model.patchId &&
        !model.retired.includes(this.token);
      if (usable) model.token = this.token;
      model.shown = model.token;
    } else {
      const usable =
        model.token === null &&
        this.token.length > 0 &&
        this.token !== model.patchId &&
        !model.retired.includes(this.token);
      if (usable) {
        model.retired = [...model.retired, this.token];
      }
      model.shown = null;
    }
    model.busy = false;
    model.startedEpoch = null;
    const stillStored = retiredStillStored(next.stored.token, next.stored.retired);
    assert.equal(next.stored.token, model.token);
    assert.equal(next.shown, model.shown);
    assert.equal(next.busy, model.busy);
    assert.equal(next.epoch, model.epoch);
    assert.equal(next.stored.version, model.version);
    assert.deepEqual(next.stored.retired, model.retired);
    assert.equal(stillStored.length, stillStored.length - stillStored.length);
    assert.equal(next.shown, next.stored.token);
    real.state = next;
  }

  toString(): string {
    return `publish result ${this.token}`;
  }
}

class StopShareLink implements fc.Command<LinkModel, LinkReal> {
  check(): boolean {
    return true;
  }

  run(model: LinkModel, real: LinkReal): void {
    const next = reduceShareLinkRace(real.state, { type: 'revoke' });
    if (model.token !== null) {
      model.retired = [...model.retired, model.token];
      model.token = null;
    }
    model.epoch += 1;
    model.shown = null;
    assert.equal(next.stored.token, model.token);
    assert.equal(next.shown, model.shown);
    assert.equal(next.epoch, model.epoch);
    assert.equal(next.busy, model.busy);
    assert.equal(next.stored.version, model.version);
    assert.deepEqual(next.stored.retired, model.retired);
    real.state = next;
  }

  toString(): string {
    return 'stop';
  }
}

const shareLinkCommands = fc.commands(
  [
    fc.constant(new StartSharePublish()),
    fc.uuid().map((token) => new FinishSharePublish(token)),
    fc.constant(new StopShareLink()),
  ],
  { maxCommands: 12 },
);

describe('reduceShareLinkRace', () => {
  it('keeps one token, ignores a publish that started before Stop, and leaves version alone', () => {
    expect(() =>
      fc.assert(
        fc.property(fc.uuid(), versionArb, shareLinkCommands, (patchId, version, commands) => {
          fc.modelRun(
            () => ({
              model: {
                patchId,
                token: null,
                version,
                retired: [],
                epoch: 0,
                shown: null,
                busy: false,
                startedEpoch: null,
              },
              real: { state: initialShareLinkRace(patchId, version) },
            }),
            commands,
          );
        }),
      ),
    ).not.toThrow();
  });
});

type LockModel = {
  holder: PatchGraphLockState['holder'];
  committed: PatchGraphSnapshot;
  pending: PatchGraphSnapshot | null;
  observed: PatchGraphSnapshot | null;
};

type LockReal = { state: PatchGraphLockState };

class BeginReplace implements fc.Command<LockModel, LockReal> {
  private readonly next: PatchGraphSnapshot;

  constructor(next: PatchGraphSnapshot) {
    this.next = next;
  }

  check(): boolean {
    return true;
  }

  run(model: LockModel, real: LockReal): void {
    const next = reducePatchGraphLock(real.state, { type: 'beginReplace', next: this.next });
    if (model.holder === 'free') {
      model.holder = 'replace';
      model.pending = this.next;
    }
    assert.equal(next.holder, model.holder);
    assert.deepEqual(next.pending, model.pending);
    assert.equal(next.committed.generation, model.committed.generation);
    assert.deepEqual(next.observed, model.observed);
    real.state = next;
  }

  toString(): string {
    return `replace ${this.next.generation}`;
  }
}

class CommitReplace implements fc.Command<LockModel, LockReal> {
  check(model: Readonly<LockModel>): boolean {
    return model.holder === 'replace' && model.pending !== null;
  }

  run(model: LockModel, real: LockReal): void {
    const next = reducePatchGraphLock(real.state, { type: 'commitReplace' });
    if (model.pending !== null) {
      model.committed = model.pending;
      model.pending = null;
      model.holder = 'free';
    }
    assert.equal(next.holder, model.holder);
    assert.equal(next.committed.generation, model.committed.generation);
    assert.deepEqual([...next.committed.nodeIds], [...model.committed.nodeIds]);
    assert.deepEqual([...next.committed.wireEnds], [...model.committed.wireEnds]);
    assert.equal(next.pending, model.pending);
    real.state = next;
  }

  toString(): string {
    return 'commit replace';
  }
}

class BeginShareRead implements fc.Command<LockModel, LockReal> {
  check(): boolean {
    return true;
  }

  run(model: LockModel, real: LockReal): void {
    const next = reducePatchGraphLock(real.state, { type: 'beginShareRead' });
    if (model.holder === 'free') {
      model.holder = 'share';
      model.observed = model.committed;
    }
    const observed = next.observed;
    const committedFit = snapshotWiresFit(next.committed);
    const observedFit = observed === null ? committedFit : snapshotWiresFit(observed);
    assert.equal(next.holder, model.holder);
    assert.equal(observedFit, committedFit);
    if (observed !== null && model.observed !== null) {
      assert.equal(observed.generation, model.observed.generation);
      assert.deepEqual([...observed.nodeIds], [...model.observed.nodeIds]);
      assert.deepEqual([...observed.wireEnds], [...model.observed.wireEnds]);
    } else {
      assert.equal(observed, model.observed);
    }
    real.state = next;
  }

  toString(): string {
    return 'share read';
  }
}

class EndShareRead implements fc.Command<LockModel, LockReal> {
  check(model: Readonly<LockModel>): boolean {
    return model.holder === 'share';
  }

  run(model: LockModel, real: LockReal): void {
    const next = reducePatchGraphLock(real.state, { type: 'endShareRead' });
    model.holder = 'free';
    assert.equal(next.holder, model.holder);
    assert.equal(next.committed.generation, model.committed.generation);
    assert.deepEqual(next.observed, model.observed);
    real.state = next;
  }

  toString(): string {
    return 'end share read';
  }
}

const fittingSnapshotArb: fc.Arbitrary<PatchGraphSnapshot> = fc
  .record({
    generation: fc.integer({ min: 1, max: 40 }),
    nodeIds: fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 4 }),
  })
  .chain((parts) =>
    fc
      .array(fc.constantFrom(...parts.nodeIds), { minLength: 0, maxLength: 4 })
      .map((wireEnds) => ({
        generation: parts.generation,
        nodeIds: parts.nodeIds,
        wireEnds,
      })),
  );

describe('reducePatchGraphLock', () => {
  it('lets a share read observe one committed graph, never a replace that is still open', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fittingSnapshotArb,
          fc.commands(
            [
              fittingSnapshotArb.map((next) => new BeginReplace(next)),
              fc.constant(new CommitReplace()),
              fc.constant(new BeginShareRead()),
              fc.constant(new EndShareRead()),
            ],
            { maxCommands: 10 },
          ),
          (committed, commands) => {
            fc.modelRun(
              () => ({
                model: {
                  holder: 'free' as const,
                  committed,
                  pending: null,
                  observed: null,
                },
                real: { state: initialPatchGraphLock(committed) },
              }),
              commands,
            );
          },
        ),
      ),
    ).not.toThrow();
  });
});

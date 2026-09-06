import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { domainGraphToFlow, flowToDomainGraph } from '@/persist/graphMapper';

import {
  buildPatchLibraryEntries,
  listStarterPatches,
  patchLibraryRequiresSignIn,
  starterWorkingSnapshot,
  type StarterPatch,
  type UserPatchListItem,
} from './starterLibrary';
import { SURF_N_TURF_KEY, SURF_N_TURF_NAME } from './surfNTurfGraph';

const starterKeyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,24}$/);
const starterNameArb = fc.string({ minLength: 1, maxLength: 40 });
const idArb = fc.uuid();
const versionArb = fc.integer({ min: 1, max: 10_000 });

const starterSummaryArb = fc.record({
  key: starterKeyArb,
  name: starterNameArb,
});

const userPatchArb: fc.Arbitrary<UserPatchListItem> = fc.record({
  id: idArb,
  name: starterNameArb,
  version: versionArb,
});

const startersArb = fc.uniqueArray(starterSummaryArb, {
  minLength: 1,
  maxLength: 5,
  selector: (s) => s.key,
});

const userPatchesArb = fc.uniqueArray(userPatchArb, {
  minLength: 0,
  maxLength: 8,
  selector: (p) => p.id,
});

describe('listStarterPatches', () => {
  it('always ships Surf n Turf with a non-empty wired graph', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), () => {
        const starters = listStarterPatches();
        const matched = starters.filter((row) => row.key === SURF_N_TURF_KEY);
        const expectedNames = [SURF_N_TURF_NAME];
        expect(matched.map((row) => row.name)).toEqual(expectedNames);

        const graphs = matched.map((row) => row.graph);
        const flowNodeCounts = graphs.map((graph) => domainGraphToFlow(graph).nodes.length);
        const domainNodeCounts = graphs.map(
          (graph) =>
            graph.connectors.length +
            graph.modulators.length +
            graph.oscillators.length +
            graph.effects.length,
        );
        expect(flowNodeCounts).toEqual(domainNodeCounts);
        expect(graphs.every((graph) => graph.wires.length === domainGraphToFlow(graph).edges.length)).toBe(
          graphs.length === matched.length,
        );

        const roundTrips = graphs.map((graph) => {
          const flow = domainGraphToFlow(graph);
          const patchId = graph.connectors[0]?.patchId ?? '';
          return flowToDomainGraph(patchId, flow.nodes, flow.edges);
        });
        expect(roundTrips.map((graph) => graph.connectors.length)).toEqual(
          graphs.map((graph) => graph.connectors.length),
        );
        expect(roundTrips.map((graph) => graph.wires.length)).toEqual(
          graphs.map((graph) => graph.wires.length),
        );
      }),
    );
  });
});

describe('patchLibraryRequiresSignIn', () => {
  it('never gates the Patch Library on a session', () => {
    fc.assert(
      fc.property(fc.nat({ max: 30 }), () => {
        const gated = patchLibraryRequiresSignIn();
        const open = !gated;
        expect(gated).toBe(!open);
        expect(open).toBe(gated === false);
      }),
    );
  });
});

describe('buildPatchLibraryEntries', () => {
  it('lists only starters when nobody is signed in', () => {
    fc.assert(
      fc.property(startersArb, (starters) => {
        const entries = buildPatchLibraryEntries({ starters, userPatches: null });
        const starterKeys = entries
          .filter((row) => row.kind === 'starter')
          .map((row) => (row.kind === 'starter' ? row.key : ''));
        expect(starterKeys).toEqual(starters.map((row) => row.key));
        expect(entries.length).toBe(starters.length);
        expect(entries.every((row) => row.kind === 'starter')).toBe(
          entries.length === starters.length,
        );
      }),
    );
  });

  it('lists starters first then signed-in user Patches', () => {
    fc.assert(
      fc.property(startersArb, userPatchesArb, (starters, userPatches) => {
        const entries = buildPatchLibraryEntries({ starters, userPatches });
        const starterEntries = entries.filter((row) => row.kind === 'starter');
        const userEntries = entries.filter((row) => row.kind === 'user');

        expect(starterEntries.map((row) => (row.kind === 'starter' ? row.key : ''))).toEqual(
          starters.map((row) => row.key),
        );
        expect(starterEntries.map((row) => (row.kind === 'starter' ? row.name : ''))).toEqual(
          starters.map((row) => row.name),
        );
        expect(userEntries.map((row) => (row.kind === 'user' ? row.id : ''))).toEqual(
          userPatches.map((row) => row.id),
        );
        expect(userEntries.map((row) => (row.kind === 'user' ? row.name : ''))).toEqual(
          userPatches.map((row) => row.name),
        );
        expect(userEntries.map((row) => (row.kind === 'user' ? row.version : 0))).toEqual(
          userPatches.map((row) => row.version),
        );
        expect(entries.length).toBe(starters.length + userPatches.length);

        const startersThenUsers = entries.every((row, index) => {
          if (row.kind === 'starter') {
            return entries.slice(0, index).every((prior) => prior.kind === 'starter');
          }
          return entries.slice(index).every((rest) => rest.kind === 'user');
        });
        expect(startersThenUsers).toBe(entries.length === starters.length + userPatches.length);
      }),
    );
  });
});

describe('starterWorkingSnapshot', () => {
  it('opens as unsaved, named, not dirty, and with Play stopped', () => {
    const catalog = listStarterPatches();
    const starterArb: fc.Arbitrary<StarterPatch> = fc.constantFrom(...catalog);

    fc.assert(
      fc.property(starterArb, (starter) => {
        const snap = starterWorkingSnapshot(starter);
        const reference = starterWorkingSnapshot(starter);
        const expectedNodeCount =
          starter.graph.connectors.length +
          starter.graph.modulators.length +
          starter.graph.oscillators.length +
          starter.graph.effects.length;
        expect(snap.activePatchId).toBeNull();
        expect(snap.activePatchName).toBe(starter.name);
        expect(snap.isDirty).toBe(reference.isDirty);
        expect(snap.transportPlaying).toBe(reference.transportPlaying);
        expect(snap.nodes.length).toBe(expectedNodeCount);
        expect(snap.edges.length).toBe(starter.graph.wires.length);
        expect(snap.patchVersion).toBe(reference.patchVersion);
      }),
    );
  });
});

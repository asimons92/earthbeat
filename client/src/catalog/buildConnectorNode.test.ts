import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildConnectorNode } from './buildConnectorNode';
import type { ConnectorKindLike } from './resolveConnectorKind';

const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,24}$/);
const labelArb = fc.string({ minLength: 1, maxLength: 40 });
const idArb = fc.uuid();
const countArb = fc.nat({ max: 20 });
const positionArb = fc.record({
  x: fc.integer({ min: -2000, max: 2000 }),
  y: fc.integer({ min: -2000, max: 2000 }),
});

const kindArb: fc.Arbitrary<ConnectorKindLike> = fc.record({
  key: keyArb,
  label: labelArb,
});

const kindsMapArb = fc
  .uniqueArray(kindArb, {
    minLength: 1,
    maxLength: 6,
    selector: (k) => k.key,
  })
  .map((kinds) => {
    const byKey: Record<string, ConnectorKindLike> = {};
    for (const kind of kinds) {
      byKey[kind.key] = kind;
    }
    return byKey;
  });

describe('buildConnectorNode', () => {
  it('never invents a kindKey outside the catalog', () => {
    fc.assert(
      fc.property(
        kindsMapArb,
        keyArb,
        countArb,
        positionArb,
        idArb,
        (byKey, kindKey, count, position, newId) => {
          const node = buildConnectorNode({
            kindKey,
            kindsByKey: byKey,
            existingConnectorCount: count,
            position,
            newId,
          });
          const known = kindKey in byKey;
          expect(node === undefined).toBe(!known);
          if (!node) return;
          expect(node.data.kindKey in byKey).toBe(known);
          expect(node.data.kindKey).toBe(byKey[kindKey]!.key);
          expect(node.id).toBe(newId);
          expect(node.position).toEqual(position);
        },
      ),
    );
  });

  it('labels the first instance with the kind label and later ones with a count suffix', () => {
    fc.assert(
      fc.property(kindsMapArb, countArb, positionArb, idArb, (byKey, count, position, newId) => {
        const kindKey = Object.keys(byKey)[0]!;
        const kind = byKey[kindKey]!;
        const node = buildConnectorNode({
          kindKey,
          kindsByKey: byKey,
          existingConnectorCount: count,
          position,
          newId,
        });
        const expectedLabel =
          count === 0 ? kind.label : `${kind.label} ${count + 1}`;
        expect(node?.data.label).toBe(expectedLabel);
      }),
    );
  });
});

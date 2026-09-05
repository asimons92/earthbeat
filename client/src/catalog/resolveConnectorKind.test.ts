import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { resolveConnectorKind, type ConnectorKindLike } from './resolveConnectorKind';

const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,24}$/);
const labelArb = fc.string({ minLength: 1, maxLength: 40 });

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

describe('resolveConnectorKind', () => {
  it('returns the catalog entry for every key present in the map', () => {
    fc.assert(
      fc.property(kindsMapArb, (byKey) => {
        for (const key of Object.keys(byKey)) {
          const resolved = resolveConnectorKind(byKey, key);
          expect(resolved).toBe(byKey[key]);
          expect(resolved?.key).toBe(key);
        }
      }),
    );
  });

  it('returns undefined for keys absent from the catalog', () => {
    fc.assert(
      fc.property(kindsMapArb, keyArb, (byKey, missing) => {
        fc.pre(!(missing in byKey));
        const absent = undefined;
        expect(resolveConnectorKind(byKey, missing)).toBe(absent);
      }),
    );
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { allLibraryNavItemsHavePaths } from '@/catalog/navItems';
import { buildConnectorNode } from '@/catalog/buildConnectorNode';
import {
  connectorKinds,
  connectorKindsByKey,
  getConnectorKind,
  shellNavItems,
} from '@/generated/catalog';

describe('generated connector catalog', () => {
  it('getConnectorKind resolves every seeded kind key', () => {
    fc.assert(
      fc.property(fc.constantFrom(...connectorKinds.map((k) => k.key)), (key) => {
        const resolved = getConnectorKind(key);
        expect(resolved).toBe(connectorKindsByKey[key]);
        expect(resolved?.key).toBe(key);
      }),
    );
  });

  it('buildConnectorNode only emits kindKeys present in the generated catalog', () => {
    const keys = connectorKinds.map((k) => k.key);
    fc.assert(
      fc.property(
        fc.constantFrom(...keys),
        fc.nat({ max: 10 }),
        fc.uuid(),
        (kindKey, count, id) => {
          const node = buildConnectorNode({
            kindKey,
            kindsByKey: connectorKindsByKey,
            existingConnectorCount: count,
            position: { x: count, y: count },
            newId: id,
          });
          expect(node !== undefined && node.data.kindKey in connectorKindsByKey).toBe(
            kindKey in connectorKindsByKey,
          );
        },
      ),
    );
  });
});

describe('generated shell nav items', () => {
  it('library list sources declare non-empty paths', () => {
    const items = shellNavItems.map((item) => ({
      key: item.key,
      label: item.label,
      path: item.path,
      listSource: item.listSource,
    }));
    expect(allLibraryNavItemsHavePaths(items)).toBe(
      items.every(
        (item) =>
          item.listSource !== 'connectorKinds' && item.listSource !== 'patches'
            ? true
            : item.path.length > 0,
      ),
    );
  });
});

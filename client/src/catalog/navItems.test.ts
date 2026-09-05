import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  allLibraryNavItemsHavePaths,
  libraryNavItemHasPath,
  type ShellNavItem,
} from './navItems';

const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,24}$/);
const labelArb = fc.string({ minLength: 1, maxLength: 40 });
const nonEmptyPathArb = fc
  .stringMatching(/^\/[a-z][a-z0-9_/-]{0,40}$/)
  .filter((p) => p.length > 0);
const listSourceArb = fc.constantFrom(
  'connectorKinds',
  'effectKinds',
  'patches',
  'none',
  'other',
);

const navItemArb: fc.Arbitrary<ShellNavItem> = fc
  .record({
    key: keyArb,
    label: labelArb,
    path: fc.oneof(nonEmptyPathArb, fc.constant('')),
    listSource: listSourceArb,
  })
  .map((item) => {
    if (
      (item.listSource === 'connectorKinds' ||
        item.listSource === 'effectKinds' ||
        item.listSource === 'patches') &&
      item.path.length === 0
    ) {
      return { ...item, path: `/${item.key}` };
    }
    return item;
  });

describe('libraryNavItemHasPath', () => {
  it('requires a non-empty path for connectorKinds, effectKinds, and patches list sources', () => {
    fc.assert(
      fc.property(navItemArb, (item) => {
        const ok = libraryNavItemHasPath(item);
        const expected =
          item.listSource === 'connectorKinds' ||
          item.listSource === 'effectKinds' ||
          item.listSource === 'patches'
            ? item.path.length > 0
            : true;
        expect(ok).toBe(expected);
      }),
    );
  });

  it('rejects empty paths on library list sources', () => {
    fc.assert(
      fc.property(
        keyArb,
        labelArb,
        fc.constantFrom('connectorKinds', 'effectKinds', 'patches'),
        (key, label, listSource) => {
          const item: ShellNavItem = { key, label, path: '', listSource };
          const rejected = false;
          expect(libraryNavItemHasPath(item)).toBe(rejected);
        },
      ),
    );
  });

  it('allLibraryNavItemsHavePaths is true iff every item passes', () => {
    fc.assert(
      fc.property(fc.array(navItemArb, { maxLength: 8 }), (items) => {
        expect(allLibraryNavItemsHavePaths(items)).toBe(
          items.every(libraryNavItemHasPath),
        );
      }),
    );
  });
});

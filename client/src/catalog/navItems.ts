/** Shell nav entry from Clay catalog.shell.navItems. */
export type ShellNavItem = {
  key: string;
  label: string;
  path: string;
  listSource: string;
};

const LIBRARY_SOURCES = new Set(['connectorKinds', 'patches']);

/** Library nav items must declare a non-empty path string. */
export function libraryNavItemHasPath(item: ShellNavItem): boolean {
  if (!LIBRARY_SOURCES.has(item.listSource)) return true;
  return typeof item.path === 'string' && item.path.length > 0;
}

export function allLibraryNavItemsHavePaths(items: readonly ShellNavItem[]): boolean {
  return items.every(libraryNavItemHasPath);
}

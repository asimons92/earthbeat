export type ThemeMode = 'light' | 'dark';

export function toggleTheme(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : 'light';
}

export function parseStoredTheme(raw: string | null): ThemeMode | null {
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

export function resolveTheme(stored: string | null): ThemeMode {
  return parseStoredTheme(stored) ?? 'light';
}

export function serializeTheme(mode: ThemeMode): string {
  return mode;
}

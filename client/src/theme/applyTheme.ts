import { resolveTheme, serializeTheme, type ThemeMode } from './themePreference';

export const THEME_STORAGE_KEY = 'earthbeat.theme';

export function readStoredTheme(): ThemeMode {
  return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function writeStoredTheme(mode: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, serializeTheme(mode));
}

export function applyDocumentTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

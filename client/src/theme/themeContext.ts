import { createContext } from 'react';

import type { ThemeMode } from './themePreference';

export type ThemeContextValue = {
  mode: ThemeMode;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

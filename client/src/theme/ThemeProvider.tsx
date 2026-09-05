import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { applyDocumentTheme, readStoredTheme, writeStoredTheme } from './applyTheme';
import { ThemeContext } from './themeContext';
import { toggleTheme, type ThemeMode } from './themePreference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const initial = readStoredTheme();
    applyDocumentTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyDocumentTheme(mode);
    writeStoredTheme(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => toggleTheme(current));
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

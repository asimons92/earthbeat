import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  parseStoredTheme,
  resolveTheme,
  serializeTheme,
  toggleTheme,
  type ThemeMode,
} from './themePreference';

const themeMode: fc.Arbitrary<ThemeMode> = fc.constantFrom('light', 'dark');

describe('themePreference', () => {
  it('toggleTheme always returns the other mode', () => {
    fc.assert(
      fc.property(themeMode, (mode) => {
        expect(toggleTheme(mode)).not.toBe(mode);
      }),
    );
  });

  it('toggleTheme is an involution', () => {
    fc.assert(
      fc.property(themeMode, (mode) => {
        expect(toggleTheme(toggleTheme(mode))).toBe(mode);
      }),
    );
  });

  it('parseStoredTheme accepts only the two legal modes', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const parsed = parseStoredTheme(raw);
        const expected = raw === 'light' || raw === 'dark' ? raw : null;
        expect(parsed).toBe(expected);
      }),
    );
  });

  it('parseStoredTheme returns null for a missing value', () => {
    expect(parseStoredTheme(null)).toBeNull();
  });

  it('resolveTheme keeps a stored legal mode and otherwise uses light', () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: null }), (stored) => {
        const resolved = resolveTheme(stored);
        const expected = parseStoredTheme(stored) ?? 'light';
        expect(resolved).toBe(expected);
      }),
    );
  });

  it('serializeTheme round-trips through parseStoredTheme', () => {
    fc.assert(
      fc.property(themeMode, (mode) => {
        expect(parseStoredTheme(serializeTheme(mode))).toBe(mode);
      }),
    );
  });
});

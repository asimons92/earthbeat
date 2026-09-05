import { Button } from '@/components/ui/button';

import { useTheme } from './useTheme';

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const nextLabel = mode === 'light' ? 'Dark' : 'Light';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="theme-toggle"
      aria-label={`Switch to ${nextLabel.toLowerCase()} mode`}
      aria-pressed={mode === 'dark'}
      onClick={toggle}
    >
      {nextLabel}
    </Button>
  );
}

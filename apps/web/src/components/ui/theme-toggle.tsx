'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ThemeToggle — Sun/Moon toggle for light/dark/system themes.
 * Matches the Apple-inspired glassmorphism design system.
 *
 * Cycles: light -> dark -> system -> light ...
 * Visual: Sun icon for light, Moon for dark, Monitor for system.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: only render after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder with matching dimensions to prevent layout shift
    return (
      <div
        className={cn(
          'h-9 w-9 rounded-[10px]',
          className,
        )}
      />
    );
  }

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';

  const label = isSystem
    ? 'Theme: system'
    : isDark
      ? 'Theme: dark'
      : 'Theme: light';

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-[10px]',
        'transition-all duration-200',
        'backdrop-blur-[20px] saturate-[180%]',
        'border border-[var(--glass-border-muted)]',
        'bg-[var(--glass-pill-bg)]',
        'shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
        'hover:bg-[var(--glass-bg-hover)]',
        'hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        'hover:-translate-y-[1px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC7620]/30',
        className,
      )}
      aria-label={label}
      title={label}
    >
      {isSystem ? (
        /* Monitor icon for system theme */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-secondary)] transition-colors"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ) : isDark ? (
        /* Moon icon for dark theme */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-secondary)] transition-colors"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        /* Sun icon for light theme */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-secondary)] transition-colors"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
}

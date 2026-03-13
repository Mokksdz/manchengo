'use client';

import { useLanguage } from '@/lib/i18n/language-context';

/**
 * Skip to Content Link - WCAG 2.1 AA Requirement
 *
 * Provides keyboard users a way to skip the navigation and jump to main content.
 * Visually hidden until focused via Tab key.
 * i18n-aware: shows translated text based on current language (FR/AR).
 */
export function SkipToContent() {
  let label = 'Aller au contenu principal';

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { t } = useLanguage();
    label = t.a11y?.skipToContent || label;
  } catch {
    // LanguageProvider not available (e.g., login page) — use French default
  }

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {label}
    </a>
  );
}

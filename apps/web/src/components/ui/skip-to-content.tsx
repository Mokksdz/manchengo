'use client';

/**
 * Skip to Content Link - WCAG 2.1 AA Requirement
 *
 * Provides keyboard users a way to skip the navigation and jump to main content.
 * Visually hidden until focused via Tab key.
 *
 * Usage: Place as first child of <body> or root layout
 *   <SkipToContent />
 *   <nav>...</nav>
 *   <main id="main-content">...</main>
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      Aller au contenu principal
    </a>
  );
}

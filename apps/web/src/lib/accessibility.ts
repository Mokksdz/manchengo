/**
 * Accessibility Utilities - WCAG 2.1 AA Compliance
 *
 * This module provides utilities for:
 * - Screen reader announcements (live regions)
 * - Focus management
 * - Keyboard navigation helpers
 * - Color contrast validation
 * - Reduced motion preferences
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN READER ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

let liveRegion: HTMLElement | null = null;

/**
 * Initialize the live region for screen reader announcements
 * Call this once in your app's entry point
 */
export function initLiveRegion(): void {
  if (typeof document === 'undefined') return;
  if (liveRegion) return;

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.id = 'a11y-live-region';
  document.body.appendChild(liveRegion);
}

/**
 * Announce a message to screen readers
 * @param message - The message to announce
 * @param priority - 'polite' (default) or 'assertive' for urgent messages
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;

  // Initialize if needed
  if (!liveRegion) {
    initLiveRegion();
  }

  if (!liveRegion) return;

  // Update aria-live for priority
  liveRegion.setAttribute('aria-live', priority);

  // Clear and set message (triggers announcement)
  liveRegion.textContent = '';
  // Use setTimeout to ensure screen readers detect the change
  setTimeout(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }, 100);
}

/**
 * Announce an error message (uses assertive priority)
 */
export function announceError(message: string): void {
  announce(`Erreur: ${message}`, 'assertive');
}

/**
 * Announce a success message
 */
export function announceSuccess(message: string): void {
  announce(message, 'polite');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOCUS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Focus trap utility for modals and dialogs
 */
export function createFocusTrap(container: HTMLElement): {
  activate: () => void;
  deactivate: () => void;
} {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let previousFocusElement: HTMLElement | null = null;

  const getFocusableElements = (): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  return {
    activate() {
      previousFocusElement = document.activeElement as HTMLElement;
      container.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    },
    deactivate() {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousFocusElement && document.body.contains(previousFocusElement)) {
        previousFocusElement.focus();
      }
    },
  };
}

/**
 * Move focus to an element
 */
export function focusElement(element: HTMLElement | null): void {
  if (!element) return;

  // Make temporarily focusable if needed
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
    element.focus();
    element.removeAttribute('tabindex');
  } else {
    element.focus();
  }
}

/**
 * Get first focusable element in a container
 */
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
  const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return container.querySelector<HTMLElement>(focusableSelectors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common keyboard key codes
 */
export const Keys = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Handle keyboard navigation for a list of items
 */
export function handleListKeyboard(
  event: React.KeyboardEvent,
  currentIndex: number,
  itemCount: number,
  onSelect: (index: number) => void,
  orientation: 'vertical' | 'horizontal' = 'vertical',
): void {
  const prevKey = orientation === 'vertical' ? Keys.ARROW_UP : Keys.ARROW_LEFT;
  const nextKey = orientation === 'vertical' ? Keys.ARROW_DOWN : Keys.ARROW_RIGHT;

  switch (event.key) {
    case prevKey:
      event.preventDefault();
      onSelect(currentIndex > 0 ? currentIndex - 1 : itemCount - 1);
      break;
    case nextKey:
      event.preventDefault();
      onSelect(currentIndex < itemCount - 1 ? currentIndex + 1 : 0);
      break;
    case Keys.HOME:
      event.preventDefault();
      onSelect(0);
      break;
    case Keys.END:
      event.preventDefault();
      onSelect(itemCount - 1);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCED MOTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hook-like function to get reduced motion preference
 * Use with useEffect/useState in React components
 */
export function getMotionPreference(): {
  reducedMotion: boolean;
  subscribe: (callback: (reduced: boolean) => void) => () => void;
} {
  const reducedMotion = prefersReducedMotion();

  const subscribe = (callback: (reduced: boolean) => void): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => callback(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  };

  return { reducedMotion, subscribe };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR CONTRAST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate relative luminance of a color
 * @param hex - Hex color string (e.g., "#FFFFFF")
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 requires:
 * - Normal text: 4.5:1 minimum (AA), 7:1 enhanced (AAA)
 * - Large text: 3:1 minimum (AA), 4.5:1 enhanced (AAA)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG standards
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);

  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }

  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARIA HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique ID for ARIA labelling
 */
let idCounter = 0;
export function generateAriaId(prefix = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Generate ARIA props for a describedby relationship
 */
export function getAriaDescribedBy(
  description: string | undefined,
  id: string,
): { 'aria-describedby'?: string; id?: string; content?: string } {
  if (!description) return {};

  return {
    'aria-describedby': id,
    id,
    content: description,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISIBILITY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CSS class for visually hidden but accessible content
 * Use for screen reader only content
 */
export const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: '0',
};

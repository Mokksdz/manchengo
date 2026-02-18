'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  announce,
  announceError,
  announceSuccess,
  initLiveRegion,
  createFocusTrap,
  prefersReducedMotion,
  focusElement,
} from '@/lib/accessibility';

// ═══════════════════════════════════════════════════════════════════════════════
// useAnnounce - Screen reader announcements
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for screen reader announcements
 */
export function useAnnounce() {
  useEffect(() => {
    initLiveRegion();
  }, []);

  return {
    announce,
    announceError,
    announceSuccess,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// useFocusTrap - Modal/dialog focus management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to trap focus within a container (for modals)
 */
export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const trapRef = useRef<ReturnType<typeof createFocusTrap> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isActive) {
      trapRef.current = createFocusTrap(containerRef.current);
      trapRef.current.activate();
    }

    return () => {
      trapRef.current?.deactivate();
    };
  }, [isActive]);

  return containerRef;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useReducedMotion - Respect user's motion preferences
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to check if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return prefersReducedMotion();
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useFocusOnMount - Auto-focus on component mount
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to focus an element when component mounts
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current) {
      focusElement(ref.current);
    }
  }, []);

  return ref;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useKeyboardNavigation - Arrow key navigation for lists
// ═══════════════════════════════════════════════════════════════════════════════

interface UseKeyboardNavigationOptions {
  itemCount: number;
  orientation?: 'vertical' | 'horizontal';
  loop?: boolean;
  onSelect?: (index: number) => void;
  onActivate?: (index: number) => void;
}

/**
 * Hook for keyboard navigation in lists/menus
 */
export function useKeyboardNavigation({
  itemCount,
  orientation = 'vertical',
  loop = true,
  onSelect,
  onActivate,
}: UseKeyboardNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';

      switch (event.key) {
        case prevKey:
          event.preventDefault();
          setActiveIndex((prev) => {
            const next = prev > 0 ? prev - 1 : loop ? itemCount - 1 : prev;
            onSelect?.(next);
            return next;
          });
          break;

        case nextKey:
          event.preventDefault();
          setActiveIndex((prev) => {
            const next = prev < itemCount - 1 ? prev + 1 : loop ? 0 : prev;
            onSelect?.(next);
            return next;
          });
          break;

        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          onSelect?.(0);
          break;

        case 'End':
          event.preventDefault();
          setActiveIndex(itemCount - 1);
          onSelect?.(itemCount - 1);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          onActivate?.(activeIndex);
          break;
      }
    },
    [activeIndex, itemCount, loop, orientation, onSelect, onActivate],
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getItemProps: (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === activeIndex,
      onFocus: () => setActiveIndex(index),
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// useAriaLive - Dynamic ARIA live region
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for a component-scoped live region
 */
export function useAriaLive(politeness: 'polite' | 'assertive' = 'polite') {
  const [message, setMessage] = useState('');

  const LiveRegion = useCallback(() => {
    return (
      <div
        role="status"
        aria-live={politeness}
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    );
  }, [message, politeness]);

  return {
    announce: setMessage,
    LiveRegion,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// useSkipLink - Skip to content functionality
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to manage skip links
 */
export function useSkipLink(targetId = 'main-content') {
  const handleSkip = useCallback(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.removeAttribute('tabindex');
    }
  }, [targetId]);

  return handleSkip;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useId - Generate unique IDs for ARIA relationships
// ═══════════════════════════════════════════════════════════════════════════════

let globalIdCounter = 0;

/**
 * Hook to generate unique IDs for ARIA labelling
 */
export function useAriaId(prefix = 'aria'): string {
  const [id] = useState(() => `${prefix}-${++globalIdCounter}`);
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// useEscapeKey - Close on escape
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to handle Escape key press
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, enabled]);
}

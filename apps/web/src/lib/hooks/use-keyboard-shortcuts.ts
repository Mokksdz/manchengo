'use client';

import { useEffect, useCallback } from 'react';

export interface ShortcutConfig {
  key: string;
  handler: () => void;
  description: string;
  disabled?: boolean;
}

/**
 * Keyboard shortcuts hook for ERP pages.
 *
 * Ignores shortcuts when:
 * - Focus is inside an input, textarea, select, or [contenteditable]
 * - A modal/dialog is open (checks for [role="dialog"] in DOM)
 *
 * Cleans up listeners on unmount. Does not interfere with existing
 * useEscapeKey usage (Escape is intentionally not handled here).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in form fields
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore when a modal/dialog is open
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      // Ignore if any modifier key is pressed (Ctrl, Alt, Meta, Shift)
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return;
      }

      const pressedKey = e.key.toLowerCase();

      for (const shortcut of shortcuts) {
        if (shortcut.disabled) continue;
        if (shortcut.key.toLowerCase() === pressedKey) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

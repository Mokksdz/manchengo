/**
 * Tests for useKeyboardShortcuts hook
 *
 * Covers: key handling, ignoring form fields, ignoring modals,
 * ignoring modifier keys, disabled shortcuts, cleanup on unmount.
 */

import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts';

function fireKeyDown(key: string, options: Partial<KeyboardEventInit> = {}, target?: HTMLElement) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });

  // Dispatch on the target element so e.target is set correctly
  (target || document.body).dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  it('calls handler when matching key is pressed', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('n');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles case-insensitive keys', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'N', handler, description: 'New' },
    ]));

    fireKeyDown('n');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler for non-matching keys', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('r');
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple shortcuts', () => {
    const newHandler = jest.fn();
    const refreshHandler = jest.fn();

    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler: newHandler, description: 'New' },
      { key: 'r', handler: refreshHandler, description: 'Refresh' },
    ]));

    fireKeyDown('n');
    fireKeyDown('r');

    expect(newHandler).toHaveBeenCalledTimes(1);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when focus is in an input', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKeyDown('n', {}, input);
    document.body.removeChild(input);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when focus is in a textarea', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    fireKeyDown('n', {}, textarea);
    document.body.removeChild(textarea);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when focus is in a select', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    const select = document.createElement('select');
    document.body.appendChild(select);
    fireKeyDown('n', {}, select);
    document.body.removeChild(select);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when a modal dialog is open', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    fireKeyDown('n');
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(dialog);
  });

  it('ignores shortcuts when Ctrl is pressed', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('n', { ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when Meta (Cmd) is pressed', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('n', { metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when Alt is pressed', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('n', { altKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts when Shift is pressed', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    fireKeyDown('n', { shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips disabled shortcuts', () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New', disabled: true },
    ]));

    fireKeyDown('n');
    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts([
      { key: 'n', handler, description: 'New' },
    ]));

    unmount();
    fireKeyDown('n');
    expect(handler).not.toHaveBeenCalled();
  });
});

/**
 * Tests for useRequireRole hook
 *
 * Covers: access granted, access denied, loading state,
 * redirect on denied, timing of redirect.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';

// ─── Mocks ───
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const mockAuth: {
  user: null | { id: string; role: string };
  isLoading: boolean;
} = { user: null, isLoading: true };

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

import { useRequireRole } from '../use-require-role';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockAuth.user = null;
  mockAuth.isLoading = true;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRequireRole', () => {
  it('returns isLoading=true while auth is loading', () => {
    mockAuth.isLoading = true;
    const { result } = renderHook(() => useRequireRole(['ADMIN']));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasAccess).toBeFalsy();
  });

  it('returns hasAccess=true when user role is in allowed list', () => {
    mockAuth.isLoading = false;
    mockAuth.user = { id: '1', role: 'ADMIN' };
    const { result } = renderHook(() => useRequireRole(['ADMIN']));
    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isAccessDenied).toBe(false);
  });

  it('returns hasAccess=true for multiple allowed roles', () => {
    mockAuth.isLoading = false;
    mockAuth.user = { id: '1', role: 'APPRO' };
    const { result } = renderHook(() => useRequireRole(['ADMIN', 'APPRO']));
    expect(result.current.hasAccess).toBe(true);
  });

  it('returns hasAccess=false when user role is not in allowed list', () => {
    mockAuth.isLoading = false;
    mockAuth.user = { id: '1', role: 'COMMERCIAL' };
    const { result } = renderHook(() => useRequireRole(['ADMIN']));
    expect(result.current.hasAccess).toBeFalsy();
    expect(result.current.isAccessDenied).toBe(true);
  });

  it('redirects to /dashboard after delay when access is denied', async () => {
    mockAuth.isLoading = false;
    mockAuth.user = { id: '1', role: 'COMMERCIAL' };

    renderHook(() => useRequireRole(['ADMIN']));

    // Should not redirect immediately
    expect(mockReplace).not.toHaveBeenCalled();

    // Advance timer by 2000ms (the delay in the hook)
    jest.advanceTimersByTime(2000);

    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect when access is granted', () => {
    mockAuth.isLoading = false;
    mockAuth.user = { id: '1', role: 'ADMIN' };

    renderHook(() => useRequireRole(['ADMIN']));

    jest.advanceTimersByTime(5000);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect while loading', () => {
    mockAuth.isLoading = true;
    mockAuth.user = null;

    renderHook(() => useRequireRole(['ADMIN']));

    jest.advanceTimersByTime(5000);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns the user object', () => {
    const testUser = { id: '1', role: 'ADMIN' };
    mockAuth.isLoading = false;
    mockAuth.user = testUser;

    const { result } = renderHook(() => useRequireRole(['ADMIN']));
    expect(result.current.user).toEqual(testUser);
  });
});

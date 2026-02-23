/**
 * Unit tests for auth-related exports from src/lib/api.ts
 *
 * Covers: API_BASE constant, getApiUrl() URL builder, ApiError class.
 */

import { API_BASE, getApiUrl, ApiError } from '../api';

// ---------------------------------------------------------------------------
// API_BASE
// ---------------------------------------------------------------------------
describe('API_BASE', () => {
  it('is a non-empty string containing /api', () => {
    expect(typeof API_BASE).toBe('string');
    expect(API_BASE.length).toBeGreaterThan(0);
    expect(API_BASE).toContain('/api');
  });
});

// ---------------------------------------------------------------------------
// getApiUrl – auth endpoints
// ---------------------------------------------------------------------------
describe('getApiUrl – auth endpoints', () => {
  it('builds /auth/login correctly', () => {
    expect(getApiUrl('/auth/login')).toBe(`${API_BASE}/auth/login`);
  });

  it('builds /auth/refresh correctly', () => {
    expect(getApiUrl('/auth/refresh')).toBe(`${API_BASE}/auth/refresh`);
  });

  it('prepends slash when missing', () => {
    expect(getApiUrl('auth/me')).toBe(`${API_BASE}/auth/me`);
  });

  it('handles nested paths', () => {
    expect(getApiUrl('/auth/devices/list')).toBe(`${API_BASE}/auth/devices/list`);
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------
describe('ApiError', () => {
  it('carries status and message', () => {
    const err = new ApiError('Unauthorized', 401);
    expect(err.message).toBe('Unauthorized');
    expect(err.status).toBe(401);
    expect(err.name).toBe('ApiError');
  });

  it('stores fieldErrors when provided', () => {
    const fields = { password: ['Too short', 'Needs uppercase'] };
    const err = new ApiError('Validation', 422, fields);
    expect(err.fieldErrors).toEqual(fields);
  });

  it('defaults fieldErrors to null', () => {
    const err = new ApiError('Forbidden', 403);
    expect(err.fieldErrors).toBeNull();
  });

  it('is an instance of Error', () => {
    expect(new ApiError('x', 500)).toBeInstanceOf(Error);
  });
});

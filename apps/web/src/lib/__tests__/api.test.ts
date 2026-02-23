/**
 * Unit tests for src/lib/api.ts
 *
 * Tests the API client layer: URL construction, error handling,
 * 401 refresh logic, and API namespace methods.
 */

import { apiFetch, ApiError, getApiUrl, API_BASE, auth, dashboard, admin } from '../api';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// getApiUrl
// ---------------------------------------------------------------------------
describe('getApiUrl', () => {
  it('builds a full URL from an endpoint starting with /', () => {
    expect(getApiUrl('/dashboard/kpis')).toBe(`${API_BASE}/dashboard/kpis`);
  });

  it('prepends a slash when the endpoint does not start with one', () => {
    expect(getApiUrl('dashboard/kpis')).toBe(`${API_BASE}/dashboard/kpis`);
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------
describe('ApiError', () => {
  it('stores status and message', () => {
    const err = new ApiError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.name).toBe('ApiError');
  });

  it('stores field-level errors when provided', () => {
    const fields = { email: ['Email is required'] };
    const err = new ApiError('Validation failed', 422, fields);
    expect(err.fieldErrors).toEqual(fields);
  });

  it('defaults fieldErrors to null', () => {
    const err = new ApiError('Bad request', 400);
    expect(err.fieldErrors).toBeNull();
  });

  it('is an instance of Error', () => {
    const err = new ApiError('oops', 500);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// apiFetch – URL construction & headers
// ---------------------------------------------------------------------------
describe('apiFetch', () => {
  it('calls fetch with the full URL built from API_BASE + endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    });

    await apiFetch('/test/endpoint');

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/test/endpoint`,
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('returns parsed JSON on a successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [1, 2, 3] }),
    });

    const result = await apiFetch('/items');
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('throws ApiError with status text for non-OK responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    await expect(apiFetch('/secret')).rejects.toThrow('Forbidden');
  });

  it('uses fallback status message when response body has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(apiFetch('/fail')).rejects.toThrow('Erreur serveur');
  });

  it('joins array validation messages from NestJS', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: ['field1 required', 'field2 invalid'] }),
    });

    await expect(apiFetch('/validate')).rejects.toThrow('field1 required, field2 invalid');
  });
});

// ---------------------------------------------------------------------------
// apiFetch – 401 refresh flow
// ---------------------------------------------------------------------------
describe('apiFetch – 401 token refresh', () => {
  it('retries the request after a successful token refresh', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'refreshed' }),
    });

    // Retry call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ retried: true }),
    });

    const result = await apiFetch('/protected');
    expect(result).toEqual({ retried: true });
    // 3 calls: original + refresh + retry
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws "Session expirée" when refresh fails', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    // Refresh call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(apiFetch('/protected')).rejects.toThrow('Session expirée');
  });

  it('dispatches auth:session-expired event when refresh fails', async () => {
    const handler = jest.fn();
    window.addEventListener('auth:session-expired', handler);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(apiFetch('/protected')).rejects.toThrow();
    expect(handler).toHaveBeenCalled();

    window.removeEventListener('auth:session-expired', handler);
  });
});

// ---------------------------------------------------------------------------
// API namespace objects exist with correct methods
// ---------------------------------------------------------------------------
describe('API namespaces', () => {
  it('auth namespace has login, logout, refresh, and me methods', () => {
    expect(typeof auth.login).toBe('function');
    expect(typeof auth.logout).toBe('function');
    expect(typeof auth.refresh).toBe('function');
    expect(typeof auth.me).toBe('function');
  });

  it('dashboard namespace has expected methods', () => {
    expect(typeof dashboard.getKpis).toBe('function');
    expect(typeof dashboard.getSalesChart).toBe('function');
    expect(typeof dashboard.getProductionChart).toBe('function');
    expect(typeof dashboard.getProductionDashboard).toBe('function');
    expect(typeof dashboard.getSyncStatus).toBe('function');
    expect(typeof dashboard.getRecentEvents).toBe('function');
  });

  it('admin namespace has expected methods', () => {
    expect(typeof admin.getStockMp).toBe('function');
    expect(typeof admin.getStockPf).toBe('function');
    expect(typeof admin.getInvoices).toBe('function');
    expect(typeof admin.getInvoice).toBe('function');
    expect(typeof admin.getProductionOrders).toBe('function');
    expect(typeof admin.getClients).toBe('function');
    expect(typeof admin.getSuppliers).toBe('function');
    expect(typeof admin.getUsers).toBe('function');
    expect(typeof admin.getDevices).toBe('function');
  });

  it('auth.login calls apiFetch with POST /auth/login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'ok', user: { id: '1', email: 'a@b.com' } }),
    });

    await auth.login('a@b.com', 'pass123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pass123' }),
      }),
    );
  });
});

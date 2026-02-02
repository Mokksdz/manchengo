/**
 * Unit tests for src/lib/auth-context.tsx
 *
 * Tests the AuthProvider and useAuth hook: rendering children,
 * exposing user state, login, and logout behaviour.
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../auth-context';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock the api module
const mockMe = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();

jest.mock('../api', () => ({
  auth: {
    me: (...args: unknown[]) => mockMe(...args),
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    refresh: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helper: component that consumes useAuth
// ---------------------------------------------------------------------------
function AuthConsumer() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={() => login('test@test.com', 'password')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // By default, auth.me rejects (no session)
  mockMe.mockRejectedValue(new Error('Not authenticated'));
});

describe('AuthProvider', () => {
  it('renders children', async () => {
    render(
      <AuthProvider>
        <span>Hello Child</span>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello Child')).toBeInTheDocument();
    });
  });

  it('sets isLoading to false after initial auth check', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('sets user when auth.me succeeds on mount', async () => {
    const fakeUser = {
      id: '1',
      code: 'U001',
      email: 'admin@manchengo.dz',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
    };
    mockMe.mockResolvedValue(fakeUser);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@manchengo.dz');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
  });

  it('sets user to null when auth.me fails on mount', async () => {
    mockMe.mockRejectedValue(new Error('Not authenticated'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });
});

describe('useAuth – login', () => {
  it('updates user state after successful login', async () => {
    const fakeUser = {
      id: '2',
      code: 'U002',
      email: 'prod@manchengo.dz',
      firstName: 'Prod',
      lastName: 'User',
      role: 'PRODUCTION' as const,
    };
    mockLogin.mockResolvedValue({ message: 'ok', user: fakeUser });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Wait for initial auth check to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('prod@manchengo.dz');
    });
  });
});

describe('useAuth – logout', () => {
  it('clears user state after logout', async () => {
    const fakeUser = {
      id: '1',
      code: 'U001',
      email: 'admin@manchengo.dz',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
    };
    mockMe.mockResolvedValue(fakeUser);
    mockLogout.mockResolvedValue({ message: 'ok' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Wait until user is loaded
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@manchengo.dz');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });

  it('clears user state even if auth.logout API call fails', async () => {
    const fakeUser = {
      id: '1',
      code: 'U001',
      email: 'admin@manchengo.dz',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
    };
    mockMe.mockResolvedValue(fakeUser);
    mockLogout.mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@manchengo.dz');
    });

    await act(async () => {
      await userEvent.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none');
    });
  });
});

describe('useAuth – outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress console.error for expected error boundary
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<AuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    spy.mockRestore();
  });
});

/**
 * Tests for Login Page
 *
 * Covers: form rendering, email/password inputs, submit, error display,
 * show/hide password toggle, role-based redirect, already-auth redirect.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
}));

const mockLogin = jest.fn();
const mockAuth = {
  user: null as null | { role: string },
  isLoading: false,
  isAuthenticated: false,
  login: mockLogin,
  logout: jest.fn(),
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

import LoginPage from '../page';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.isLoading = false;
  mockAuth.isAuthenticated = false;
});

describe('LoginPage', () => {
  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('renders the Manchengo Smart ERP title', () => {
    render(<LoginPage />);
    expect(screen.getByText('Manchengo Smart ERP')).toBeInTheDocument();
    expect(screen.getByText('Connexion')).toBeInTheDocument();
  });

  it('allows typing email and password', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Mot de passe');

    await user.type(emailInput, 'test@manchengo.dz');
    await user.type(passwordInput, 'mypassword123');

    expect(emailInput).toHaveValue('test@manchengo.dz');
    expect(passwordInput).toHaveValue('mypassword123');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText('Mot de passe');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText('Afficher le mot de passe');
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    const hideButton = screen.getByLabelText('Masquer le mot de passe');
    await user.click(hideButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls login on form submit and redirects ADMIN to /dashboard', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'ADMIN' });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@manchengo.dz');
    await user.type(screen.getByLabelText('Mot de passe'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@manchengo.dz', 'password123!');
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('redirects APPRO role to /dashboard/appro', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'APPRO' });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'appro@manchengo.dz');
    await user.type(screen.getByLabelText('Mot de passe'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/appro');
    });
  });

  it('redirects PRODUCTION role to /dashboard/production', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'PRODUCTION' });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'prod@manchengo.dz');
    await user.type(screen.getByLabelText('Mot de passe'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/production');
    });
  });

  it('redirects COMMERCIAL role to /dashboard/invoices', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ role: 'COMMERCIAL' });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'com@manchengo.dz');
    await user.type(screen.getByLabelText('Mot de passe'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/invoices');
    });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Email ou mot de passe incorrect'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'wrong@test.com');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(screen.getByText('Email ou mot de passe incorrect')).toBeInTheDocument();
    });
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    mockLogin.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@manchengo.dz');
    await user.type(screen.getByLabelText('Mot de passe'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(screen.getByText('Connexion...')).toBeInTheDocument();
    });
  });

  it('shows loading spinner when already authenticated', () => {
    mockAuth.isAuthenticated = true;
    mockAuth.user = { role: 'ADMIN' };

    render(<LoginPage />);

    expect(screen.getByText('Redirection...')).toBeInTheDocument();
  });

  it('shows verification spinner while auth is loading', () => {
    mockAuth.isLoading = true;

    render(<LoginPage />);

    expect(screen.getByText('Vérification...')).toBeInTheDocument();
  });

  it('displays current year in copyright', () => {
    render(<LoginPage />);
    expect(screen.getByText(/© \d{4} Manchengo Smart ERP/)).toBeInTheDocument();
  });
});

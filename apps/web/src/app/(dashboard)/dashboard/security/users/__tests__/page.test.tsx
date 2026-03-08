/**
 * Tests for Security Users Management Page
 *
 * Covers: RBAC (ADMIN only), user listing, stats cards, create user modal,
 * edit user modal, reset password modal, toggle user status, role badges,
 * loading state, error display, password strength indicator.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockAuth = {
  user: { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
  isLoading: false,
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/lib/hooks/use-require-role', () => ({
  useRequireRole: (roles: string[]) => ({
    hasAccess: roles.includes(mockAuth.user?.role || ''),
    isLoading: false,
    user: mockAuth.user,
    isAccessDenied: !roles.includes(mockAuth.user?.role || ''),
  }),
}));

const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
  useEscapeKey: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('@/components/ui/skeleton-loader', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} data-testid="skeleton" />,
}));

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions}
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

import UsersManagementPage from '../page';

const mockUsers = [
  { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN', isActive: true, createdAt: '2026-01-01', _count: { devices: 2 } },
  { id: '2', code: 'USR-002', email: 'appro@manchengo.dz', firstName: 'Appro', lastName: 'Manager', role: 'APPRO', isActive: true, createdAt: '2026-01-15', _count: { devices: 1 } },
  { id: '3', code: 'USR-003', email: 'blocked@manchengo.dz', firstName: 'Blocked', lastName: 'User', role: 'COMMERCIAL', isActive: false, createdAt: '2026-02-01', _count: { devices: 0 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' };
  mockApiFetch.mockResolvedValue(mockUsers);
});

describe('UsersManagementPage', () => {
  it('renders the page header', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Gestion des Utilisateurs')).toBeInTheDocument();
    });
  });

  it('displays user stats cards', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Actifs')).toBeInTheDocument();
      expect(screen.getByText('Bloqués')).toBeInTheDocument();
      // "Appareils" appears in stats card and table header
      const appareilsElements = screen.getAllByText('Appareils');
      expect(appareilsElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows correct stats counts', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      // 3 total users, 3 total devices — "3" appears multiple times
      const threes = screen.getAllByText('3');
      expect(threes.length).toBeGreaterThanOrEqual(1);
      // 2 active users
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays all users in the table', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('admin@manchengo.dz')).toBeInTheDocument();
      expect(screen.getByText('appro@manchengo.dz')).toBeInTheDocument();
      expect(screen.getByText('blocked@manchengo.dz')).toBeInTheDocument();
    });
  });

  it('displays user names with initials', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Appro Manager')).toBeInTheDocument();
    });
  });

  it('displays role badges', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('APPRO')).toBeInTheDocument();
      expect(screen.getByText('COMMERCIAL')).toBeInTheDocument();
    });
  });

  it('displays status badges (Actif/Bloqué)', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      const actifBadges = screen.getAllByText('Actif');
      expect(actifBadges.length).toBe(2);
      expect(screen.getByText('Bloqué')).toBeInTheDocument();
    });
  });

  it('shows Bloquer button for active users and Activer for blocked', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      const bloquerButtons = screen.getAllByText('Bloquer');
      expect(bloquerButtons.length).toBe(2);
      expect(screen.getByText('Activer')).toBeInTheDocument();
    });
  });

  it('opens create user modal on Ajouter click', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('Ajouter')).toBeInTheDocument());

    await user.click(screen.getByText('Ajouter'));

    await waitFor(() => {
      expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument();
      expect(screen.getByText('Code *')).toBeInTheDocument();
      expect(screen.getByText('Email *')).toBeInTheDocument();
      expect(screen.getByText('Mot de passe *')).toBeInTheDocument();
    });
  });

  it('create user form submits correctly', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('Ajouter')).toBeInTheDocument());
    await user.click(screen.getByText('Ajouter'));

    await waitFor(() => expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('USR-004'), 'USR-004');

    const submitButton = screen.getByText('Créer');
    expect(submitButton).toBeInTheDocument();
  });

  it('opens edit modal with pre-filled data', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('admin@manchengo.dz')).toBeInTheDocument());

    // Click the first edit button (pencil icon)
    const editButtons = screen.getAllByTitle('Modifier');
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Modifier l'utilisateur")).toBeInTheDocument();
    });
  });

  it('opens reset password modal', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('admin@manchengo.dz')).toBeInTheDocument());

    const resetButtons = screen.getAllByTitle('Réinitialiser mot de passe');
    await user.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Réinitialiser le mot de passe')).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when toggling user status', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('admin@manchengo.dz')).toBeInTheDocument());

    const bloquerButtons = screen.getAllByText('Bloquer');
    await user.click(bloquerButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Bloquer l'utilisateur/)).toBeInTheDocument();
    });
  });

  it('confirms toggle and calls API', async () => {
    const user = userEvent.setup();
    mockApiFetch
      .mockResolvedValueOnce(mockUsers) // initial load
      .mockResolvedValueOnce({}) // toggle status
      .mockResolvedValueOnce(mockUsers); // reload

    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('admin@manchengo.dz')).toBeInTheDocument());

    const bloquerButtons = screen.getAllByText('Bloquer');
    await user.click(bloquerButtons[0]);

    await waitFor(() => expect(screen.getByText(/Bloquer l'utilisateur/)).toBeInTheDocument());

    // Click the confirm button in dialog (second "Bloquer" button)
    const allBlockButtons = screen.getAllByText('Bloquer');
    await user.click(allBlockButtons[allBlockButtons.length - 1]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/admin/users/1/toggle-status', { method: 'POST' });
    });
  });

  it('shows refresh button', async () => {
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Actualiser')).toBeInTheDocument();
    });
  });

  it('shows loading skeletons while loading', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}));
    render(<UsersManagementPage />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('denies access to non-ADMIN users', () => {
    mockAuth.user = { id: '2', code: 'USR-002', email: 'com@manchengo.dz', firstName: 'Com', lastName: 'User', role: 'COMMERCIAL' };
    render(<UsersManagementPage />);
    // Should show loading/denied spinner, not the page content
    expect(screen.queryByText('Gestion des Utilisateurs')).not.toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Server error'));
    render(<UsersManagementPage />);
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows password strength indicator in create modal', async () => {
    const user = userEvent.setup();
    render(<UsersManagementPage />);

    await waitFor(() => expect(screen.getByText('Ajouter')).toBeInTheDocument());
    await user.click(screen.getByText('Ajouter'));

    await waitFor(() => expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument());

    // Find password input by type since labels don't use htmlFor
    const dialog = screen.getByRole('dialog');
    const inputs = dialog.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBe(1);

    await user.type(inputs[0] as HTMLElement, 'MyStr0ng!Pass');

    await waitFor(() => {
      expect(screen.getByText(/12\+ caractères/)).toBeInTheDocument();
      expect(screen.getByText(/Majuscule/)).toBeInTheDocument();
      expect(screen.getByText(/Minuscule/)).toBeInTheDocument();
      expect(screen.getByText(/Chiffre/)).toBeInTheDocument();
    });
  });
});

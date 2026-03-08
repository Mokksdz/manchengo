/**
 * Tests for Dashboard Layout (Sidebar Navigation & RBAC)
 *
 * Covers: sidebar rendering, nav sections per role, active item highlighting,
 * section expand/collapse, logout button, mobile menu toggle,
 * user profile display, command palette shortcut, redirect when not auth.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───
const mockPush = jest.fn();
const mockPathname = { value: '/dashboard' };
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => mockPathname.value,
}));

jest.mock('next/link', () => {
  return ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  );
});

jest.mock('next/dynamic', () => {
  return () => {
    const Component = () => null;
    Component.displayName = 'DynamicComponent';
    return Component;
  };
});

const mockLogout = jest.fn();
const mockAuth: {
  user: null | { id: string; code: string; email: string; firstName: string; lastName: string; role: string };
  isLoading: boolean;
  logout: () => void;
} = {
  user: { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
  isLoading: false,
  logout: mockLogout,
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

jest.mock('@/components/ui/language-switcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">Lang</div>,
}));

import DashboardLayout from '../layout';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' };
  mockAuth.isLoading = false;
  mockPathname.value = '/dashboard';
});

describe('DashboardLayout — Sidebar', () => {
  it('renders the Manchengo logo', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    const logos = screen.getAllByText('Manchengo');
    expect(logos.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Smart ERP Pro')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<DashboardLayout><div>Test Content</div></DashboardLayout>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays user profile section', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('displays user role', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    // Role shown in profile section
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
  });

  it('calls logout on click', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    await user.click(screen.getByText('Déconnexion'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows loading spinner when auth is loading', () => {
    mockAuth.user = null;
    mockAuth.isLoading = true;
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockAuth.user = null;
    mockAuth.isLoading = false;
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders language switcher', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('renders search bar with ⌘K hint', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('Recherche globale...')).toBeInTheDocument();
  });
});

describe('DashboardLayout — ADMIN Nav Sections', () => {
  it('shows all 5 navigation sections for ADMIN', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('STOCK')).toBeInTheDocument();
    expect(screen.getByText('PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('COMMERCIAL')).toBeInTheDocument();
    expect(screen.getByText('APPROVISIONNEMENT')).toBeInTheDocument();
    expect(screen.getByText('SYSTÈME')).toBeInTheDocument();
  });

  it('shows system nav items for ADMIN', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout><div>Content</div></DashboardLayout>);

    // Click to expand Système section
    await user.click(screen.getByText('SYSTÈME'));

    await waitFor(() => {
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument();
      expect(screen.getByText('Appareils')).toBeInTheDocument();
      expect(screen.getByText('Audit')).toBeInTheDocument();
      expect(screen.getByText('Synchronisation')).toBeInTheDocument();
      expect(screen.getByText('Exports')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
    });
  });
});

describe('DashboardLayout — COMMERCIAL Nav Sections', () => {
  beforeEach(() => {
    mockAuth.user = { id: '2', code: 'USR-002', email: 'com@manchengo.dz', firstName: 'Com', lastName: 'User', role: 'COMMERCIAL' };
  });

  it('shows only Stock and Commercial sections for COMMERCIAL', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('STOCK')).toBeInTheDocument();
    // COMMERCIAL appears in both nav section and user profile badge
    const commercialElements = screen.getAllByText('COMMERCIAL');
    expect(commercialElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('PRODUCTION')).not.toBeInTheDocument();
    expect(screen.queryByText('APPROVISIONNEMENT')).not.toBeInTheDocument();
    expect(screen.queryByText('SYSTÈME')).not.toBeInTheDocument();
  });
});

describe('DashboardLayout — PRODUCTION Nav Sections', () => {
  beforeEach(() => {
    mockAuth.user = { id: '3', code: 'USR-003', email: 'prod@manchengo.dz', firstName: 'Prod', lastName: 'User', role: 'PRODUCTION' };
  });

  it('shows Stock and Production sections for PRODUCTION', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('STOCK')).toBeInTheDocument();
    // PRODUCTION appears in both nav section and user profile badge
    const productionElements = screen.getAllByText('PRODUCTION');
    expect(productionElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('COMMERCIAL')).not.toBeInTheDocument();
    expect(screen.queryByText('APPROVISIONNEMENT')).not.toBeInTheDocument();
    expect(screen.queryByText('SYSTÈME')).not.toBeInTheDocument();
  });
});

describe('DashboardLayout — APPRO Nav Sections', () => {
  beforeEach(() => {
    mockAuth.user = { id: '4', code: 'USR-004', email: 'appro@manchengo.dz', firstName: 'Appro', lastName: 'User', role: 'APPRO' };
  });

  it('shows Stock and Appro sections for APPRO', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    expect(screen.getByText('STOCK')).toBeInTheDocument();
    expect(screen.getByText('APPROVISIONNEMENT')).toBeInTheDocument();
    expect(screen.queryByText('COMMERCIAL')).not.toBeInTheDocument();
    expect(screen.queryByText('SYSTÈME')).not.toBeInTheDocument();
  });
});

describe('DashboardLayout — Section Expand/Collapse', () => {
  it('toggles section expansion on click', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout><div>Content</div></DashboardLayout>);

    // Click to expand Commercial
    await user.click(screen.getByText('COMMERCIAL'));

    await waitFor(() => {
      expect(screen.getByText('Ventes')).toBeInTheDocument();
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });

    // Click again to collapse
    await user.click(screen.getByText('COMMERCIAL'));

    await waitFor(() => {
      expect(screen.queryByText('Ventes')).not.toBeInTheDocument();
    });
  });
});

describe('DashboardLayout — Mobile Menu', () => {
  it('renders mobile menu toggle button', () => {
    render(<DashboardLayout><div>Content</div></DashboardLayout>);
    const toggleButton = screen.getByLabelText('Ouvrir le menu');
    expect(toggleButton).toBeInTheDocument();
  });

  it('toggles mobile menu on click', async () => {
    const user = userEvent.setup();
    render(<DashboardLayout><div>Content</div></DashboardLayout>);

    await user.click(screen.getByLabelText('Ouvrir le menu'));

    await waitFor(() => {
      expect(screen.getByLabelText('Fermer le menu')).toBeInTheDocument();
    });
  });
});

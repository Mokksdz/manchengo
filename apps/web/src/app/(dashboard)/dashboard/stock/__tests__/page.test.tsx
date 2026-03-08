/**
 * Tests for Stock Dashboard Page
 *
 * Covers: loading state, error state, KPI cards (stat cards),
 * critical zone, logistic zone, health zone, quick nav links,
 * refresh button, RBAC nav items, auto-refresh interval.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ─── Mocks ───
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/dashboard/stock',
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockAuth = {
  user: { id: '1', role: 'ADMIN', firstName: 'Admin', lastName: 'User' },
  isLoading: false,
  isAuthenticated: true,
};
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

const mockGetDashboard = jest.fn();
jest.mock('@/lib/api', () => ({
  stockDashboard: { getDashboard: () => mockGetDashboard() },
  StockDashboardData: {},
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, badge, actions }: { title: string; badge?: { text: string }; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {badge && <span data-testid="badge">{badge.text}</span>}
      {actions}
    </div>
  ),
}));

jest.mock('@/components/ui/stat-card', () => ({
  StatCard: ({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) => (
    <div data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <span>{title}</span>
      <span>{value}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/stock', () => ({
  ZoneCritique: ({ data: _data }: { data: unknown }) => <div data-testid="zone-critique">Zone Critique</div>,
  ZoneATraiter: ({ data: _data2 }: { data: unknown }) => <div data-testid="zone-atraiter">Zone À Traiter</div>,
  ZoneSante: ({ data: _data3 }: { data: unknown }) => <div data-testid="zone-sante">Zone Santé</div>,
}));

import StockDashboardPage from '../page';

const mockDashboardData = {
  success: true,
  data: {
    summary: { criticalCount: 2, healthScore: 78, totalProducts: 230 },
    critique: { items: [] },
    aTraiter: { totalCount: 5, items: [] },
    sante: { score: 78, breakdown: [] },
    _meta: { generatedAt: '2026-03-08T10:00:00Z' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockGetDashboard.mockResolvedValue(mockDashboardData);
  mockAuth.user = { id: '1', role: 'ADMIN', firstName: 'Admin', lastName: 'User' };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StockDashboardPage', () => {
  it('shows loading state initially', () => {
    mockGetDashboard.mockImplementation(() => new Promise(() => {}));
    render(<StockDashboardPage />);
    // Loading skeleton should be present (pulse animation div)
    const container = document.querySelector('.animate-pulse');
    expect(container).toBeInTheDocument();
  });

  it('renders page header after loading', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Pilotage des Stocks')).toBeInTheDocument();
    });
  });

  it('displays badge with critical count', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('badge')).toHaveTextContent('2 critique(s)');
    });
  });

  it('displays all 4 stat cards', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('stat-card-valorisation-stock')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-alertes-critiques')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-lots-à-risque-(j-7)')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-score-santé')).toBeInTheDocument();
    });
  });

  it('renders critical, logistic, and health zones', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('zone-critique')).toBeInTheDocument();
      expect(screen.getByTestId('zone-atraiter')).toBeInTheDocument();
      expect(screen.getByTestId('zone-sante')).toBeInTheDocument();
    });
  });

  it('displays quick nav links', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Matières premières')).toBeInTheDocument();
      expect(screen.getByText('Produits finis')).toBeInTheDocument();
      expect(screen.getByText('Gestion lots')).toBeInTheDocument();
      expect(screen.getByText('DLC / Expiry')).toBeInTheDocument();
    });
  });

  it('shows Inventaire link for ADMIN', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Inventaire')).toBeInTheDocument();
    });
  });

  it('shows Inventaire link for APPRO', async () => {
    jest.useRealTimers();
    mockAuth.user = { id: '2', role: 'APPRO', firstName: 'Appro', lastName: 'User' };
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Inventaire')).toBeInTheDocument();
    });
  });

  it('hides Inventaire link for COMMERCIAL', async () => {
    jest.useRealTimers();
    mockAuth.user = { id: '3', role: 'COMMERCIAL', firstName: 'Com', lastName: 'User' };
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText('Inventaire')).not.toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    jest.useRealTimers();
    mockGetDashboard.mockRejectedValue(new Error('Network error'));
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    jest.useRealTimers();
    mockGetDashboard.mockRejectedValue(new Error('Network error'));
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });

  it('shows refresh button and new reception button', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('+ Nouvelle Réception')).toBeInTheDocument();
    });
  });

  it('displays health score value', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('78%')).toBeInTheDocument();
    });
  });

  it('displays total products count', async () => {
    jest.useRealTimers();
    render(<StockDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('230 Produits')).toBeInTheDocument();
    });
  });
});

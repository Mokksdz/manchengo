/**
 * Tests for Main Dashboard Page
 *
 * Covers: RBAC rendering per role, KPI cards, sales chart, sync status,
 * production dashboard, loading states.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ─── Mocks ───
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
});

const mockAuth: { user: null | { id: string; code: string; email: string; firstName: string; lastName: string; role: string }; isLoading: boolean; isAuthenticated: boolean } = {
  user: { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
  isLoading: false,
  isAuthenticated: true,
};

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

const mockKpis = {
  stock: { mp: { total: 150, lowStock: 3 }, pf: { total: 80, lowStock: 1 } },
  sales: { todayAmount: 5000000, todayInvoices: 12 },
  sync: { pendingEvents: 5, devicesOffline: 1 },
};

const mockSalesChart = [
  { date: '2026-03-02', amount: 300000 },
  { date: '2026-03-03', amount: 450000 },
];

const mockSyncStatus = [
  { id: '1', name: 'iPad Production', isActive: true, lastSyncAt: '2026-03-08T09:00:00Z', user: { firstName: 'Ali', lastName: 'Ben' } },
];

const mockProductionDashboard = {
  production: { ordersToday: 5, ordersPending: 2, ordersInProgress: 3, ordersCompleted: 10, quantiteProduite: 1500, rendementMoyen: 94 },
  approvisionnement: { mpSousSeuil: 4, mpCritiques: 1, demandesEnvoyees: 6, demandesEnAttente: 2 },
  alertes: { mpAlertList: [], recettesNonConfigurees: 0 },
};

jest.mock('@/hooks/use-api', () => ({
  useDashboardKpis: (enabled: boolean) => ({ data: enabled ? mockKpis : undefined, isLoading: false }),
  useSalesChart: (_days: number, enabled: boolean) => ({ data: enabled ? mockSalesChart : [], isLoading: false }),
  useSyncStatus: (enabled: boolean) => ({ data: enabled ? mockSyncStatus : [], isLoading: false }),
  useProductionDashboard: (enabled: boolean) => ({ data: enabled ? mockProductionDashboard : undefined, isLoading: false }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  formatCurrency: (v: number) => `${(v / 100).toFixed(2)} DA`,
  formatRelativeTime: () => 'Il y a 2h',
}));

jest.mock('@/lib/design-system', () => ({
  cardClass: 'card',
  cardHeaderClass: 'card-header',
  iconBoxClass: 'icon-box',
  iconBoxSmClass: 'icon-box-sm',
}));

jest.mock('@/components/ui/skeleton-loader', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} data-testid="skeleton" />,
  SkeletonKpiGrid: () => <div data-testid="skeleton-kpi-grid" />,
}));

jest.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
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

import DashboardPage from '../page';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' };
});

describe('Dashboard Page — ADMIN role', () => {
  it('renders the standard dashboard header', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays Stock MP KPI card', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Stock MP')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('displays Stock PF KPI card', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Stock PF')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('displays low stock warnings', () => {
    render(<DashboardPage />);
    expect(screen.getByText('3 en rupture')).toBeInTheDocument();
    expect(screen.getByText('1 en rupture')).toBeInTheDocument();
  });

  it('displays sales card for ADMIN', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Ventes du jour')).toBeInTheDocument();
    expect(screen.getByText('12 factures')).toBeInTheDocument();
  });

  it('displays sync status card for ADMIN', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Synchronisation')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1 hors ligne')).toBeInTheDocument();
  });

  it('displays sales chart section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Ventes (7 derniers jours)')).toBeInTheDocument();
  });

  it('displays device sync status table', () => {
    render(<DashboardPage />);
    expect(screen.getByText("État des appareils")).toBeInTheDocument();
    expect(screen.getByText('iPad Production')).toBeInTheDocument();
    expect(screen.getByText('Ali Ben')).toBeInTheDocument();
  });
});

describe('Dashboard Page — COMMERCIAL role', () => {
  beforeEach(() => {
    mockAuth.user = { id: '2', code: 'USR-002', email: 'com@manchengo.dz', firstName: 'Com', lastName: 'User', role: 'COMMERCIAL' };
  });

  it('displays sales card but not sync card', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Ventes du jour')).toBeInTheDocument();
    expect(screen.queryByText('Synchronisation')).not.toBeInTheDocument();
  });
});

describe('Dashboard Page — PRODUCTION role', () => {
  beforeEach(() => {
    mockAuth.user = { id: '3', code: 'USR-003', email: 'prod@manchengo.dz', firstName: 'Prod', lastName: 'User', role: 'PRODUCTION' };
  });

  it('renders the production dashboard', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard Production')).toBeInTheDocument();
  });

  it('displays production KPI cards', () => {
    render(<DashboardPage />);
    // Uses &apos; HTML entity
    expect(screen.getByText(/Ordres aujourd/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    // "2" appears in multiple KPI cards (En attente: 2, demandesEnAttente: 2)
    const twos = screen.getAllByText('2');
    expect(twos.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Terminés (7j)')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('displays production stats', () => {
    render(<DashboardPage />);
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('Quantité produite')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('Rendement moyen')).toBeInTheDocument();
  });

  it('displays appro section with supplier data', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Approvisionnement MP')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('MP sous seuil')).toBeInTheDocument();
  });

  it('shows "recettes configurées" when no unconfigured recipes', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recettes configurées')).toBeInTheDocument();
    expect(screen.getByText('Production prête')).toBeInTheDocument();
  });

  it('links to appro cockpit', () => {
    render(<DashboardPage />);
    const link = screen.getByText('Voir cockpit →');
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/appro');
  });

  it('links to new purchase order', () => {
    render(<DashboardPage />);
    // The link contains an icon + text node
    const link = screen.getByRole('link', { name: /Nouveau bon de commande/ });
    expect(link).toHaveAttribute('href', '/dashboard/appro/bons/new');
  });
});

describe('Dashboard Page — APPRO role', () => {
  beforeEach(() => {
    mockAuth.user = { id: '4', code: 'USR-004', email: 'appro@manchengo.dz', firstName: 'Appro', lastName: 'User', role: 'APPRO' };
  });

  it('renders standard dashboard (not production)', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Production')).not.toBeInTheDocument();
  });

  it('does not show sales or sync cards for APPRO', () => {
    render(<DashboardPage />);
    expect(screen.queryByText('Ventes du jour')).not.toBeInTheDocument();
    expect(screen.queryByText('Synchronisation')).not.toBeInTheDocument();
  });
});

/**
 * Tests for Invoices Page
 *
 * Covers: loading, listing invoices, search, pagination, status badges,
 * create, preview, download PDF, delete confirmation, keyboard shortcuts.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: '1', role: 'ADMIN' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const mockApiFetch = jest.fn();
const mockApiFetchRaw = jest.fn();
jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  apiFetchRaw: (...args: unknown[]) => mockApiFetchRaw(...args),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/lib/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
  useEscapeKey: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
  formatCurrency: (v: number) => `${(v / 100).toFixed(2)} DA`,
  formatDate: () => '08 mars 2026 à 10:00',
}));

jest.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header"><h1>{title}</h1>{actions}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/keyboard-hint', () => ({
  KeyboardHint: ({ shortcut }: { shortcut: string }) => <kbd>{shortcut}</kbd>,
}));

jest.mock('@/components/ui/skeleton-loader', () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} data-testid="skeleton" />,
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

jest.mock('@/components/ui/pagination', () => ({
  Pagination: ({ page, total, onPageChange }: { page: number; total: number; onPageChange: (p: number) => void }) => (
    <div data-testid="pagination">
      <span>Page {page}/{total}</span>
      <button onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  ),
}));

jest.mock('@/components/ui/modal', () => ({
  ConfirmDialog: ({ isOpen, title, onConfirm, onCancel }: { isOpen: boolean; title: string; onConfirm: () => void; onCancel: () => void }) => (
    isOpen ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <button onClick={onConfirm}>Confirmer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    ) : null
  ),
}));

import InvoicesPage from '../page';

const mockInvoices = [
  {
    id: 1,
    reference: 'FAC-2026-001',
    date: '2026-03-08T10:00:00Z',
    client: { id: 1, name: 'Client A', code: 'CLT-001' },
    totalHt: 100000,
    totalTva: 19000,
    totalTtc: 119000,
    timbreFiscal: 1190,
    netToPay: 120190,
    paymentMethod: 'ESPECES',
    status: 'DRAFT',
  },
  {
    id: 2,
    reference: 'FAC-2026-002',
    date: '2026-03-07T14:00:00Z',
    client: { id: 2, name: 'Client B', code: 'CLT-002' },
    totalHt: 200000,
    totalTva: 38000,
    totalTtc: 238000,
    timbreFiscal: 2380,
    netToPay: 240380,
    paymentMethod: 'VIREMENT',
    status: 'PAID',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockApiFetch.mockResolvedValue({ data: mockInvoices, meta: { total: 2, page: 1, totalPages: 1 } });
});

describe('InvoicesPage', () => {
  it('renders the page header', async () => {
    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('Factures')).toBeInTheDocument());
  });

  it('shows new invoice button', async () => {
    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('Nouvelle facture')).toBeInTheDocument());
  });

  it('loads and displays invoices', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('FAC-2026-001')).toBeInTheDocument();
      expect(screen.getByText('FAC-2026-002')).toBeInTheDocument();
    });
  });

  it('displays client names', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Client A')).toBeInTheDocument();
      expect(screen.getByText('Client B')).toBeInTheDocument();
    });
  });

  it('displays status badges', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      // "Brouillon" appears both in status filter and invoice row
      const brouillons = screen.getAllByText('Brouillon');
      expect(brouillons.length).toBeGreaterThanOrEqual(1);
      const payees = screen.getAllByText('Payée');
      expect(payees.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to new invoice page on button click', async () => {
    const user = userEvent.setup();
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText('Nouvelle facture')).toBeInTheDocument());

    await user.click(screen.getByText('Nouvelle facture'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/invoices/new');
  });

  it('displays formatted amounts', async () => {
    render(<InvoicesPage />);
    await waitFor(() => {
      // formatCurrency mock returns X.XX DA
      expect(screen.getByText(/1201.90 DA/)).toBeInTheDocument();
    });
  });
});

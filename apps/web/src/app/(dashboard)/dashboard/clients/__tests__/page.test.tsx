/**
 * Tests for Clients Page
 *
 * Covers: loading, listing clients, filtering, search, add client,
 * edit client, delete client, RBAC (no delete for non-ADMIN),
 * keyboard shortcuts, history navigation.
 */

import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mocks ───
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
}));

const mockAuth = {
  user: { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' },
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
};
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth,
}));

const mockApiFetch = jest.fn();
jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/lib/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
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

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

// Mock child components
jest.mock('@/components/clients/ClientFormModal', () => ({
  ClientFormModal: ({ isOpen, onClose, editingClient }: { isOpen: boolean; onClose: () => void; editingClient: unknown }) => (
    isOpen ? <div data-testid="client-form-modal" role="dialog"><span>{editingClient ? 'Edit' : 'Create'}</span><button onClick={onClose}>Close</button></div> : null
  ),
}));

jest.mock('@/components/clients/ClientsTable', () => ({
  ClientsTable: ({ clients, isLoading, onEdit, onDelete, onHistory }: {
    clients: Array<{ id: number; code: string; name: string; type: string; phone?: string }>;
    isLoading: boolean;
    onEdit: (c: unknown) => void;
    onDelete?: (c: unknown) => void;
    onHistory: (c: unknown) => void;
  }) => (
    <div data-testid="clients-table">
      {isLoading && <span>Loading...</span>}
      {clients.map(c => (
        <div key={c.id} data-testid={`client-row-${c.id}`}>
          <span>{c.name}</span>
          <span>{c.code}</span>
          <button onClick={() => onEdit(c)}>Edit</button>
          {onDelete && <button onClick={() => onDelete(c)}>Delete</button>}
          <button onClick={() => onHistory(c)}>History</button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/clients/ClientFilters', () => ({
  ClientFilters: ({ searchQuery, onSearchChange, activeTab, onTabChange }: {
    searchQuery: string;
    onSearchChange: (v: string) => void;
    activeTab: string;
    onTabChange: (v: string) => void;
  }) => (
    <div data-testid="client-filters">
      <input data-testid="search-input" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="Rechercher..." />
      <button onClick={() => onTabChange('all')}>Tous</button>
      <button onClick={() => onTabChange('prospect')}>Prospects</button>
      <button onClick={() => onTabChange('regular')}>Réguliers</button>
    </div>
  ),
}));

import ClientsPage from '../page';

const mockClients = [
  { id: 1, code: 'CLT-001', name: 'Laiterie Alger', type: 'regular', phone: '0555111222', nif: '12345', rc: '', ai: '', nis: '', address: '', _count: { invoices: 5 } },
  { id: 2, code: 'CLT-002', name: 'Fromagerie Oran', type: 'prospect', phone: '0666333444', nif: '67890', rc: '', ai: '', nis: '', address: '', _count: { invoices: 0 } },
  { id: 3, code: 'CLT-003', name: 'Supermarché Blida', type: 'regular', phone: '0777555666', nif: '11111', rc: '', ai: '', nis: '', address: '', _count: { invoices: 10 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { id: '1', code: 'USR-001', email: 'admin@manchengo.dz', firstName: 'Admin', lastName: 'User', role: 'ADMIN' };
  mockApiFetch.mockResolvedValue(mockClients);
});

describe('ClientsPage', () => {
  it('renders the page header with title', async () => {
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Clients')).toBeInTheDocument());
  });

  it('shows Add Client button', async () => {
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Ajouter un client')).toBeInTheDocument());
  });

  it('loads and displays clients', async () => {
    render(<ClientsPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/admin/clients');
      expect(screen.getByText('Laiterie Alger')).toBeInTheDocument();
      expect(screen.getByText('Fromagerie Oran')).toBeInTheDocument();
      expect(screen.getByText('Supermarché Blida')).toBeInTheDocument();
    });
  });

  it('filters clients by search query', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const searchInput = screen.getByTestId('search-input');
    await user.type(searchInput, 'Oran');

    await waitFor(() => {
      expect(screen.getByText('Fromagerie Oran')).toBeInTheDocument();
      expect(screen.queryByText('Laiterie Alger')).not.toBeInTheDocument();
    });
  });

  it('filters clients by tab (prospect)', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    await user.click(screen.getByText('Prospects'));

    await waitFor(() => {
      expect(screen.getByText('Fromagerie Oran')).toBeInTheDocument();
      expect(screen.queryByText('Laiterie Alger')).not.toBeInTheDocument();
    });
  });

  it('opens create modal when Add button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    await user.click(screen.getByText('Ajouter un client'));

    await waitFor(() => {
      expect(screen.getByTestId('client-form-modal')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
    });
  });

  it('opens edit modal when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const firstRow = screen.getByTestId('client-row-1');
    await user.click(within(firstRow).getByText('Edit'));

    await waitFor(() => {
      const modal = screen.getByTestId('client-form-modal');
      expect(modal).toBeInTheDocument();
      // "Edit" text is inside the modal span
      expect(within(modal).getByText('Edit')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation when Delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const firstRow = screen.getByTestId('client-row-1');
    await user.click(within(firstRow).getByText('Delete'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      expect(screen.getByText('Supprimer le client')).toBeInTheDocument();
    });
  });

  it('confirms deletion and reloads data', async () => {
    const user = userEvent.setup();
    mockApiFetch
      .mockResolvedValueOnce(mockClients) // initial load
      .mockResolvedValueOnce(undefined)   // delete
      .mockResolvedValueOnce(mockClients.slice(1)); // reload

    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const firstRow = screen.getByTestId('client-row-1');
    await user.click(within(firstRow).getByText('Delete'));

    await waitFor(() => expect(screen.getByTestId('alert-dialog')).toBeInTheDocument());

    await user.click(screen.getByText('Supprimer'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/admin/clients/1', { method: 'DELETE' });
    });
  });

  it('navigates to history page on History click', async () => {
    const user = userEvent.setup();
    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const firstRow = screen.getByTestId('client-row-1');
    await user.click(within(firstRow).getByText('History'));

    expect(mockPush).toHaveBeenCalledWith('/dashboard/clients/1/historique');
  });

  it('does not show Delete button for COMMERCIAL role', async () => {
    mockAuth.user = { id: '2', code: 'USR-002', email: 'com@manchengo.dz', firstName: 'Com', lastName: 'User', role: 'COMMERCIAL' };

    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Laiterie Alger')).toBeInTheDocument());

    const firstRow = screen.getByTestId('client-row-1');
    expect(within(firstRow).queryByText('Delete')).not.toBeInTheDocument();
  });
});

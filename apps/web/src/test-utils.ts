/**
 * Shared test helpers and mock factories for Manchengo Smart ERP tests.
 */

import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// ─── Mock User Factory ───
export type MockRole = 'ADMIN' | 'APPRO' | 'PRODUCTION' | 'COMMERCIAL';

export function createMockUser(overrides: Partial<{
  id: string;
  code: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MockRole;
}> = {}) {
  return {
    id: '1',
    code: 'USR-001',
    email: 'admin@manchengo.dz',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN' as MockRole,
    ...overrides,
  };
}

// ─── Mock Auth Context ───
export function createMockAuth(overrides: Partial<{
  user: ReturnType<typeof createMockUser> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: jest.Mock;
  logout: jest.Mock;
}> = {}) {
  const user = overrides.user !== undefined ? overrides.user : createMockUser();
  return {
    user,
    isLoading: false,
    isAuthenticated: !!user,
    login: jest.fn(),
    logout: jest.fn(),
    ...overrides,
  };
}

// ─── Mock Router ───
export function createMockRouter() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };
}

// ─── Common Mock Setup Helpers ───

/** Setup standard mocks for next/navigation */
export function setupNavigationMocks(router = createMockRouter(), pathname = '/dashboard') {
  jest.mock('next/navigation', () => ({
    useRouter: () => router,
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(),
  }));
  return router;
}

// ─── Mock Data Factories ───

export function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'CLT-001',
    name: 'Client Test',
    type: 'prospect',
    nif: '123456789',
    rc: 'RC-001',
    ai: 'AI-001',
    nis: 'NIS-001',
    phone: '0555123456',
    address: '123 Rue Test, Alger',
    _count: { invoices: 3 },
    ...overrides,
  };
}

export function createMockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    reference: 'FAC-2026-001',
    date: '2026-03-08T10:00:00Z',
    client: { id: 1, name: 'Client Test', code: 'CLT-001', nif: '123456' },
    totalHt: 100000,
    totalTva: 19000,
    totalTtc: 119000,
    timbreFiscal: 1190,
    netToPay: 120190,
    paymentMethod: 'ESPECES',
    status: 'DRAFT',
    lines: [],
    ...overrides,
  };
}

export function createMockUserData(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    code: 'USR-001',
    email: 'user@manchengo.dz',
    firstName: 'Test',
    lastName: 'User',
    role: 'COMMERCIAL',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    _count: { devices: 2 },
    ...overrides,
  };
}

export function createMockDashboardKpis(overrides: Record<string, unknown> = {}) {
  return {
    stock: {
      mp: { total: 150, lowStock: 3 },
      pf: { total: 80, lowStock: 1 },
    },
    sales: {
      todayAmount: 5000000,
      todayInvoices: 12,
    },
    sync: {
      pendingEvents: 5,
      devicesOffline: 1,
    },
    ...overrides,
  };
}

export function createMockProductionDashboard() {
  return {
    production: {
      ordersToday: 5,
      ordersPending: 2,
      ordersInProgress: 3,
      ordersCompleted: 10,
      quantiteProduite: 1500,
      rendementMoyen: 94,
    },
    approvisionnement: {
      mpSousSeuil: 4,
      mpCritiques: 1,
      demandesEnvoyees: 6,
      demandesEnAttente: 2,
    },
    alertes: {
      mpAlertList: [
        { code: 'MP-001', name: 'Lait', stock: 50, minStock: 200, status: 'RUPTURE' },
        { code: 'MP-002', name: 'Présure', stock: 100, minStock: 150, status: 'SOUS_SEUIL' },
      ],
      recettesNonConfigurees: 1,
    },
  };
}

export function createMockSalesChart() {
  return [
    { date: '2026-03-02', amount: 300000 },
    { date: '2026-03-03', amount: 450000 },
    { date: '2026-03-04', amount: 200000 },
    { date: '2026-03-05', amount: 600000 },
    { date: '2026-03-06', amount: 350000 },
    { date: '2026-03-07', amount: 500000 },
    { date: '2026-03-08', amount: 400000 },
  ];
}

export function createMockSyncStatus() {
  return [
    { id: '1', name: 'iPad Production', isActive: true, lastSyncAt: '2026-03-08T09:00:00Z', user: { firstName: 'Ali', lastName: 'Ben' } },
    { id: '2', name: 'Tablette Stock', isActive: false, lastSyncAt: null, user: { firstName: 'Sara', lastName: 'Kaci' } },
  ];
}

export function createMockStockDashboard() {
  return {
    success: true,
    data: {
      summary: {
        criticalCount: 2,
        healthScore: 78,
        totalProducts: 230,
      },
      critique: {
        items: [
          { id: 1, code: 'MP-001', name: 'Lait', stock: 10, minStock: 100, severity: 'critical' },
        ],
      },
      aTraiter: {
        totalCount: 5,
        items: [],
      },
      sante: {
        score: 78,
        breakdown: [],
      },
      _meta: {
        generatedAt: '2026-03-08T10:00:00Z',
      },
    },
  };
}

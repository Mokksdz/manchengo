/**
 * Tests for PageHeader component
 *
 * Covers: title, subtitle, icon, badge variants, actions slot,
 * breadcrumb, notifications bell, notification count.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../page-header';

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}));

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the orange dot after title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('.')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Vue d'ensemble" />);
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<PageHeader title="Test" />);
    const subtitleP = container.querySelector('p.text-\\[15px\\]');
    expect(subtitleP).toBeNull();
  });

  it('renders icon when provided', () => {
    render(<PageHeader title="Test" icon={<span data-testid="icon">Icon</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(
      <PageHeader
        title="Test"
        actions={<button>Add New</button>}
      />
    );
    expect(screen.getByText('Add New')).toBeInTheDocument();
  });

  it('renders badge with text', () => {
    render(<PageHeader title="Test" badge={{ text: '3 critiques', variant: 'error' }} />);
    expect(screen.getByText('3 critiques')).toBeInTheDocument();
  });

  it('renders success badge with ping animation', () => {
    const { container } = render(
      <PageHeader title="Test" badge={{ text: 'Live System', variant: 'success' }} />
    );
    expect(screen.getByText('Live System')).toBeInTheDocument();
    // Ping animation element
    const pingElement = container.querySelector('.animate-ping');
    expect(pingElement).toBeInTheDocument();
  });

  it('does not render ping for non-success badges', () => {
    const { container } = render(
      <PageHeader title="Test" badge={{ text: 'Warning', variant: 'warning' }} />
    );
    const pingElement = container.querySelector('.animate-ping');
    expect(pingElement).toBeNull();
  });

  it('renders notification bell when showNotifications is true', () => {
    render(<PageHeader title="Test" showNotifications />);
    // Bell button should exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows notification dot when count > 0', () => {
    const { container } = render(
      <PageHeader title="Test" showNotifications notificationCount={5} />
    );
    const dot = container.querySelector('.bg-\\[\\#C62828\\]');
    expect(dot).toBeInTheDocument();
  });

  it('does not show notification dot when count is 0', () => {
    const { container } = render(
      <PageHeader title="Test" showNotifications notificationCount={0} />
    );
    const dot = container.querySelector('.bg-\\[\\#C62828\\]');
    expect(dot).toBeNull();
  });

  it('renders breadcrumb navigation', () => {
    render(
      <PageHeader
        title="Details"
        breadcrumb={[
          { label: 'Stock', href: '/dashboard/stock' },
          { label: 'MP', href: '/dashboard/stock/mp' },
          { label: 'Details' },
        ]}
      />
    );
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('MP')).toBeInTheDocument();
    // "Details" appears in both breadcrumb and title
    const detailsElements = screen.getAllByText('Details');
    expect(detailsElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders breadcrumb links as anchors', () => {
    render(
      <PageHeader
        title="Details"
        breadcrumb={[
          { label: 'Stock', href: '/dashboard/stock' },
          { label: 'Current' },
        ]}
      />
    );
    const link = screen.getByText('Stock');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/dashboard/stock');
  });

  it('renders last breadcrumb item as plain text', () => {
    render(
      <PageHeader
        title="Details"
        breadcrumb={[
          { label: 'Stock', href: '/dashboard/stock' },
          { label: 'Current' },
        ]}
      />
    );
    const current = screen.getByText('Current');
    expect(current.tagName).toBe('SPAN');
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageHeader title="Test" className="custom-class" />
    );
    expect(container.firstElementChild?.className).toContain('custom-class');
  });

  it('renders all badge variants correctly', () => {
    const variants = ['default', 'success', 'warning', 'error', 'info'] as const;

    for (const variant of variants) {
      const { unmount } = render(
        <PageHeader title="Test" badge={{ text: variant, variant }} />
      );
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });
});

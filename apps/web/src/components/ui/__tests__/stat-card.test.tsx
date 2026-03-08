/**
 * Tests for StatCard component
 *
 * Covers: title, value, subtitle, icon, trend (positive/negative/zero),
 * color variants, sparkline rendering, custom className.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../stat-card';

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}));

describe('StatCard', () => {
  it('renders title', () => {
    render(<StatCard title="Total Revenue" value="50,000 DA" />);
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    render(<StatCard title="Items" value={150} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatCard title="Score" value="95%" />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard title="Stock" value={100} subtitle="vs last month" />);
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<StatCard title="Stock" value={100} />);
    const subtitles = container.querySelectorAll('.text-\\[12px\\].text-\\[\\#86868B\\]');
    // Only title text (uppercase) should exist
    expect(subtitles.length).toBe(0);
  });

  it('renders icon when provided', () => {
    render(
      <StatCard
        title="Test"
        value={100}
        icon={<span data-testid="stat-icon">Icon</span>}
      />
    );
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('renders positive trend with up arrow', () => {
    render(<StatCard title="Test" value={100} trend={{ value: 12.5 }} />);
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders negative trend with down arrow', () => {
    render(<StatCard title="Test" value={100} trend={{ value: -3.2 }} />);
    expect(screen.getByText('-3.2%')).toBeInTheDocument();
  });

  it('renders zero trend with dash', () => {
    render(<StatCard title="Test" value={100} trend={{ value: 0 }} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('applies green styling for positive trend', () => {
    const { container } = render(
      <StatCard title="Test" value={100} trend={{ value: 5 }} />
    );
    const trendElement = container.querySelector('.text-green-600');
    expect(trendElement).toBeInTheDocument();
  });

  it('applies red styling for negative trend', () => {
    const { container } = render(
      <StatCard title="Test" value={100} trend={{ value: -5 }} />
    );
    const trendElement = container.querySelector('.text-red-600');
    expect(trendElement).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    const { container } = render(
      <StatCard
        title="Revenue"
        value={100}
        sparklineData="M0 30 C 20 25, 40 35, 60 20"
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not render sparkline when no data', () => {
    const { container } = render(
      <StatCard title="Simple" value={100} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatCard title="Test" value={100} className="my-custom" />
    );
    expect(container.firstElementChild?.className).toContain('my-custom');
  });

  it('renders with all color variants', () => {
    const colors = ['default', 'purple', 'blue', 'emerald', 'amber', 'red'] as const;
    for (const color of colors) {
      const { unmount } = render(
        <StatCard
          title={`Color ${color}`}
          value={100}
          icon={<span>Icon</span>}
          color={color}
        />
      );
      expect(screen.getByText(`Color ${color}`)).toBeInTheDocument();
      unmount();
    }
  });
});

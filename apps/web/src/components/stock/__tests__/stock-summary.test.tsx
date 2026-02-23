/**
 * Unit tests for StockSummaryCard component.
 *
 * Verifies rendering with various prop combinations.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StockSummaryCard } from '../StockSummaryCard';

// Mock cn utility used by Card/CardContent
jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

// Minimal icon stand-in
const FakeIcon = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg data-testid="icon" {...props} />
);

describe('StockSummaryCard', () => {
  it('renders title and numeric value', () => {
    render(
      <StockSummaryCard title="Ruptures" value={12} icon={FakeIcon} color="red" />,
    );
    expect(screen.getByText('Ruptures')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(
      <StockSummaryCard title="Couverture" value="3j" icon={FakeIcon} color="green" />,
    );
    expect(screen.getByText('3j')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <StockSummaryCard
        title="Stock"
        value={50}
        subtitle="derniere maj il y a 2h"
        icon={FakeIcon}
        color="blue"
      />,
    );
    expect(screen.getByText('derniere maj il y a 2h')).toBeInTheDocument();
  });

  it('renders trend indicator when trend and trendValue are set', () => {
    render(
      <StockSummaryCard
        title="Alertes"
        value={7}
        trend="up"
        trendValue="+15%"
        icon={FakeIcon}
        color="orange"
      />,
    );
    expect(screen.getByText('+15%')).toBeInTheDocument();
  });

  it('renders the icon element', () => {
    render(
      <StockSummaryCard title="Total" value={0} icon={FakeIcon} color="gray" />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not crash without optional props', () => {
    const { container } = render(
      <StockSummaryCard title="Minimal" value={1} icon={FakeIcon} color="amber" />,
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});

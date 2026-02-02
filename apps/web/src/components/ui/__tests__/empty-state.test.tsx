/**
 * Unit tests for src/components/ui/empty-state.tsx
 *
 * Tests the EmptyState component: title, subtitle, icon, and action rendering.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../empty-state';

// Mock @/lib/utils since it uses tailwind-merge
jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('EmptyState', () => {
  it('renders the title text', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">Icon</span>}
        title="No items found"
      />,
    );

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <EmptyState
        icon={<span>Icon</span>}
        title="No items found"
        subtitle="Try adjusting your search"
      />,
    );

    expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
  });

  it('does not render subtitle element when subtitle is not provided', () => {
    const { container } = render(
      <EmptyState
        icon={<span>Icon</span>}
        title="No items found"
      />,
    );

    // The subtitle paragraph should not be present
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1); // Only the title paragraph
  });

  it('renders the icon', () => {
    render(
      <EmptyState
        icon={<span data-testid="custom-icon">MyIcon</span>}
        title="Empty"
      />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders the action button when provided', () => {
    render(
      <EmptyState
        icon={<span>Icon</span>}
        title="No results"
        action={<button>Create new</button>}
      />,
    );

    expect(screen.getByText('Create new')).toBeInTheDocument();
  });

  it('does not render action container when action is not provided', () => {
    const { container } = render(
      <EmptyState
        icon={<span>Icon</span>}
        title="No results"
      />,
    );

    // Only the icon container and title paragraph should exist as direct children
    const actionDiv = container.querySelector('.mt-4');
    expect(actionDiv).toBeNull();
  });

  it('passes className to the root element', () => {
    const { container } = render(
      <EmptyState
        icon={<span>Icon</span>}
        title="Empty"
        className="custom-class"
      />,
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain('custom-class');
  });
});

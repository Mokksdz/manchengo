/**
 * Unit tests for src/components/ui/modal.tsx
 *
 * Tests the Modal component: open/close rendering, escape key,
 * title display, and ARIA attributes.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../modal';

// Mock dependencies
jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => React.createRef(),
  useEscapeKey: (handler: () => void, active: boolean) => {
    React.useEffect(() => {
      if (!active) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handler();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }, [handler, active]);
  },
}));

jest.mock('lucide-react', () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
}));

describe('Modal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when open is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render anything when open is false', () => {
    const { container } = render(<Modal {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the title', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('renders the title text in the dialog', () => {
    render(<Modal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Test Modal');
  });

  it('renders the subtitle when provided', () => {
    render(<Modal {...defaultProps} subtitle="A helpful subtitle" />);
    expect(screen.getByText('A helpful subtitle')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<Modal {...defaultProps} />);
    // Only the title should exist in the header text area
    expect(screen.queryByText('A helpful subtitle')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when modal is closed', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} open={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders a close button by default', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  it('hides close button when hideClose is true', () => {
    render(<Modal {...defaultProps} hideClose />);
    expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <Modal {...defaultProps} footer={<button>Save</button>} />,
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(<Modal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby set on the dialog', () => {
    render(<Modal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
});

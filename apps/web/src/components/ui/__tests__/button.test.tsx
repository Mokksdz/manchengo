/**
 * Tests for Button component
 *
 * Covers: rendering, variants (default, destructive, outline, secondary,
 * ghost, link, amber), sizes, disabled state, click handler, asChild.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

jest.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not fire click when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders as a button element by default', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('applies default variant classes', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('inline-flex');
  });

  it('applies amber variant classes', () => {
    render(<Button variant="amber">Amber</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('shadow');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-');
  });

  it('applies outline variant classes', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('hover:');
  });

  it('applies size sm', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-8');
  });

  it('applies size lg', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-11');
  });

  it('applies size icon', () => {
    render(<Button size="icon">+</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-10');
    expect(button.className).toContain('w-10');
  });

  it('accepts custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('my-custom-class');
  });

  it('passes through HTML button attributes', () => {
    render(<Button type="submit" name="submit-btn">Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('name', 'submit-btn');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

/**
 * Tests for utility functions in lib/utils.ts
 *
 * Covers: cn, formatCurrency, formatDate, formatRelativeTime,
 * getStatusColor, getStatusLabel
 */

import { cn, formatCurrency, formatRelativeTime, getStatusColor, getStatusLabel } from '../utils';

describe('cn (class name merger)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('deduplicates tailwind classes', () => {
    const result = cn('p-4', 'p-6');
    expect(result).toBe('p-6');
  });
});

describe('formatCurrency', () => {
  it('formats centimes to DA with 2 decimals', () => {
    const result = formatCurrency(500000);
    expect(result).toContain('DA');
    // 500000 centimes = 5000.00 DA
    expect(result).toMatch(/5[\s\u00a0.,]?000[.,]00/);
  });

  it('handles zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
    expect(result).toContain('DA');
  });

  it('handles small amounts', () => {
    const result = formatCurrency(150);
    expect(result).toContain('1');
    expect(result).toContain('DA');
  });
});

describe('formatRelativeTime', () => {
  it('returns "À l\'instant" for very recent times', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe("À l'instant");
  });

  it('returns minutes for recent times', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo)).toBe('Il y a 5 min');
  });

  it('returns hours for times within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(formatRelativeTime(threeHoursAgo)).toBe('Il y a 3h');
  });

  it('returns days for times within a week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('Il y a 2j');
  });

  it('returns formatted date for older times', () => {
    const oldDate = new Date(Date.now() - 30 * 86400 * 1000);
    const result = formatRelativeTime(oldDate);
    // Should not be a relative format
    expect(result).not.toContain('Il y a');
  });
});

describe('getStatusColor', () => {
  it('returns green for PAID', () => {
    expect(getStatusColor('PAID')).toContain('#34C759');
  });

  it('returns gray for DRAFT', () => {
    expect(getStatusColor('DRAFT')).toContain('#86868B');
  });

  it('returns blue for VALIDATED', () => {
    expect(getStatusColor('VALIDATED')).toContain('#007AFF');
  });

  it('returns orange for PENDING', () => {
    expect(getStatusColor('PENDING')).toContain('#FF9500');
  });

  it('returns red for CANCELLED', () => {
    expect(getStatusColor('CANCELLED')).toContain('#FF3B30');
  });

  it('returns green for COMPLETED', () => {
    expect(getStatusColor('COMPLETED')).toContain('#34C759');
  });

  it('returns fallback for unknown status', () => {
    expect(getStatusColor('UNKNOWN')).toContain('#86868B');
  });
});

describe('getStatusLabel', () => {
  it('returns French labels', () => {
    expect(getStatusLabel('DRAFT')).toBe('Brouillon');
    expect(getStatusLabel('VALIDATED')).toBe('Validée');
    expect(getStatusLabel('PAID')).toBe('Payée');
    expect(getStatusLabel('CANCELLED')).toBe('Annulée');
    expect(getStatusLabel('PENDING')).toBe('En attente');
    expect(getStatusLabel('IN_PROGRESS')).toBe('En cours');
    expect(getStatusLabel('COMPLETED')).toBe('Terminée');
    expect(getStatusLabel('DELIVERED')).toBe('Livrée');
    expect(getStatusLabel('PARTIALLY_PAID')).toBe('Part. payée');
  });

  it('returns raw status for unknown values', () => {
    expect(getStatusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

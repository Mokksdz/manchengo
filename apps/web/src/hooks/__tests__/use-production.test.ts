/**
 * Unit tests for productionKeys from use-production.ts
 *
 * Validates base key, derived keys, and parameterised key builders.
 */

import { productionKeys } from '../use-production';

describe('productionKeys', () => {
  // -----------------------------------------------------------------------
  // Base key
  // -----------------------------------------------------------------------
  it('has a base "all" key equal to ["production"]', () => {
    expect(productionKeys.all).toEqual(['production']);
  });

  // -----------------------------------------------------------------------
  // Derived keys (no params)
  // -----------------------------------------------------------------------
  it('orders() extends the base key', () => {
    expect(productionKeys.orders()).toEqual(['production', 'orders']);
  });

  it('products() extends the base key', () => {
    expect(productionKeys.products()).toEqual(['production', 'products']);
  });

  it('kpis() extends the base key', () => {
    expect(productionKeys.kpis()).toEqual(['production', 'kpis']);
  });

  it('alerts() extends the base key', () => {
    expect(productionKeys.alerts()).toEqual(['production', 'alerts']);
  });

  it('stockPf() extends the base key', () => {
    expect(productionKeys.stockPf()).toEqual(['production', 'stock-pf']);
  });

  it('calendar() extends the base key', () => {
    expect(productionKeys.calendar()).toEqual(['production', 'calendar']);
  });

  // -----------------------------------------------------------------------
  // Parameterised keys
  // -----------------------------------------------------------------------
  it('order(id) appends the id to orders key', () => {
    expect(productionKeys.order(42)).toEqual(['production', 'orders', 42]);
  });

  it('order() produces different keys for different ids', () => {
    expect(productionKeys.order(1)).not.toEqual(productionKeys.order(2));
  });

  it('weeklyPlan(startDate) appends the date', () => {
    expect(productionKeys.weeklyPlan('2026-02-17')).toEqual([
      'production',
      'weekly-plan',
      '2026-02-17',
    ]);
  });

  it('analytics(period) appends the period', () => {
    expect(productionKeys.analytics('month')).toEqual([
      'production',
      'analytics',
      'month',
    ]);
  });

  // -----------------------------------------------------------------------
  // Stability — same input, same output
  // -----------------------------------------------------------------------
  it('returns stable references for identical calls', () => {
    const a = productionKeys.order(10);
    const b = productionKeys.order(10);
    expect(a).toEqual(b);
  });
});

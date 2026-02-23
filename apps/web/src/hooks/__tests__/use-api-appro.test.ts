/**
 * Unit tests for appro-related queryKeys from use-api.ts
 *
 * Validates key stability, parameterisation, and static key shapes.
 */

import { queryKeys } from '../use-api';

describe('queryKeys – appro', () => {
  // -----------------------------------------------------------------------
  // approStockMp (parameterised)
  // -----------------------------------------------------------------------
  describe('approStockMp', () => {
    it('returns a stable key when called with the same params', () => {
      const a = queryKeys.approStockMp({ state: 'active', criticite: 'high' });
      const b = queryKeys.approStockMp({ state: 'active', criticite: 'high' });
      expect(a).toEqual(b);
    });

    it('produces different keys for different params', () => {
      const a = queryKeys.approStockMp({ state: 'active' });
      const b = queryKeys.approStockMp({ state: 'archived' });
      expect(a).not.toEqual(b);
    });

    it('starts with the appro prefix', () => {
      const key = queryKeys.approStockMp();
      expect(key[0]).toBe('appro');
      expect(key[1]).toBe('stock-mp');
    });
  });

  // -----------------------------------------------------------------------
  // approPurchaseOrders (parameterised)
  // -----------------------------------------------------------------------
  describe('approPurchaseOrders', () => {
    it('returns a stable key for identical params', () => {
      const a = queryKeys.approPurchaseOrders({ status: 'DRAFT' });
      const b = queryKeys.approPurchaseOrders({ status: 'DRAFT' });
      expect(a).toEqual(b);
    });

    it('varies by status param', () => {
      const draft = queryKeys.approPurchaseOrders({ status: 'DRAFT' });
      const sent = queryKeys.approPurchaseOrders({ status: 'SENT' });
      expect(draft).not.toEqual(sent);
    });
  });

  // -----------------------------------------------------------------------
  // Static keys
  // -----------------------------------------------------------------------
  describe('static appro keys', () => {
    it('approDashboard is a readonly tuple', () => {
      expect(queryKeys.approDashboard).toEqual(['appro', 'dashboard']);
    });

    it('approCriticalMp is a readonly tuple', () => {
      expect(queryKeys.approCriticalMp).toEqual(['appro', 'critical-mp']);
    });

    it('approAlertCounts is a readonly tuple', () => {
      expect(queryKeys.approAlertCounts).toEqual(['appro', 'alert-counts']);
    });

    it('approSuggestions is a readonly tuple', () => {
      expect(queryKeys.approSuggestions).toEqual(['appro', 'suggestions']);
    });
  });
});

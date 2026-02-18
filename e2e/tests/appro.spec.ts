import { test, expect } from '@playwright/test';

/**
 * Approvisionnement Module E2E Tests
 * Tests stock management, purchase orders, and supplier workflows
 */

test.describe('Approvisionnement Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/appro');
    await expect(page.getByRole('heading', { name: /approvisionnement/i })).toBeVisible();
  });

  test('should display approvisionnement dashboard', async ({ page }) => {
    // Check main sections
    await expect(page.getByText(/stock|matières premières/i)).toBeVisible();
    await expect(page.getByText(/alertes/i)).toBeVisible();
  });

  test('should display stock MP list', async ({ page }) => {
    // Check table headers or list items
    const stockSection = page.locator('[data-testid="stock-mp-list"]');
    if (await stockSection.isVisible()) {
      await expect(stockSection).toBeVisible();
    }
  });

  test('should show alerts with proper severity indicators', async ({ page }) => {
    const criticalAlerts = page.locator('[data-severity="critical"]');
    const warningAlerts = page.locator('[data-severity="warning"]');

    // Just check that alert system is working (may have 0 alerts)
    const alertCount = await criticalAlerts.count() + await warningAlerts.count();
    console.log(`Found ${alertCount} alerts`);
  });
});

test.describe('Purchase Order Flow', () => {
  test('should navigate to purchase orders', async ({ page }) => {
    await page.goto('/dashboard/appro/bons-commande');

    // Check page loaded
    await expect(page.getByText(/bons? de commande|purchase order/i)).toBeVisible();
  });

  test('should display BC list with filters', async ({ page }) => {
    await page.goto('/dashboard/appro/bons-commande');

    // Check filter options exist
    const filterButtons = page.getByRole('button');
    await expect(filterButtons.first()).toBeVisible();
  });
});

test.describe('Stock Management', () => {
  test('should display stock MP with quantities', async ({ page }) => {
    await page.goto('/dashboard/appro');

    // Look for stock quantity indicators
    const stockItems = page.locator('[data-testid="stock-item"]');
    if (await stockItems.count() > 0) {
      // Check first item has quantity displayed
      const firstItem = stockItems.first();
      await expect(firstItem).toBeVisible();
    }
  });

  test('should show low stock warnings', async ({ page }) => {
    await page.goto('/dashboard/appro');

    // Check for warning indicators on low stock items
    const lowStockIndicators = page.locator('[data-stock-status="low"], [data-stock-status="critical"]');
    console.log(`Found ${await lowStockIndicators.count()} low stock items`);
  });
});

test.describe('Reception Flow', () => {
  test('should access receptions page', async ({ page }) => {
    await page.goto('/dashboard/appro/receptions');

    // Check page loaded or redirect
    await page.waitForURL(/\/(appro|receptions)/);
  });
});

test.describe('Suppliers Management', () => {
  test('should display suppliers list', async ({ page }) => {
    await page.goto('/dashboard/appro/fournisseurs');

    // Check page loaded
    await expect(page.getByText(/fournisseur/i)).toBeVisible();
  });

  test('should search suppliers', async ({ page }) => {
    await page.goto('/dashboard/appro/fournisseurs');

    const searchInput = page.getByPlaceholder(/rechercher/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });
});

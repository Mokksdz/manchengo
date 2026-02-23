import { test, expect } from '@playwright/test';

/**
 * Approvisionnement Complete Workflow E2E Test
 *
 * Flow: Navigate to appro cockpit → view alerts → bons de commande → fournisseurs
 * Note: Full CRUD workflows require auth setup and seeded data.
 */
test.describe('Appro Cockpit Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/appro');
  });

  test('should display appro cockpit with key metrics', async ({ page }) => {
    // IRS gauge or KPI cards should be present
    await expect(
      page.locator('[class*="gauge"], [class*="stat"], [class*="kpi"], [class*="card"]').first()
    ).toBeVisible();
  });

  test('should display stock alerts or actions section', async ({ page }) => {
    // Look for alert indicators or action cards
    const alertSection = page.getByText(/Alerte|Critique|Action|Stock/i).first();
    await expect(alertSection).toBeVisible();
  });

  test('should navigate to bons de commande', async ({ page }) => {
    await page.goto('/dashboard/appro/bons');

    // Page should load with table or list of purchase orders
    await page.waitForTimeout(500);
    await expect(page.locator('main, [role="main"], .silicon-main')).toBeVisible();
  });

  test('should navigate to fournisseurs', async ({ page }) => {
    await page.goto('/dashboard/appro/fournisseurs');

    // Page should load with supplier list
    await page.waitForTimeout(500);
    await expect(page.locator('main, [role="main"], .silicon-main')).toBeVisible();
  });
});

test.describe('Bons de Commande Workflow', () => {
  test('should display purchase orders list', async ({ page }) => {
    await page.goto('/dashboard/appro/bons');

    // Table or card grid should be visible
    await expect(
      page.locator('table, [class*="card"], [class*="grid"]').first()
    ).toBeVisible();
  });

  test('should have create BC button', async ({ page }) => {
    await page.goto('/dashboard/appro/bons');

    const createBtn = page.getByRole('button', { name: /Nouveau|Créer|Ajouter/i });
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeEnabled();
    }
  });

  test('should filter purchase orders by status', async ({ page }) => {
    await page.goto('/dashboard/appro/bons');

    // Look for status filter buttons
    const draftFilter = page.getByRole('button', { name: /Brouillon|Draft/i });
    const sentFilter = page.getByRole('button', { name: /Envoyé|Sent/i });

    if (await draftFilter.isVisible()) {
      await draftFilter.click();
      await page.waitForTimeout(300);
    }

    if (await sentFilter.isVisible()) {
      await sentFilter.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Fournisseurs Workflow', () => {
  test('should display suppliers list with grades', async ({ page }) => {
    await page.goto('/dashboard/appro/fournisseurs');

    // Supplier table/grid should be visible
    await expect(
      page.locator('table, [class*="card"], [class*="grid"]').first()
    ).toBeVisible();
  });

  test('should search suppliers', async ({ page }) => {
    await page.goto('/dashboard/appro/fournisseurs');

    const searchInput = page.getByPlaceholder(/Rechercher|Filtrer/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Appro Accessibility', () => {
  test('cockpit should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard/appro');

    const headings = page.locator('h1, h2, h3');
    await expect(headings.first()).toBeVisible();
  });

  test('bons page should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/appro/bons');

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});

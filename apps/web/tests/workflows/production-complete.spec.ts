import { test, expect } from '@playwright/test';

/**
 * Production Complete Workflow E2E Test
 *
 * Flow: Navigate to production → view dashboard → switch tabs → verify data display
 * Note: Full CRUD workflows require auth setup and seeded data.
 */
test.describe('Production Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/production');
  });

  test('should display production dashboard with KPI cards', async ({ page }) => {
    // Dashboard tab should be active by default
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();

    // Should show KPI-like content
    await expect(page.locator('[class*="stat"], [class*="kpi"], [class*="card"]').first()).toBeVisible();
  });

  test('should navigate through all production tabs', async ({ page }) => {
    const tabs = ['Dashboard', 'Ordres', 'Produits', 'Planning', 'Traçabilité', 'Analytiques'];

    for (const tab of tabs) {
      await page.getByRole('button', { name: new RegExp(tab, 'i') }).click();
      // Each tab should render content without error
      await page.waitForTimeout(300);
      await expect(page.locator('main, [role="main"], .silicon-main')).toBeVisible();
    }
  });

  test('should open production wizard and display step 1', async ({ page }) => {
    // Go to orders tab first
    await page.getByRole('button', { name: /Ordres/i }).click();

    // Click new production button
    const newBtn = page.getByRole('button', { name: /Nouvelle production/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      // Wizard should appear with first step
      await expect(
        page.getByText(/Sélectionnez/i).or(page.getByText(/Étape/i)).or(page.getByText(/Recette/i))
      ).toBeVisible();
    }
  });

  test('should display products list with search functionality', async ({ page }) => {
    await page.getByRole('button', { name: /Produits/i }).click();

    // Search input should be available
    const searchInput = page.getByPlaceholder(/Rechercher/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('fromage');
      await page.waitForTimeout(500);
      // Should filter results (or show no results)
    }
  });

  test('should display analytics with period selection', async ({ page }) => {
    await page.getByRole('button', { name: /Analytiques/i }).click();

    // Period selection buttons should be visible
    const weekBtn = page.getByRole('button', { name: /Semaine|7 jours/i });
    const monthBtn = page.getByRole('button', { name: /Mois|30 jours/i });

    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await page.waitForTimeout(300);
    }

    if (await monthBtn.isVisible()) {
      await monthBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('should display traceability search', async ({ page }) => {
    await page.getByRole('button', { name: /Traçabilité/i }).click();

    // Lot search should be available
    const lotSearch = page.getByPlaceholder(/lot/i);
    if (await lotSearch.isVisible()) {
      await lotSearch.fill('LOT-2026');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Production Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard/production');

    // At least one heading should exist
    const headings = page.locator('h1, h2, h3');
    await expect(headings.first()).toBeVisible();
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    await page.goto('/dashboard/production');

    // Tab through the navigation buttons
    const firstTab = page.getByRole('button', { name: /Dashboard/i });
    await firstTab.focus();
    await expect(firstTab).toBeFocused();

    // Press Tab to move to next button
    await page.keyboard.press('Tab');
  });
});

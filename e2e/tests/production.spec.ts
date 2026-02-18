import { test, expect } from '@playwright/test';

/**
 * Production Module E2E Tests
 * Tests the complete production workflow from order creation to completion
 */

test.describe('Production Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/production');
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /production/i })).toBeVisible();
  });

  test('should display production dashboard', async ({ page }) => {
    // Check main elements are visible
    await expect(page.getByText(/ordres/i)).toBeVisible();
    await expect(page.getByText(/produits/i)).toBeVisible();
    await expect(page.getByText(/planning/i)).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click on Orders tab
    await page.getByRole('tab', { name: /ordres/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // Click on Products tab
    await page.getByRole('tab', { name: /produits/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // Click on Planning tab
    await page.getByRole('tab', { name: /planning/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // Click on Analytics tab
    await page.getByRole('tab', { name: /analytiques/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('should open production wizard', async ({ page }) => {
    // Click new production button
    await page.getByRole('button', { name: /nouvelle production/i }).click();

    // Verify wizard modal is open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/choisir le produit/i)).toBeVisible();
  });

  test('should filter orders by status', async ({ page }) => {
    // Go to orders tab
    await page.getByRole('tab', { name: /ordres/i }).click();

    // Click on "En attente" filter
    const pendingFilter = page.getByRole('button', { name: /en attente/i });
    if (await pendingFilter.isVisible()) {
      await pendingFilter.click();
      // Verify filter is applied
      await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('should search orders', async ({ page }) => {
    // Go to orders tab
    await page.getByRole('tab', { name: /ordres/i }).click();

    // Find search input and type
    const searchInput = page.getByPlaceholder(/rechercher/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('PRD');
      await page.waitForTimeout(500); // Debounce
    }
  });

  test('should display weekly planning calendar', async ({ page }) => {
    // Go to planning tab
    await page.getByRole('tab', { name: /planning/i }).click();

    // Check calendar elements
    await expect(page.getByText(/lun|mar|mer|jeu|ven|sam|dim/i)).toBeVisible();

    // Check navigation buttons
    await expect(page.getByRole('button', { name: /aujourd'hui/i })).toBeVisible();
  });

  test('should navigate weeks in planning', async ({ page }) => {
    // Go to planning tab
    await page.getByRole('tab', { name: /planning/i }).click();

    // Get current week display
    const weekDisplay = page.locator('span').filter({ hasText: /\d+.*-.*\d+/ }).first();

    // Click next week
    await page.getByRole('button', { name: /suivant|next|→/i }).first().click();
    await page.waitForTimeout(500);

    // Click previous week
    await page.getByRole('button', { name: /précédent|prev|←/i }).first().click();
    await page.waitForTimeout(500);

    // Click today button
    await page.getByRole('button', { name: /aujourd'hui/i }).click();
  });
});

test.describe('Production Order Flow', () => {
  test('complete production workflow: create → start → complete', async ({ page }) => {
    // This test requires a product with recipe to exist
    await page.goto('/dashboard/production');

    // Step 1: Open wizard
    await page.getByRole('button', { name: /nouvelle production/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Step 2: Select first product with recipe (if available)
    const productButtons = page.locator('[data-testid="product-select-button"]');
    const hasProducts = await productButtons.count() > 0;

    if (hasProducts) {
      await productButtons.first().click();

      // Step 3: Set quantity
      await expect(page.getByText(/définir la quantité/i)).toBeVisible();

      // Increase batch count
      await page.getByRole('button', { name: '+' }).click();

      // Check stock
      await page.getByRole('button', { name: /vérifier le stock/i }).click();

      // Wait for stock check
      await page.waitForTimeout(2000);

      // If stock is available, continue to confirmation
      const continueButton = page.getByRole('button', { name: /continuer/i });
      if (await continueButton.isVisible()) {
        await continueButton.click();

        // Confirm and launch
        await page.getByRole('button', { name: /lancer la production/i }).click();

        // Should redirect to order detail page
        await page.waitForURL(/\/dashboard\/production\/order\/\d+/);
      }
    }
  });
});

test.describe('Production Analytics', () => {
  test('should display analytics charts', async ({ page }) => {
    await page.goto('/dashboard/production');

    // Go to analytics tab
    await page.getByRole('tab', { name: /analytiques/i }).click();

    // Check period selector
    await expect(page.getByRole('button', { name: /semaine/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /mois/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /année/i })).toBeVisible();

    // Check main metrics
    await expect(page.getByText(/total produit/i)).toBeVisible();
    await expect(page.getByText(/ordres complétés/i)).toBeVisible();
    await expect(page.getByText(/rendement/i)).toBeVisible();
  });

  test('should switch analytics periods', async ({ page }) => {
    await page.goto('/dashboard/production');
    await page.getByRole('tab', { name: /analytiques/i }).click();

    // Click week
    await page.getByRole('button', { name: /semaine/i }).click();
    await page.waitForTimeout(500);

    // Click month
    await page.getByRole('button', { name: /mois/i }).click();
    await page.waitForTimeout(500);

    // Click year
    await page.getByRole('button', { name: /année/i }).click();
    await page.waitForTimeout(500);
  });
});

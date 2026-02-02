import { test, expect } from '@playwright/test';

test.describe('Production Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting cookies or localStorage if needed
    await page.goto('/dashboard/production');
  });

  test('should display production page with all tabs', async ({ page }) => {
    // Check main tabs are visible
    await expect(page.getByRole('button', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ordres/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Produits/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Planning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Traçabilité/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analytiques/i })).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    // Click on Orders tab
    await page.getByRole('button', { name: /Ordres/i }).click();
    await expect(page.getByText(/Nouvelle production/i)).toBeVisible();

    // Click on Products tab
    await page.getByRole('button', { name: /Produits/i }).click();
    await expect(page.getByText(/Nouveau produit/i)).toBeVisible();

    // Click on Calendar tab
    await page.getByRole('button', { name: /Planning/i }).click();
    await expect(page.getByText(/Planning de Production/i)).toBeVisible();
  });

  test('should open new production wizard', async ({ page }) => {
    await page.getByRole('button', { name: /Nouvelle production/i }).click();
    await expect(page.getByText(/Wizard/i).or(page.getByText(/Sélectionnez/i))).toBeVisible();
  });

  test('should filter orders by status', async ({ page }) => {
    await page.getByRole('button', { name: /Ordres/i }).click();
    
    // Click on "En attente" filter
    await page.getByRole('button', { name: /En attente/i }).first().click();
    
    // Click on "En cours" filter
    await page.getByRole('button', { name: /En cours/i }).first().click();
    
    // Click on "Terminés" filter
    await page.getByRole('button', { name: /Terminés/i }).first().click();
  });

  test('should search products', async ({ page }) => {
    await page.getByRole('button', { name: /Produits/i }).click();
    
    const searchInput = page.getByPlaceholder(/Rechercher/i);
    await searchInput.fill('fromage');
    
    // Wait for filtered results
    await page.waitForTimeout(500);
  });

  test('should display traceability search', async ({ page }) => {
    await page.getByRole('button', { name: /Traçabilité/i }).click();
    
    await expect(page.getByPlaceholder(/Rechercher un numéro de lot/i)).toBeVisible();
  });

  test('should display analytics with period selection', async ({ page }) => {
    await page.getByRole('button', { name: /Analytiques/i }).click();
    
    // Check period buttons
    await expect(page.getByRole('button', { name: /Semaine|7 jours/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mois|30 jours/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Année|12 mois/i })).toBeVisible();
  });
});

test.describe('Production Calendar Tab', () => {
  test('should display 7-day calendar view', async ({ page }) => {
    await page.goto('/dashboard/production');
    await page.getByRole('button', { name: /Planning/i }).click();
    
    // Calendar should have day columns
    await expect(page.locator('.grid-cols-7')).toBeVisible();
  });
});

test.describe('Production Orders Tab', () => {
  test('should display order statistics', async ({ page }) => {
    await page.goto('/dashboard/production');
    await page.getByRole('button', { name: /Ordres/i }).click();
    
    // Should show stats cards
    await expect(page.getByText(/Total/i)).toBeVisible();
    await expect(page.getByText(/En attente/i)).toBeVisible();
    await expect(page.getByText(/En cours/i)).toBeVisible();
    await expect(page.getByText(/Terminés/i)).toBeVisible();
  });
});

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Setup test - Authenticates and saves state for other tests
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be visible
  await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL || 'admin@manchengo.local');
  await page.getByLabel(/mot de passe/i).fill(process.env.TEST_USER_PASSWORD || 'Admin123!@#');

  // Click login button
  await page.getByRole('button', { name: /se connecter/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/);

  // Verify we're logged in
  await expect(page.getByText(/production|approvisionnement|dashboard/i)).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

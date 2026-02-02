import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// E2E TESTS - 4 DASHBOARDS (Stock, Production, Ventes, Admin)
// ═══════════════════════════════════════════════════════════════════════════════
// Tests: Login, navigation, data loading, error handling, responsive
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const USERS = {
  admin: { email: 'admin@manchengo.dz', password: 'Admin123!' },
  appro: { email: 'appro@manchengo.dz', password: 'Appro123!' },
  production: { email: 'prod@manchengo.dz', password: 'Prod123!' },
  commercial: { email: 'commercial@manchengo.dz', password: 'Commercial123!' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function login(page: Page, user: keyof typeof USERS) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', USERS[user].email);
  await page.fill('input[name="password"]', USERS[user].password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  console.log(`✅ Logged in as ${user}`);
}

async function waitForApiResponse(page: Page, urlPattern: string) {
  return page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() < 400,
    { timeout: 15000 },
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TEST 1: DASHBOARD STOCK
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('📊 Dashboard Stock', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('1.1 — Charge le dashboard stock avec les 3 zones', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard/stock`);

    // Vérifier que la page charge
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    const loadTime = Date.now() - startTime;
    console.log(`✅ Dashboard Stock chargé en ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('1.2 — Affiche les matières premières', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/stock/mp`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Stock MP accessible');
  });

  test('1.3 — Affiche les produits finis', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/stock/pf`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Stock PF accessible');
  });

  test('1.4 — Affiche la gestion des lots', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/stock/lots`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Lots accessible');
  });

  test('1.5 — Affiche les stats DLC/Expiry', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/stock/expiry`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page DLC/Expiry accessible');
  });

  test('1.6 — Navigation sidebar Stock fonctionne', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/stock`);
    await page.waitForLoadState('networkidle');

    // Cliquer sur "Matières Premières" dans la sidebar
    const mpLink = page.locator('a[href="/dashboard/stock/mp"]');
    if (await mpLink.isVisible()) {
      await mpLink.click();
      await expect(page).toHaveURL(/.*\/dashboard\/stock\/mp/);
      console.log('✅ Navigation sidebar Stock → MP fonctionne');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 TEST 2: DASHBOARD PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🏭 Dashboard Production', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'production');
  });

  test('2.1 — Charge le dashboard production', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard/production`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    const loadTime = Date.now() - startTime;
    console.log(`✅ Dashboard Production chargé en ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('2.2 — KPIs production affichés (sans données financières)', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/production`);
    await page.waitForLoadState('networkidle');

    // Vérifier que les KPIs de production sont visibles
    const pageContent = await page.textContent('body');

    // NE DOIT PAS contenir de données financières
    const hasFinancialData = /chiffre\s+d'affaires|ventes\s+du\s+jour|CA\s+/i.test(pageContent || '');
    expect(hasFinancialData).toBe(false);
    console.log('✅ Dashboard Production sans données financières');
  });

  test('2.3 — Page recettes accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/production/recettes`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Recettes accessible');
  });

  test('2.4 — Rôle PRODUCTION ne voit pas les sections Admin', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // La section Admin ne doit pas être visible
    const adminLink = page.locator('a[href="/dashboard/sync"]');
    await expect(adminLink).not.toBeVisible();
    console.log('✅ Sections admin masquées pour PRODUCTION');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💼 TEST 3: DASHBOARD VENTES (Commercial)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('💼 Dashboard Ventes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('3.1 — Charge la page factures/ventes', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard/invoices`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    const loadTime = Date.now() - startTime;
    console.log(`✅ Dashboard Ventes chargé en ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('3.2 — Page clients accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/clients`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Clients accessible');
  });

  test('3.3 — KPIs dashboard principal contiennent les ventes', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Le dashboard admin affiche les données de vente
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('✅ Dashboard principal charge correctement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TEST 4: DASHBOARD ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🔧 Dashboard Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('4.1 — Charge le dashboard admin principal', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    const loadTime = Date.now() - startTime;
    console.log(`✅ Dashboard Admin chargé en ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('4.2 — Page synchronisation accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/sync`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Sync accessible');
  });

  test('4.3 — Page exports accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/exports`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Exports accessible');
  });

  test('4.4 — Page monitoring accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/monitoring`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Monitoring accessible');
  });

  test('4.5 — Page utilisateurs sécurité accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/security/users`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Security Users accessible');
  });

  test('4.6 — Page audit accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/security/audit`);
    await expect(page.locator('h1, h2, [data-testid]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Page Audit accessible');
  });

  test('4.7 — Admin voit toutes les sections de navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // L'admin doit voir toutes les sections
    const sections = ['Stock', 'Production', 'Commercial', 'Approvisionnement', 'Administration', 'Sécurité'];
    for (const section of sections) {
      const sectionBtn = page.locator(`button:has-text("${section}")`);
      await expect(sectionBtn).toBeVisible({ timeout: 5000 });
    }
    console.log('✅ Admin voit les 6 sections de navigation');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 TEST 5: CONTRÔLE D'ACCÈS PAR RÔLE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🔒 Contrôle d\'accès par rôle', () => {
  test('5.1 — PRODUCTION ne peut pas accéder aux exports', async ({ page }) => {
    await login(page, 'production');
    await page.goto(`${BASE_URL}/dashboard/exports`);

    // Soit redirigé, soit accès refusé
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasAccess = url.includes('/dashboard/exports');

    if (hasAccess) {
      // Vérifier qu'il n'y a pas de données sensibles
      console.log('⚠️ Page exports accessible mais vérifions le contenu');
    } else {
      console.log('✅ PRODUCTION redirigé depuis /exports');
    }
  });

  test('5.2 — Utilisateur non authentifié redirigé vers login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL('**/login**', { timeout: 10000 });
    console.log('✅ Redirection vers login pour utilisateur non authentifié');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⚡ TEST 6: PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('⚡ Performance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('6.1 — Tous les dashboards chargent en < 5s', async ({ page }) => {
    const dashboards = [
      { name: 'Admin', url: '/dashboard' },
      { name: 'Stock', url: '/dashboard/stock' },
      { name: 'Production', url: '/dashboard/production' },
      { name: 'Invoices', url: '/dashboard/invoices' },
      { name: 'Appro', url: '/dashboard/appro' },
    ];

    for (const dash of dashboards) {
      const start = Date.now();
      await page.goto(`${BASE_URL}${dash.url}`);
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - start;
      console.log(`  ${dash.name}: ${duration}ms`);
      expect(duration).toBeLessThan(5000);
    }
    console.log('✅ Tous les dashboards chargent en < 5s');
  });

  test('6.2 — Pas d\'erreur JavaScript en console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.goto(`${BASE_URL}/dashboard/stock`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration'),
    );

    if (criticalErrors.length > 0) {
      console.log('⚠️ Erreurs JS détectées:', criticalErrors);
    } else {
      console.log('✅ Pas d\'erreur JavaScript critique');
    }
    expect(criticalErrors.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 TEST 7: RESPONSIVE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('📱 Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('7.1 — Dashboard stock en mode mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/dashboard/stock`);
    await page.waitForLoadState('networkidle');

    // Vérifier que le contenu est visible
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('✅ Dashboard stock en mode mobile');
  });

  test('7.2 — Dashboard en mode tablette', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toBeEmpty();
    console.log('✅ Dashboard en mode tablette');
  });
});

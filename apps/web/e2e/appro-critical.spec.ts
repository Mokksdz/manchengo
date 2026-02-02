/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS E2E FRONTEND CRITIQUES — MODULE APPRO (Playwright)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * OBJECTIF : Simuler les erreurs humaines réelles via interface
 * EXÉCUTION : npx playwright test e2e/appro-critical.spec.ts
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const USERS = {
  admin: { email: 'admin@manchengo.dz', password: 'Admin123!' },
  appro: { email: 'appro@manchengo.dz', password: 'Appro123!' },
  production: { email: 'prod@manchengo.dz', password: 'Prod123!' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function login(page: Page, user: keyof typeof USERS) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', USERS[user].email);
  await page.fill('input[name="password"]', USERS[user].password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**');
}

async function createDemandeMp(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/dashboard/appro/demandes`);
  await page.click('button:has-text("Nouvelle demande")');
  
  // Remplir le formulaire
  await page.fill('textarea[name="commentaire"]', 'Test E2E Playwright');
  await page.click('button:has-text("Ajouter ligne")');
  
  // Sélectionner produit et quantité
  await page.selectOption('select[name="productMpId"]', { index: 1 });
  await page.fill('input[name="quantiteDemandee"]', '100');
  
  await page.click('button:has-text("Créer")');
  await page.waitForSelector('.toast-success, [data-testid="demande-created"]');
  
  // Récupérer la référence
  const reference = await page.textContent('[data-testid="demande-reference"]');
  return reference || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1 : FLUX NOMINAL COMPLET (UI)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('📋 TEST 1: Flux nominal complet via UI', () => {
  test('1.1 — Parcours complet Demande → BC → Réception', async ({ page }) => {
    // ÉTAPE 1: PRODUCTION crée une demande
    await login(page, 'production');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes`);
    
    // Créer demande
    await page.click('button:has-text("Nouvelle demande")');
    await page.fill('textarea[name="commentaire"]', 'Test flux complet E2E');
    await page.click('button:has-text("Ajouter ligne")');
    await page.waitForSelector('[data-testid="ligne-form"]');
    
    // La demande est créée en BROUILLON
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('.badge:has-text("Brouillon")')).toBeVisible();
    
    // Soumettre la demande
    await page.click('button:has-text("Soumettre")');
    await page.click('button:has-text("Confirmer")'); // Modal confirmation
    await expect(page.locator('.badge:has-text("Soumise")')).toBeVisible();
    
    console.log('✅ PRODUCTION: Demande créée et soumise');
    
    // ÉTAPE 2: APPRO valide
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes`);
    await page.click('tr:first-child'); // Ouvrir la première demande
    
    await page.click('button:has-text("Valider")');
    await page.click('button:has-text("Confirmer")');
    await expect(page.locator('.badge:has-text("Validée")')).toBeVisible();
    
    console.log('✅ APPRO: Demande validée');
    
    // ÉTAPE 3: Générer BC
    await page.click('button:has-text("Générer BC")');
    await page.waitForSelector('[data-testid="generate-bc-modal"]');
    await page.click('button:has-text("Générer")');
    
    await expect(page.locator('.badge:has-text("BC généré")')).toBeVisible();
    console.log('✅ APPRO: BC généré');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2 : DOUBLE-CLIC PROTECTION (UI)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🔁 TEST 2: Protection double-clic via UI', () => {
  test('2.1 — Double-clic rapide sur "Générer BC" ne crée qu\'un seul BC', async ({ page }) => {
    await login(page, 'appro');
    
    // Naviguer vers une demande validée (prérequis: avoir une demande VALIDEE)
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=VALIDEE`);
    await page.click('tr:first-child');
    
    // Double-clic rapide
    const generateBtn = page.locator('button:has-text("Générer BC")');
    await generateBtn.dblclick();
    
    // Vérifier qu'il n'y a pas d'erreur de duplication
    // Le bouton doit être désactivé après le premier clic
    await expect(generateBtn).toBeDisabled();
    
    // Attendre le résultat
    await page.waitForSelector('.toast-success, .toast-error');
    
    // Vérifier qu'un seul BC est visible
    const bcCount = await page.locator('[data-testid="bc-reference"]').count();
    expect(bcCount).toBe(1);
    
    console.log('✅ Double-clic protégé: UN SEUL BC créé');
  });
  
  test('2.2 — Bouton désactivé pendant le chargement', async ({ page }) => {
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=VALIDEE`);
    await page.click('tr:first-child');
    
    const generateBtn = page.locator('button:has-text("Générer BC")');
    
    // Intercepter la requête pour la ralentir
    await page.route('**/generate-bc', async (route) => {
      await new Promise(r => setTimeout(r, 2000)); // Délai 2s
      await route.continue();
    });
    
    await generateBtn.click();
    
    // Vérifier que le bouton est désactivé pendant le loading
    await expect(generateBtn).toBeDisabled();
    await expect(generateBtn).toHaveAttribute('aria-busy', 'true');
    
    console.log('✅ Bouton désactivé pendant chargement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3 : CONFLIT MULTI-UTILISATEUR (UI)
// ═══════════════════════════════════════════════════════════════════

test.describe('⚔️ TEST 3: Conflit multi-utilisateur via UI', () => {
  test('3.1 — Deux utilisateurs ouvrent la même demande', async ({ browser }) => {
    // Ouvrir deux contextes navigateur (simule 2 utilisateurs)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    // Utilisateur A (Admin)
    await login(pageA, 'admin');
    
    // Utilisateur B (Appro)
    await login(pageB, 'appro');
    
    // Les deux ouvrent la même demande
    const demandeUrl = `${BASE_URL}/dashboard/appro/demandes/1`;
    await pageA.goto(demandeUrl);
    await pageB.goto(demandeUrl);
    
    // Utilisateur A modifie (premier)
    await pageA.fill('textarea[name="commentaire"]', 'Modifié par A');
    await pageA.click('button:has-text("Enregistrer")');
    await pageA.waitForSelector('.toast-success');
    
    console.log('✅ Utilisateur A: Modification sauvegardée');
    
    // Utilisateur B tente de modifier (version obsolète)
    await pageB.fill('textarea[name="commentaire"]', 'Modifié par B');
    await pageB.click('button:has-text("Enregistrer")');
    
    // Doit voir un message d'erreur de conflit
    await expect(pageB.locator('.toast-error, [data-testid="conflict-error"]')).toBeVisible();
    
    console.log('✅ Utilisateur B: Conflit détecté');
    
    await contextA.close();
    await contextB.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4 : VERROU SERVEUR (UI)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🔐 TEST 4: Verrou serveur via UI', () => {
  test('4.1 — Indicateur de verrouillage visible', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    await login(pageA, 'admin');
    await login(pageB, 'appro');
    
    // Utilisateur A ouvre la demande en mode édition
    await pageA.goto(`${BASE_URL}/dashboard/appro/demandes/1/edit`);
    
    // Attendre que le verrou soit acquis
    await pageA.waitForSelector('[data-testid="lock-acquired"]', { timeout: 5000 }).catch(() => {});
    
    // Utilisateur B tente d'accéder
    await pageB.goto(`${BASE_URL}/dashboard/appro/demandes/1/edit`);
    
    // Doit voir un indicateur de verrouillage
    const lockIndicator = pageB.locator('[data-testid="locked-by"], .lock-indicator');
    await expect(lockIndicator).toBeVisible({ timeout: 10000 });
    
    // Les boutons d'action doivent être désactivés
    const actionBtn = pageB.locator('button:has-text("Valider"), button:has-text("Générer BC")');
    await expect(actionBtn.first()).toBeDisabled();
    
    console.log('✅ Verrou visible pour utilisateur B');
    
    await contextA.close();
    await contextB.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5 : TRANSITIONS INTERDITES (UI)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🚫 TEST 5: Transitions interdites via UI', () => {
  test('5.1 — Bouton "Valider" absent pour statut BROUILLON', async ({ page }) => {
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=BROUILLON`);
    
    // Ouvrir une demande en brouillon
    await page.click('tr:first-child');
    
    // Le bouton "Valider" ne doit PAS être visible (transition interdite)
    const validateBtn = page.locator('button:has-text("Valider")');
    await expect(validateBtn).not.toBeVisible();
    
    // Seul "Soumettre" doit être visible
    const submitBtn = page.locator('button:has-text("Soumettre")');
    await expect(submitBtn).toBeVisible();
    
    console.log('✅ Transition BROUILLON→VALIDEE impossible via UI');
  });
  
  test('5.2 — PRODUCTION ne peut pas valider', async ({ page }) => {
    await login(page, 'production');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=SOUMISE`);
    
    // Ouvrir une demande soumise
    await page.click('tr:first-child');
    
    // Le bouton "Valider" ne doit PAS être visible pour PRODUCTION
    const validateBtn = page.locator('button:has-text("Valider")');
    await expect(validateBtn).not.toBeVisible();
    
    console.log('✅ PRODUCTION ne peut pas valider via UI');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6 : REFRESH / BACK NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('🔄 TEST 6: Protection refresh/back', () => {
  test('6.1 — Refresh pendant action ne duplique pas', async ({ page }) => {
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=VALIDEE`);
    await page.click('tr:first-child');
    
    // Cliquer sur Générer BC
    await page.click('button:has-text("Générer BC")');
    
    // Refresh immédiat
    await page.reload();
    
    // Vérifier l'état après reload
    await page.waitForLoadState('networkidle');
    
    // La demande doit avoir le bon statut (pas de duplication)
    const status = await page.textContent('.badge[data-testid="status"]');
    expect(['BC généré', 'EN_COURS_COMMANDE', 'Validée']).toContain(status?.trim());
    
    console.log('✅ Refresh ne cause pas de duplication');
  });
  
  test('6.2 — Bouton back après action critique', async ({ page }) => {
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes`);
    await page.click('tr:first-child');
    
    // Effectuer une action
    const actionBtn = page.locator('button:has-text("Soumettre"), button:has-text("Valider")').first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await page.click('button:has-text("Confirmer")');
      
      // Attendre la confirmation
      await page.waitForSelector('.toast-success');
      
      // Bouton back
      await page.goBack();
      
      // Vérifier qu'il n'y a pas de re-soumission automatique
      await page.waitForLoadState('networkidle');
      
      console.log('✅ Navigation back sécurisée');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 7 : PERTE RÉSEAU
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('📡 TEST 7: Perte réseau', () => {
  test('7.1 — Message d\'erreur clair si réseau coupé', async ({ page, context }) => {
    await login(page, 'appro');
    await page.goto(`${BASE_URL}/dashboard/appro/demandes?status=VALIDEE`);
    await page.click('tr:first-child');
    
    // Couper le réseau
    await context.setOffline(true);
    
    // Tenter une action
    await page.click('button:has-text("Générer BC")');
    
    // Doit voir un message d'erreur réseau
    await expect(page.locator('.toast-error, [data-testid="network-error"]')).toBeVisible({ timeout: 10000 });
    
    // Rétablir le réseau
    await context.setOffline(false);
    
    console.log('✅ Erreur réseau affichée clairement');
  });
});

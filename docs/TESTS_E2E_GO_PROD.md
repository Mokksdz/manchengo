# 🧪 SUITE DE TESTS E2E CRITIQUES — GO PROD APPRO

**Date:** 12 Janvier 2026  
**Module:** APPRO (Demandes MP, Bons de Commande, Réceptions)  
**Criticité:** 🟥 BLOCKER avant production

---

## 📋 RÉSUMÉ DES TESTS

| # | Test | Type | Erreur simulée | Résultat attendu |
|---|------|------|----------------|------------------|
| 1 | Flux nominal complet | E2E | - | Stock mis à jour |
| 2 | Idempotence double-clic | API | Double-clic | 1 seul BC créé |
| 3 | Conflit multi-utilisateur | API | Édition concurrente | VERSION_CONFLICT |
| 4 | Verrou serveur strict | API | Action sur doc verrouillé | ENTITY_LOCKED |
| 5 | Idempotence métier-aware | API | Replay après changement | IDEMPOTENCY_CONTEXT_CHANGED |
| 6 | Transitions interdites | API | Skip état | INVALID_TRANSITION |
| 7 | Protection UI | Playwright | Refresh/Back | Pas de duplication |

---

## 🔧 PRÉREQUIS

```bash
# 1. Appliquer la migration Prisma (nouveaux champs)
cd apps/backend
npx prisma migrate dev --name p1_1_go_prod

# 2. Installer les dépendances de test
npm install --save-dev supertest @types/supertest uuid @types/uuid

# 3. Installer Playwright (frontend)
cd ../web
npm install --save-dev @playwright/test
npx playwright install
```

---

## ▶️ EXÉCUTION DES TESTS

### Tests API (Backend - Supertest)

```bash
cd apps/backend

# Tous les tests critiques
npx jest test/e2e/appro-critical.e2e-spec.ts --runInBand --verbose

# Test spécifique
npx jest test/e2e/appro-critical.e2e-spec.ts -t "Flux nominal"
npx jest test/e2e/appro-critical.e2e-spec.ts -t "Idempotence"
npx jest test/e2e/appro-critical.e2e-spec.ts -t "Conflit"
```

### Tests Frontend (Playwright)

```bash
cd apps/web

# Tous les tests
npx playwright test e2e/appro-critical.spec.ts

# Mode headed (voir le navigateur)
npx playwright test e2e/appro-critical.spec.ts --headed

# Test spécifique
npx playwright test e2e/appro-critical.spec.ts -g "Flux nominal"
```

---

## 📝 DÉTAIL DES TESTS

### TEST 1 : Flux nominal complet

**Objectif:** Prouver que le flux métier standard fonctionne de bout en bout.

**Scénario:**
```
1. PRODUCTION crée demande MP (BROUILLON)
2. PRODUCTION soumet la demande (SOUMISE)
3. APPRO valide la demande (VALIDEE)
4. APPRO génère BC (EN_COURS_COMMANDE)
5. APPRO envoie BC au fournisseur (COMMANDEE)
6. APPRO réceptionne BC (RECEPTIONNEE)
7. Stock MP incrémenté
```

**Données de test:**
```json
{
  "demande": {
    "commentaire": "Test E2E - Besoin urgent lait cru",
    "lignes": [{
      "productMpId": 1,
      "quantiteDemandee": 500
    }]
  }
}
```

**Assertions:**
- Chaque transition de statut est correcte
- Un seul BC est généré
- Stock final = Stock initial + quantité réceptionnée

---

### TEST 2 : Idempotence double-clic

**Objectif:** Prouver qu'un double-clic ne crée pas de duplication.

**Scénario:**
```
1. Demande VALIDEE existante
2. Envoyer POST /generate-bc avec X-Idempotency-Key: "uuid-1"
3. Envoyer à nouveau POST /generate-bc avec X-Idempotency-Key: "uuid-1"
4. Vérifier qu'UN SEUL BC existe
```

**Assertions:**
```typescript
// Première requête
expect(res1.status).toBe(201);
expect(res1.body.purchaseOrders.length).toBeGreaterThan(0);

// Deuxième requête (replay)
expect(res2.status).toBe(201);
expect(res2.headers['x-idempotent-replayed']).toBe('true');

// Vérification base
const bcs = await prisma.purchaseOrder.findMany({
  where: { linkedDemandId: demandeId }
});
expect(bcs.length).toBe(1); // UN SEUL
```

---

### TEST 3 : Conflit multi-utilisateur (VERSION_CONFLICT)

**Objectif:** Prouver que l'optimistic locking protège contre les modifications concurrentes.

**Scénario:**
```
1. Utilisateur A lit demande (version: 1)
2. Utilisateur B modifie demande (version: 2)
3. Utilisateur A tente de valider avec version: 1
4. Erreur VERSION_CONFLICT
```

**Assertions:**
```typescript
// Tentative avec version obsolète
const res = await request(app)
  .post(`/api/demandes-mp/${id}/valider`)
  .set('Authorization', `Bearer ${tokenA}`)
  .send({ expectedVersion: 1 }); // Obsolète

expect(res.status).toBe(409);
expect(res.body.code).toBe('VERSION_CONFLICT');
expect(res.body.currentVersion).toBe(2);
```

---

### TEST 4 : Verrou serveur strict (ENTITY_LOCKED)

**Objectif:** Prouver que le soft lock est aussi un hard lock côté serveur.

**Scénario:**
```
1. Utilisateur A acquiert verrou sur demande
2. Utilisateur B tente action critique via API
3. Erreur ENTITY_LOCKED
```

**Assertions:**
```typescript
// Utilisateur B tente de générer BC
const res = await request(app)
  .post(`/api/appro/demands/${id}/generate-bc`)
  .set('Authorization', `Bearer ${tokenB}`)
  .set('X-Idempotency-Key', uuidv4());

expect(res.status).toBe(409); // ou 423 Locked
expect(res.body.code).toBe('ENTITY_LOCKED');
expect(res.body.lockedBy).toBeDefined();
```

---

### TEST 5 : Idempotence métier-aware (IDEMPOTENCY_CONTEXT_CHANGED)

**Objectif:** Prouver que le replay vérifie l'état métier actuel.

**Scénario:**
```
1. POST /generate-bc avec X-Idempotency-Key: "uuid-1" (succès)
2. Statut change en externe (COMMANDEE)
3. Replay POST /generate-bc avec "uuid-1"
4. Erreur IDEMPOTENCY_CONTEXT_CHANGED
```

**Assertions:**
```typescript
// Replay après changement de contexte
const res = await request(app)
  .post(`/api/appro/demands/${id}/generate-bc`)
  .set('Authorization', `Bearer ${token}`)
  .set('X-Idempotency-Key', sameKey);

expect(res.status).toBe(409);
expect(res.body.code).toBe('IDEMPOTENCY_CONTEXT_CHANGED');
expect(res.body.expectedStatus).toBe('EN_COURS_COMMANDE');
expect(res.body.currentStatus).toBe('COMMANDEE');
```

---

### TEST 6 : Transitions interdites (State Machine)

**Objectif:** Prouver que les transitions illégales sont bloquées.

**Scénarios:**
```
❌ BROUILLON → VALIDEE (skip SOUMISE)
❌ RECEPTIONNEE → BROUILLON (retour arrière)
❌ PRODUCTION tente de valider (rôle interdit)
```

**Assertions:**
```typescript
// Transition interdite
const res = await request(app)
  .post(`/api/demandes-mp/${id}/valider`) // Demande en BROUILLON
  .set('Authorization', `Bearer ${tokenAppro}`);

expect(res.status).toBe(400);
expect(res.body.code).toBe('INVALID_TRANSITION');
expect(res.body.allowedTransitions).toContain('SOUMISE');
```

---

## ✅ CHECKLIST GO PROD

Avant de déployer en production, TOUS ces tests doivent passer:

```
[ ] TEST 1: Flux nominal complet ✓
[ ] TEST 2: Idempotence double-clic ✓
[ ] TEST 3: Conflit multi-utilisateur ✓
[ ] TEST 4: Verrou serveur strict ✓
[ ] TEST 5: Idempotence métier-aware ✓
[ ] TEST 6: Transitions interdites ✓
[ ] TEST 7: Protection UI (Playwright) ✓
```

### Commande finale GO/NO-GO

```bash
# Backend
cd apps/backend
npm run test:e2e -- --testPathPattern=appro-critical

# Frontend
cd apps/web
npx playwright test e2e/appro-critical.spec.ts

# Si TOUS les tests passent → GO PROD
# Si UN test échoue → NO-GO, corriger avant
```

---

## 🔴 ERREURS CRITIQUES TESTÉES

| Code erreur | HTTP | Signification |
|-------------|------|---------------|
| `INVALID_TRANSITION` | 400 | Transition de statut interdite |
| `VERSION_CONFLICT` | 409 | Modification concurrente détectée |
| `ENTITY_LOCKED` | 409/423 | Document verrouillé par autre utilisateur |
| `IDEMPOTENCY_CONTEXT_CHANGED` | 409 | État métier modifié depuis requête initiale |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Header X-Idempotency-Key manquant |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Clé réutilisée avec body différent |
| `ROLE_NOT_AUTHORIZED` | 403 | Rôle non autorisé pour cette action |

---

## 📊 COUVERTURE DES ERREURS HUMAINES

| Erreur humaine | Test couvrant |
|----------------|---------------|
| Double-clic | TEST 2 |
| Refresh page | TEST 7.1 |
| Bouton back | TEST 7.2 |
| Deux onglets ouverts | TEST 3 |
| Deux utilisateurs même doc | TEST 4 |
| Skip étape workflow | TEST 6 |
| Perte réseau | TEST 7.3 |
| Mauvais rôle | TEST 6.2 |

---

## 📁 FICHIERS DE TEST

```
apps/backend/test/e2e/
└── appro-critical.e2e-spec.ts    # Tests API Supertest

apps/web/e2e/
└── appro-critical.spec.ts        # Tests UI Playwright
```

---

**🚀 Système APPRO certifié INCASSABLE une fois tous les tests verts.**

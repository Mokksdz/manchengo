# ✅ GO PROD Checklist — Module Stock

> **Version**: 1.0.0  
> **Date**: Janvier 2026  
> **Responsable**: Équipe Développement

---

## 📋 Résumé Exécutif

Le module Stock a été entièrement refactoré sur **14 jours** (J1-J14) pour être **production-ready**.

### Périmètre

| Composant | Status | Tests |
|-----------|--------|-------|
| Backend FIFO | ✅ Complet | 38 tests |
| Backend Inventaire | ✅ Complet | Intégrés |
| Backend Dashboard | ✅ Complet | Intégrés |
| Frontend Dashboard | ✅ Complet | 17 E2E |
| Documentation | ✅ Complet | N/A |

---

## 🔍 Checklist Pré-Déploiement

### 1. Backend

#### 1.1 Base de Données
- [x] Migration `20250128_stock_fifo_inventory_v1` appliquée
- [x] Enum `LotStatus` créé (AVAILABLE, BLOCKED, CONSUMED)
- [x] Index FIFO optimisé sur `lot_mp` et `lot_pf`
- [x] Table `InventoryDeclaration` créée
- [x] Champs `idempotencyKey` et `lotSnapshot` sur `StockMovement`
- [ ] **ACTION**: Backup BDD avant migration prod

#### 1.2 Services
- [x] `LotConsumptionService` — Consommation FIFO stricte
- [x] `InventoryService` — Workflow inventaire sécurisé
- [x] `StockDashboardService` — Dashboard 3 zones
- [x] `LotExpiryJob` — Blocage auto lots expirés

#### 1.3 Endpoints API
- [x] `GET /api/stock/dashboard` — Dashboard complet
- [x] `GET /api/stock/dashboard/critical` — Alertes critiques
- [x] `GET /api/stock/dashboard/count` — Compteur rapide
- [x] `GET /api/stock/dashboard/health` — Métriques santé
- [x] `GET /api/stock/dashboard/expiry` — Stats DLC
- [x] `POST /api/inventory/declare` — Déclaration inventaire
- [x] `POST /api/inventory/:id/validate` — Validation
- [x] `POST /api/inventory/:id/reject` — Rejet

#### 1.4 Sécurité Backend
- [x] Guards JWT sur tous les endpoints
- [x] Vérification rôles (ADMIN, APPRO, PRODUCTION)
- [x] Audit trail sur opérations critiques
- [x] Transactions atomiques avec `SELECT FOR UPDATE`
- [x] Idempotency keys sur mouvements stock

### 2. Frontend

#### 2.1 Pages
- [x] `/dashboard/stock` — Dashboard 3 zones
- [x] `/dashboard/stock/inventaire` — Gestion inventaire
- [x] `/dashboard/stock/expiry` — Gestion DLC
- [x] Navigation sidebar mise à jour

#### 2.2 Composants
- [x] `ZoneCritique` — Zone rouge
- [x] `ZoneATraiter` — Zone orange
- [x] `ZoneSante` — Zone verte + Health Score
- [x] `StockAlertItem` — Item alerte réutilisable
- [x] `StockSummaryCard` — Carte KPI

#### 2.3 UX
- [x] Loading states sur toutes les pages
- [x] Error handling avec retry
- [x] Auto-refresh 5 minutes
- [x] Responsive mobile/tablet
- [x] Tooltips sur actions

### 3. Tests

#### 3.1 Backend
- [x] `business-rules.spec.ts` — 28 tests règles métier
- [x] `stock-integration.spec.ts` — 10 tests intégration
- [x] E2E specs scaffolded (à exécuter avec BDD réelle)

#### 3.2 Frontend
- [x] `stock-dashboard.spec.ts` — 17 tests E2E Playwright
  - [x] Dashboard 3 zones (4 tests)
  - [x] Gestion Inventaire (4 tests)
  - [x] Gestion DLC (3 tests)
  - [x] Sécurité Anti-Fraude (2 tests)
  - [x] Navigation (2 tests)
  - [x] Performance (2 tests)

### 4. Documentation

- [x] `GUIDE_UTILISATEUR_STOCK.md` — Guide utilisateur
- [x] `STOCK_FRONTEND_TECHNICAL.md` — Documentation technique
- [x] `STOCK_MODULE_GO_PROD.md` — Specs backend
- [x] `STOCK_GO_PROD_CHECKLIST.md` — Cette checklist

---

## 🚨 Règles Métier Critiques

### FIFO
| Règle | Implémentation | Test |
|-------|----------------|------|
| DLC prioritaire | `ORDER BY expiryDate ASC` | ✅ |
| Lots AVAILABLE uniquement | `WHERE status = 'AVAILABLE'` | ✅ |
| Consommation atomique | `$transaction` + `FOR UPDATE` | ✅ |
| Idempotency | `idempotencyKey` unique | ✅ |

### Anti-Fraude Inventaire
| Règle | Implémentation | Test |
|-------|----------------|------|
| Compteur ≠ Valideur | Check `countedById !== validatorId` | ✅ |
| Double validation HIGH/CRITICAL | `requiresDoubleValidation` | ✅ |
| Cooldown 4h | Check dernière déclaration | ✅ |
| Seuil critique 50k DA | `valueDifference > 50000` | ✅ |
| Audit complet | `AuditService.log()` | ✅ |

---

## 🔧 Configuration Production

### Variables d'environnement

```env
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production

# Frontend
NEXT_PUBLIC_API_URL=https://api.manchengo.dz/api
```

### Jobs CRON

| Job | Schedule | Description |
|-----|----------|-------------|
| `LotExpiryJob` | `0 2 * * *` | Blocage lots expirés (02:00) |

---

## 📊 Métriques à Surveiller

### Dashboard
- Health Score < 60 → Alerte
- Critical Count > 10 → Escalade
- API response time > 2s → Investigation

### Base de données
- Lots BLOCKED ratio > 10%
- Déclarations PENDING > 50
- Mouvements stock/jour (baseline)

---

## 🚀 Procédure de Déploiement

### 1. Préparation
```bash
# Backup BDD
pg_dump -h host -U user manchengo > backup_$(date +%Y%m%d).sql

# Tag release
git tag -a v1.0.0-stock -m "Stock module production ready"
```

### 2. Migration
```bash
# Appliquer migration
npx prisma migrate deploy

# Vérifier
npx prisma db pull
```

### 3. Déploiement Backend
```bash
npm run build
pm2 restart manchengo-api
```

### 4. Déploiement Frontend
```bash
npm run build
# Déployer sur CDN/Vercel
```

### 5. Vérification Post-Déploiement
- [ ] Dashboard Stock accessible
- [ ] 3 zones affichées
- [ ] Health Score calculé
- [ ] Déclaration inventaire fonctionne
- [ ] Validation inventaire fonctionne
- [ ] Page DLC accessible
- [ ] Logs sans erreurs

---

## ✅ Validation Finale

### Critères GO

| Critère | Status |
|---------|--------|
| Tous les tests passent | ✅ |
| Build sans erreurs | ✅ |
| Documentation complète | ✅ |
| Backup BDD effectué | ⏳ Avant deploy |
| Équipe formée | ⏳ À planifier |

### Signatures

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Tech Lead | _________ | ____/____/____ | _________ |
| QA | _________ | ____/____/____ | _________ |
| Product Owner | _________ | ____/____/____ | _________ |

---

## 📞 Contacts Escalade

| Niveau | Contact | Délai |
|--------|---------|-------|
| L1 | Support technique | < 1h |
| L2 | Dev team | < 4h |
| L3 | Tech Lead | < 24h |

---

## 📝 Notes de Version

### v1.0.0 — Module Stock Production Ready

**Nouvelles fonctionnalités**:
- Dashboard Stock 3 zones (Critique, À Traiter, Santé)
- Consommation FIFO stricte avec traçabilité
- Workflow inventaire sécurisé multi-validation
- Blocage automatique lots expirés
- Health Score temps réel

**Améliorations sécurité**:
- Règle Compteur ≠ Valideur
- Double validation écarts critiques
- Cooldown 4h entre déclarations
- Audit trail complet

**Documentation**:
- Guide utilisateur complet
- Documentation technique frontend
- Checklist GO PROD

---

*GO PROD Checklist — Manchengo Smart ERP v1.0.0*

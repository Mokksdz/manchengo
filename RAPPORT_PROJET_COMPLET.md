# 📊 RAPPORT ULTRA-DÉTAILLÉ — MANCHENGO SMART ERP
**Date de génération:** 12 Janvier 2026  
**Version:** 1.0.0

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Base de données](#3-base-de-données)
4. [Backend (NestJS)](#4-backend-nestjs)
5. [Frontend (Next.js)](#5-frontend-nextjs)
6. [Modules métier](#6-modules-métier)
7. [Sécurité](#7-sécurité)
8. [API Endpoints](#8-api-endpoints)
9. [Flux métier](#9-flux-métier)
10. [État du code](#10-état-du-code)
11. [Recommandations](#11-recommandations)

---

## 1. VUE D'ENSEMBLE

### 1.1 Description du projet

**Manchengo Smart ERP** est un système ERP (Enterprise Resource Planning) industriel conçu pour les entreprises agro-alimentaires, spécialisé dans la gestion de fromageries et laiteries.

### 1.2 Statistiques globales

| Métrique | Valeur |
|----------|--------|
| **Total fichiers TypeScript** | 10,290 |
| **Fichiers backend (.ts)** | 127 |
| **Fichiers frontend (.tsx)** | 57 |
| **Lignes schema Prisma** | 1,451 |
| **Modèles de données** | 38 |
| **Enums** | 32 |
| **Controllers** | 21 |
| **Services** | 42 |

### 1.3 Taille des applications

| Application | Taille |
|-------------|--------|
| Backend | 448 MB |
| Web (Frontend) | 599 MB |
| Desktop (Tauri) | 1.1 MB |
| Mobile (Flutter) | 696 KB |

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Stack technologique

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MANCHENGO SMART ERP                              │
├─────────────────────────────────────────────────────────────────────────┤
│  FRONTEND                                                                │
│  ├── Next.js 14.0.4 (React 18.2)                                        │
│  ├── TailwindCSS 3.4.0                                                  │
│  ├── Lucide React (icons)                                               │
│  ├── Recharts (graphiques)                                              │
│  ├── Sonner (notifications)                                             │
│  └── Radix UI (composants headless)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  BACKEND                                                                 │
│  ├── NestJS 10.3.0                                                      │
│  ├── Prisma ORM 5.8.0                                                   │
│  ├── PostgreSQL                                                         │
│  ├── JWT Authentication                                                 │
│  ├── Passport.js                                                        │
│  ├── Redis (cache)                                                      │
│  └── Swagger (documentation API)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  DESKTOP (futur)                                                         │
│  └── Tauri (Rust + TypeScript)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  MOBILE (futur)                                                          │
│  └── Flutter                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture monorepo

```
manchengo-smart-erp/
├── apps/
│   ├── backend/          # NestJS API (port 3000)
│   ├── web/              # Next.js Frontend (port 3001)
│   ├── desktop/          # Tauri Desktop App
│   └── mobile/           # Flutter Mobile App
├── packages/
│   ├── core/             # Types Rust partagés
│   ├── database/         # SQLite layer (mobile)
│   ├── domain/           # Modèles métier
│   └── sync/             # Event store & sync
├── docs/                 # Documentation
└── tools/                # Scripts utilitaires
```

### 2.3 Communication

```
┌──────────────┐    HTTP/REST    ┌──────────────┐
│   Frontend   │ ◄─────────────► │   Backend    │
│  (Next.js)   │   httpOnly      │  (NestJS)    │
│  Port 3001   │   Cookies       │  Port 3000   │
└──────────────┘                 └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │  PostgreSQL  │
                                 │   Database   │
                                 └──────────────┘
```

---

## 3. BASE DE DONNÉES

### 3.1 Modèles de données (38 tables)

#### Authentification & Utilisateurs
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `User` | Utilisateurs système | devices, refreshTokens, invoices, etc. |
| `RefreshToken` | Tokens de rafraîchissement | user, device |
| `Device` | Appareils enregistrés | user, syncStates, syncEvents |
| `SyncState` | État de synchronisation | device |
| `SyncEvent` | Événements de sync | device, user |

#### Produits & Catalogue
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Brand` | Marques (MONTESA®, QUESA NOVA®) | products |
| `ProductFamily` | Familles produits | products |
| `ProductMp` | Matières premières | lots, stockMovements, recipeItems |
| `ProductPf` | Produits finis | lots, invoiceLines, productionOrders |

#### Stock & Lots
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `LotMp` | Lots matières premières | product, supplier, stockMovements |
| `LotPf` | Lots produits finis | product, productionOrder |
| `StockMovement` | Mouvements de stock | user, productMp, productPf, lots |

#### Fournisseurs & Clients
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Supplier` | Fournisseurs | lots, receptions, purchaseOrders |
| `Client` | Clients | invoices, deliveries |

#### Réceptions & Achats
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `ReceptionMp` | Réceptions MP | supplier, lines, demandesAppro |
| `ReceptionMpLine` | Lignes de réception | reception, productMp |
| `PurchaseOrder` | Bons de commande | supplier, linkedDemand, items |
| `PurchaseOrderItem` | Lignes BC | purchaseOrder, productMp |

#### Production
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Recipe` | Recettes de production | productPf, items |
| `RecipeItem` | Composants recette | recipe, productMp |
| `ProductionOrder` | Ordres de production | user, productPf, recipe, consumptions |
| `ProductionConsumption` | Consommations MP | productionOrder, productMp, lotMp |

#### Ventes & Facturation
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Invoice` | Factures | client, user, lines, payments |
| `InvoiceLine` | Lignes facture | invoice, productPf |
| `Payment` | Paiements | invoice, user |
| `Delivery` | Livraisons | invoice, client |
| `DeliveryValidationLog` | Logs validation livraison | - |

#### Approvisionnement
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `DemandeApprovisionnementMp` | Demandes MP | createdBy, validatedBy, lignes, purchaseOrders |
| `DemandeApproLigne` | Lignes demande | demande, productMp |
| `ApproAlert` | Alertes APPRO | acknowledgedByUser |

#### Monitoring & Audit
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Alert` | Alertes système | history |
| `AlertHistory` | Historique alertes | alert |
| `SecurityLog` | Logs sécurité | - |
| `AuditLog` | Logs d'audit | - |

#### SaaS & Licences
| Modèle | Description | Relations |
|--------|-------------|-----------|
| `Company` | Entreprises | licenses, devices, users |
| `License` | Licences | company |
| `CompanyDevice` | Appareils entreprise | company |
| `CompanyUser` | Utilisateurs entreprise | company |

### 3.2 Enums (32 types)

```prisma
// Rôles utilisateurs
enum UserRole { ADMIN, APPRO, PRODUCTION, COMMERCIAL }

// Statuts demandes MP
enum DemandeApproStatus {
  BROUILLON, SOUMISE, VALIDEE, REJETEE,
  EN_COURS_COMMANDE, COMMANDEE, RECEPTIONNEE,
  ENVOYEE, TRANSFORMEE  // @deprecated
}

// Priorités
enum DemandeApproPriority { NORMALE, URGENTE, CRITIQUE }

// Statuts BC
enum PurchaseOrderStatus {
  DRAFT, SENT, CONFIRMED, PARTIAL, RECEIVED, CANCELLED
}

// Types de mouvements
enum MovementType { IN, OUT }
enum ProductType { MP, PF }
enum MovementOrigin {
  RECEPTION, PRODUCTION_IN, PRODUCTION_OUT,
  VENTE, INVENTAIRE, RETOUR_CLIENT, PERTE
}

// Criticité MP
enum MpCriticite { FAIBLE, MOYENNE, HAUTE, BLOQUANTE }

// Grade fournisseurs
enum SupplierGrade { A, B, C }

// Statuts production
enum ProductionStatus { PENDING, IN_PROGRESS, COMPLETED, CANCELLED }

// Statuts facture
enum InvoiceStatus { DRAFT, PAID, CANCELLED }

// Méthodes paiement
enum PaymentMethod { ESPECES, CHEQUE, VIREMENT }

// Types alertes
enum AlertType { DEVICE_OFFLINE, SYNC_FAILURE, LOW_STOCK_MP, ... }
enum AlertSeverity { INFO, WARNING, CRITICAL }

// Actions sécurité
enum SecurityAction { LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, ... }

// Types licences SaaS
enum LicenseType { TRIAL, STARTER, PROFESSIONAL, ENTERPRISE }
```

---

## 4. BACKEND (NestJS)

### 4.1 Structure des modules

```
src/
├── main.ts                 # Point d'entrée (port 3000)
├── app.module.ts           # Module racine
│
├── auth/                   # 🔐 Authentification
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   └── strategies/
│       └── jwt.strategy.ts
│
├── admin/                  # 👑 Administration
│   ├── admin.controller.ts
│   └── admin.service.ts
│
├── appro/                  # 📦 Approvisionnement
│   ├── appro.controller.ts
│   ├── appro.service.ts
│   ├── appro-alert.service.ts
│   └── purchase-orders/
│       ├── purchase-order.controller.ts
│       └── purchase-order.service.ts
│
├── demandes-mp/            # 📝 Demandes MP
│   ├── demandes-mp.controller.ts
│   └── demandes-mp.service.ts
│
├── stock/                  # 📊 Gestion stock
│   ├── stock.controller.ts
│   └── stock.service.ts
│
├── production/             # 🏭 Production
│   ├── production.controller.ts
│   ├── production.service.ts
│   ├── recipe.controller.ts
│   └── recipe.service.ts
│
├── suppliers/              # 🏢 Fournisseurs
│   ├── suppliers.controller.ts
│   └── suppliers.service.ts
│
├── products/               # 📦 Produits
│   ├── products.controller.ts
│   └── products.service.ts
│
├── lots/                   # 📋 Lots FIFO
│   ├── lots.controller.ts
│   └── lots.service.ts
│
├── delivery/               # 🚚 Livraisons
│   ├── delivery.controller.ts
│   └── delivery.service.ts
│
├── exports/                # 📤 Exports
│   ├── exports.controller.ts
│   └── services/
│       ├── pdf-generator.service.ts
│       ├── excel-generator.service.ts
│       ├── invoice-pdf.service.ts
│       ├── mp-stocks.service.ts
│       ├── pf-stocks.service.ts
│       └── ...
│
├── dashboard/              # 📈 Tableaux de bord
│   ├── dashboard.controller.ts
│   └── dashboard.service.ts
│
├── monitoring/             # 📡 Monitoring
│   ├── monitoring.controller.ts
│   ├── monitoring.service.ts
│   └── alerts.service.ts
│
├── security/               # 🛡️ Sécurité
│   ├── security.controller.ts
│   ├── audit.controller.ts
│   └── security-log.service.ts
│
├── governance/             # ⚙️ Gouvernance
│   ├── governance.controller.ts
│   ├── feature-flags.service.ts
│   ├── retention.service.ts
│   └── security-hardening.service.ts
│
├── licensing/              # 💳 Licences SaaS
│   ├── licensing.controller.ts
│   └── licensing.service.ts
│
├── modules/
│   └── sync/               # 🔄 Synchronisation
│       ├── sync.controller.ts
│       └── sync.service.ts
│
├── cache/                  # 💾 Cache Redis
│   ├── cache.module.ts
│   └── cache.service.ts
│
├── common/                 # 🔧 Utilitaires
│   ├── middleware/
│   ├── logger/
│   └── audit/
│
└── prisma/                 # 🗄️ Prisma
    └── prisma.service.ts
```

### 4.2 Configuration

```typescript
// Rate Limiting
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 10 },    // 10 req/sec
  { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min
  { name: 'long', ttl: 3600000, limit: 1000 } // 1000 req/heure
])

// Sécurité
- Helmet (headers)
- CORS (origins configurés)
- httpOnly Cookies (auth tokens)
- JWT RS256
```

### 4.3 Dépendances principales

| Package | Version | Usage |
|---------|---------|-------|
| @nestjs/core | 10.3.0 | Framework |
| @prisma/client | 5.8.0 | ORM |
| @nestjs/jwt | 10.2.0 | JWT Auth |
| @nestjs/passport | 10.0.3 | Auth strategies |
| @nestjs/swagger | 7.2.0 | API docs |
| @nestjs/schedule | 6.1.0 | Cron jobs |
| bcrypt | 5.1.1 | Hash passwords |
| exceljs | 4.4.0 | Export Excel |
| pdfmake | - | Export PDF |
| ioredis | 5.8.2 | Redis client |

---

## 5. FRONTEND (Next.js)

### 5.1 Structure des pages

```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx
│
├── (dashboard)/
│   └── dashboard/
│       ├── page.tsx              # Dashboard principal
│       │
│       ├── appro/                # Module APPRO
│       │   ├── page.tsx          # Dashboard APPRO
│       │   ├── alertes/
│       │   ├── bons/             # Bons de commande
│       │   │   ├── page.tsx
│       │   │   └── [id]/
│       │   │       ├── page.tsx
│       │   │       └── receive/
│       │   ├── demandes/         # Demandes MP
│       │   │   ├── page.tsx
│       │   │   └── [id]/
│       │   ├── fournisseurs/
│       │   └── stock/
│       │
│       ├── demandes-mp/          # Demandes (Production)
│       │   └── page.tsx
│       │
│       ├── production/           # Module Production
│       │   ├── page.tsx
│       │   ├── [id]/
│       │   ├── order/[id]/
│       │   └── recettes/
│       │
│       ├── stock/                # Module Stock
│       │   ├── mp/
│       │   ├── pf/
│       │   └── lots/
│       │
│       ├── clients/
│       ├── fournisseurs/
│       ├── invoices/
│       ├── devices/
│       ├── exports/
│       ├── monitoring/
│       ├── security/
│       │   ├── audit/
│       │   ├── devices/
│       │   └── users/
│       └── sync/
│
└── globals.css
```

### 5.2 Composants UI

```
src/components/
├── ui/                          # shadcn/ui components
│   ├── card.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── checkbox.tsx
│   ├── tooltip.tsx
│   ├── alert.tsx
│   ├── alert-dialog.tsx
│   ├── confirm-dialog.tsx
│   ├── critical-action-confirm.tsx
│   ├── critical-alerts.tsx
│   ├── safe-states.tsx
│   └── audit-trail-display.tsx
│
├── appro/                       # Composants APPRO
│   ├── DemandTimeline.tsx
│   └── GenerateBcModal.tsx
│
└── CreateProductMpModal.tsx
```

### 5.3 API Client

```typescript
// src/lib/api.ts

export const API_BASE = 'http://localhost:3000/api';

// Auth API
export const auth = {
  login: (email, password) => apiFetch('/auth/login', ...),
  refresh: () => apiFetch('/auth/refresh', ...),
  logout: () => apiFetch('/auth/logout', ...),
  me: () => fetch('/auth/me', ...),
};

// Dashboard API
export const dashboard = {
  getKpis: () => apiFetch('/dashboard/kpis'),
  getSalesChart: (days) => apiFetch('/dashboard/charts/sales?days=...'),
  getProductionChart: (days) => apiFetch('/dashboard/charts/production?days=...'),
  getSyncStatus: () => apiFetch('/dashboard/sync/status'),
  getRecentEvents: (limit) => apiFetch('/dashboard/sync/events?limit=...'),
};

// APPRO API
export const appro = {
  getDashboard: () => apiFetch('/appro/dashboard'),
  getStockMp: (params) => apiFetch('/appro/stock-mp'),
  getCriticalMp: () => apiFetch('/appro/stock-mp/critical'),
  getSuggestions: () => apiFetch('/appro/requisitions/suggested'),
  getSupplierPerformance: () => apiFetch('/appro/suppliers/performance'),
  
  // Alertes
  getAllAlerts: () => apiFetch('/appro/alerts/all'),
  getActiveAlerts: () => apiFetch('/appro/alerts/active'),
  getCriticalAlerts: () => apiFetch('/appro/alerts/critical'),
  acknowledgeAlert: (id) => apiFetch('/appro/alerts/:id/acknowledge'),
  
  // Bons de commande
  generateBc: (demandId, data) => apiFetch('/appro/demands/:id/generate-bc'),
  getPurchaseOrders: (params) => apiFetch('/appro/purchase-orders'),
  getPurchaseOrder: (id) => apiFetch('/appro/purchase-orders/:id'),
  sendPurchaseOrder: (id, data) => apiFetch('/appro/purchase-orders/:id/send'),
  confirmPurchaseOrder: (id) => apiFetch('/appro/purchase-orders/:id/confirm'),
  receivePurchaseOrder: (id, data) => apiFetch('/appro/purchase-orders/:id/receive'),
};

// Admin API
export const admin = {
  getStockMp: () => apiFetch('/admin/stock/mp'),
  getStockPf: () => apiFetch('/admin/stock/pf'),
  getInvoices: (page, limit) => apiFetch('/admin/invoices'),
  getClients: () => apiFetch('/admin/clients'),
  getSuppliers: () => apiFetch('/admin/suppliers'),
  getUsers: () => apiFetch('/admin/users'),
  getDevices: () => apiFetch('/admin/devices'),
};
```

### 5.4 Dépendances

| Package | Version | Usage |
|---------|---------|-------|
| next | 14.0.4 | Framework |
| react | 18.2.0 | UI Library |
| tailwindcss | 3.4.0 | Styling |
| lucide-react | 0.303.0 | Icons |
| recharts | 2.10.3 | Charts |
| sonner | 1.4.0 | Toast notifications |
| date-fns | 3.0.6 | Date utils |
| @radix-ui/* | - | Headless UI |
| class-variance-authority | 0.7.1 | Variant styles |

---

## 6. MODULES MÉTIER

### 6.1 Module APPRO (Approvisionnement)

**Objectif:** Gestion complète de l'approvisionnement en matières premières

#### Fonctionnalités

| Fonctionnalité | Description | Endpoint |
|----------------|-------------|----------|
| Dashboard APPRO | KPIs, alertes, MP critiques | GET /appro/dashboard |
| Stock MP avec état | Liste MP avec état calculé | GET /appro/stock-mp |
| MP critiques | MP à risque pour production | GET /appro/stock-mp/critical |
| Suggestions commandes | Génération auto suggestions | GET /appro/requisitions/suggested |
| Performance fournisseurs | Métriques par fournisseur | GET /appro/suppliers/performance |
| Alertes APPRO | Gestion alertes métier | GET /appro/alerts/* |
| Vérification production | Check MP avant production | POST /appro/check-production |

#### États des MP

```
SAIN              → Stock OK
SOUS_SEUIL        → Stock < seuil sécurité
A_COMMANDER       → Stock < seuil commande
RUPTURE           → Stock = 0
BLOQUANT_PRODUCTION → Rupture + MP critique
```

### 6.2 Module Demandes MP

**Objectif:** Workflow de demandes d'approvisionnement

#### Workflow

```
BROUILLON → SOUMISE → VALIDEE → EN_COURS_COMMANDE → COMMANDEE → RECEPTIONNEE
                 ↘ REJETEE
```

#### Actions par rôle

| Rôle | Actions autorisées |
|------|-------------------|
| PRODUCTION | Créer, modifier, soumettre, supprimer (brouillons) |
| APPRO | Valider, rejeter, générer BC |
| ADMIN | Toutes actions |

### 6.3 Module Bons de Commande (BC)

**Objectif:** Gestion des commandes fournisseurs

#### Workflow

```
DRAFT → SENT → CONFIRMED → PARTIAL/RECEIVED
                      ↘ CANCELLED
```

#### Règles métier

- ❌ Pas de création manuelle de BC
- ✅ BC toujours généré depuis Demande VALIDÉE
- ✅ Split automatique par fournisseur
- ✅ Traçabilité complète (qui, quand, quoi)

### 6.4 Module Production

**Objectif:** Gestion de la production de produits finis

#### Fonctionnalités

- Gestion des recettes (ingrédients, quantités, temps)
- Ordres de production (batchs)
- Consommation FIFO des MP
- Calcul de rendement
- Création automatique de lots PF

### 6.5 Module Stock

**Objectif:** Gestion des stocks MP et PF

#### Fonctionnalités

- Mouvements de stock (IN/OUT)
- Gestion FIFO par lots
- Traçabilité par lot
- Alertes stock bas
- DLC/DDM

### 6.6 Module Livraison

**Objectif:** Validation des livraisons par QR code

#### Flux

1. Génération QR code à la facture
2. Scan QR par livreur
3. Validation avec preuve (photo, signature)
4. Mise à jour statut livraison

---

## 7. SÉCURITÉ

### 7.1 Authentification

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Login     │ → │  Backend    │ → │  Database   │
│   (email,   │    │  (bcrypt    │    │  (User)     │
│   password) │    │   verify)   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │
       │                  ▼
       │           ┌─────────────┐
       │           │  JWT Token  │
       │           │  (httpOnly  │
       │           │   cookie)   │
       │           └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────────┐
│     Client (credentials:       │
│            'include')          │
└─────────────────────────────────┘
```

### 7.2 RBAC (Role-Based Access Control)

| Rôle | Permissions |
|------|-------------|
| **ADMIN** | Accès total, gestion users, audit |
| **APPRO** | Stock MP, demandes, BC, fournisseurs |
| **PRODUCTION** | Demandes MP, production, recettes |
| **COMMERCIAL** | Clients, factures, livraisons |

### 7.3 Mesures de sécurité

| Mesure | Implémentation |
|--------|----------------|
| **XSS Protection** | httpOnly cookies, pas de localStorage |
| **CSRF Protection** | SameSite cookies |
| **Rate Limiting** | Throttler (10/sec, 100/min, 1000/h) |
| **Headers** | Helmet middleware |
| **CORS** | Origins configurés |
| **Password** | bcrypt hash |
| **Audit Trail** | AuditLog (append-only) |
| **Security Logs** | SecurityLog |

---

## 8. API ENDPOINTS

### 8.1 Authentification

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | /auth/login | Connexion | Non |
| POST | /auth/refresh | Rafraîchir token | Cookie |
| POST | /auth/logout | Déconnexion | Cookie |
| GET | /auth/me | User courant | Cookie |

### 8.2 Dashboard

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| GET | /dashboard/kpis | KPIs globaux | All |
| GET | /dashboard/charts/sales | Graphique ventes | All |
| GET | /dashboard/charts/production | Graphique production | All |
| GET | /dashboard/sync/status | Statut sync | All |
| GET | /dashboard/sync/events | Events récents | All |

### 8.3 APPRO

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| GET | /appro/dashboard | Dashboard APPRO | ADMIN, APPRO |
| GET | /appro/stock-mp | Stock MP avec état | ADMIN, APPRO, PROD |
| GET | /appro/stock-mp/critical | MP critiques | ADMIN, APPRO, PROD |
| PATCH | /appro/stock-mp/:id | MAJ params MP | ADMIN, APPRO |
| GET | /appro/requisitions/suggested | Suggestions | ADMIN, APPRO |
| GET | /appro/suppliers/performance | Perf fournisseurs | ADMIN, APPRO |
| POST | /appro/check-production | Check production | All |
| POST | /appro/update-metrics | Recalcul métriques | ADMIN |

### 8.4 Alertes APPRO

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| GET | /appro/alerts/all | Toutes alertes | ADMIN, APPRO |
| GET | /appro/alerts/active | Alertes actives | ADMIN, APPRO |
| GET | /appro/alerts/critical | Alertes critiques | All |
| GET | /appro/alerts/counts | Compteurs | ADMIN, APPRO |
| POST | /appro/alerts/:id/acknowledge | Accuser réception | ADMIN, APPRO |
| POST | /appro/alerts/scan | Scanner alertes | ADMIN, APPRO |

### 8.5 Bons de Commande

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| POST | /appro/demands/:id/generate-bc | Générer BC | ADMIN, APPRO |
| GET | /appro/purchase-orders | Liste BC | All |
| GET | /appro/purchase-orders/:id | Détail BC | All |
| GET | /appro/demands/:id/purchase-orders | BC d'une demande | All |
| POST | /appro/purchase-orders/:id/send | Envoyer BC | ADMIN, APPRO |
| POST | /appro/purchase-orders/:id/confirm | Confirmer BC | ADMIN, APPRO |
| POST | /appro/purchase-orders/:id/receive | Réceptionner BC | ADMIN, APPRO |

### 8.6 Demandes MP

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| POST | /demandes-mp | Créer demande | PROD, ADMIN |
| GET | /demandes-mp | Lister demandes | All |
| GET | /demandes-mp/stats | Stats demandes | All |
| GET | /demandes-mp/:id | Détail demande | All |
| PUT | /demandes-mp/:id | Modifier demande | PROD, ADMIN |
| POST | /demandes-mp/:id/envoyer | Soumettre | PROD, ADMIN |
| DELETE | /demandes-mp/:id | Supprimer | PROD, ADMIN |
| POST | /demandes-mp/:id/valider | Valider | ADMIN, APPRO |
| POST | /demandes-mp/:id/rejeter | Rejeter | ADMIN, APPRO |

### 8.7 Admin

| Méthode | Endpoint | Description | Rôles |
|---------|----------|-------------|-------|
| GET | /admin/stock/mp | Stock MP | ADMIN |
| GET | /admin/stock/pf | Stock PF | ADMIN |
| GET | /admin/invoices | Factures | ADMIN |
| GET | /admin/clients | Clients | ADMIN |
| GET | /admin/suppliers | Fournisseurs | ADMIN |
| GET | /admin/users | Utilisateurs | ADMIN |
| GET | /admin/devices | Appareils | ADMIN |

---

## 9. FLUX MÉTIER

### 9.1 Flux Demande MP → BC → Réception

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUX APPROVISIONNEMENT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRODUCTION                 APPRO                    FOURNISSEUR         │
│      │                        │                           │              │
│      ▼                        │                           │              │
│  ┌─────────┐                  │                           │              │
│  │ Créer   │                  │                           │              │
│  │ Demande │                  │                           │              │
│  │ MP      │                  │                           │              │
│  └────┬────┘                  │                           │              │
│       │                       │                           │              │
│       ▼                       │                           │              │
│  ┌─────────┐                  │                           │              │
│  │Soumettre│ ───────────────► │                           │              │
│  └─────────┘                  │                           │              │
│                               ▼                           │              │
│                          ┌─────────┐                      │              │
│                          │ Valider │                      │              │
│                          │ Demande │                      │              │
│                          └────┬────┘                      │              │
│                               │                           │              │
│                               ▼                           │              │
│                          ┌─────────┐                      │              │
│                          │ Générer │                      │              │
│                          │   BC    │                      │              │
│                          └────┬────┘                      │              │
│                               │                           │              │
│                               ▼                           │              │
│                          ┌─────────┐    ┌─────────┐       │              │
│                          │ Envoyer │ ──►│ Recevoir│ ──────►│             │
│                          │   BC    │    │   BC    │       │              │
│                          └─────────┘    └────┬────┘       │              │
│                                              │            │              │
│                                              ▼            │              │
│                          ┌─────────────────────┐          │              │
│                          │    Confirmer BC     │◄─────────┘              │
│                          └──────────┬──────────┘                         │
│                                     │                                    │
│                                     ▼                                    │
│                          ┌─────────────────────┐                         │
│                          │   Réceptionner MP   │                         │
│                          │   (Stock + Lots)    │                         │
│                          └─────────────────────┘                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Flux Production

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUX PRODUCTION                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │  Vérifier   │ ──►│   Lancer    │ ──►│  Terminer   │                  │
│  │ Stock MP    │    │ Production  │    │ Production  │                  │
│  │ (check)     │    │             │    │             │                  │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘                  │
│                            │                  │                          │
│                            ▼                  ▼                          │
│                    ┌─────────────┐    ┌─────────────┐                   │
│                    │ Consommer   │    │ Créer Lot   │                   │
│                    │ MP (FIFO)   │    │    PF       │                   │
│                    └─────────────┘    └─────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. ÉTAT DU CODE

### 10.1 Métriques de qualité

| Catégorie | État | Commentaire |
|-----------|------|-------------|
| **TypeScript** | ✅ | Backend compile sans erreur |
| **Structure** | ✅ | Bien organisée, modules séparés |
| **Sécurité** | ✅ | httpOnly cookies, RBAC, audit |
| **Documentation** | ⚠️ | Swagger OK, JSDoc partiel |
| **Tests** | ⚠️ | Présents mais incomplets |
| **Console.log** | ⚠️ | 59 occurrences à nettoyer |
| **Types any** | ✅ | Corrigés (critiques) |

### 10.2 Erreurs corrigées (session actuelle)

| # | Erreur | Statut |
|---|--------|--------|
| 1 | Composants UI manquants | ✅ Corrigé |
| 2 | Statuts legacy (ENVOYEE/TRANSFORMEE) | ✅ Corrigé |
| 3 | Endpoint /transformer obsolète | ✅ Mis à jour |
| 4 | Validation statuts incohérente | ✅ Corrigé |
| 5 | Types 'any' implicites | ✅ Corrigé |
| 6 | Script migration données | ✅ Créé |
| 7 | confirm()/alert() natifs | ✅ Remplacé par toast |

### 10.3 Points d'attention restants

| Priorité | Issue | Fichiers |
|----------|-------|----------|
| Moyenne | console.log en production | 24 fichiers frontend |
| Moyenne | Types Demande dupliqués | 4 fichiers |
| Basse | Commentaires FR/EN mixtes | Multiple |
| Basse | Tests incomplets | Multiple |

---

## 11. RECOMMANDATIONS

### 11.1 Court terme (1-2 semaines)

1. **Exécuter migration données**
   ```bash
   psql $DATABASE_URL < prisma/migrations/migrate-deprecated-statuses.sql
   ```

2. **Nettoyer console.log**
   ```bash
   grep -r "console.log" apps/web/src --include="*.tsx" | wc -l
   # Remplacer par le logger structuré
   ```

3. **Centraliser types DemandeStatus**
   - Créer `types/demande.ts`
   - Importer partout au lieu de redéfinir

### 11.2 Moyen terme (1-2 mois)

1. **Tests**
   - Ajouter tests E2E pour flux APPRO
   - Tests unitaires services critiques
   - Coverage > 70%

2. **Performance**
   - Activer cache Redis
   - Pagination côté serveur
   - Optimiser requêtes Prisma

3. **UX**
   - Skeleton loaders partout
   - Error boundaries
   - PWA manifest

### 11.3 Long terme (3-6 mois)

1. **Mobile Flutter**
   - Finaliser l'app mobile
   - Sync offline-first

2. **Desktop Tauri**
   - Packaging pour Windows/Mac
   - Auto-update

3. **SaaS**
   - Multi-tenant
   - Billing/Stripe
   - Feature flags par licence

---

## 📎 ANNEXES

### A. Variables d'environnement

```bash
# Backend (.env)
DATABASE_URL="postgresql://user:pass@localhost:5432/manchengo_erp"
JWT_SECRET="..."
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="..."
REFRESH_TOKEN_EXPIRES_IN="7d"
REDIS_URL="redis://localhost:6379"

# Frontend (.env.local)
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

### B. Commandes utiles

```bash
# Backend
cd apps/backend
npm run start:dev        # Dev server
npm run prisma:studio    # Prisma Studio
npm run db:push          # Push schema
npm run test             # Run tests

# Frontend
cd apps/web
npm run dev              # Dev server (port 3001)
npm run build            # Build production
npm run lint             # ESLint
```

### C. Utilisateurs de test

| Email | Password | Rôle |
|-------|----------|------|
| admin@manchengo.dz | admin123 | ADMIN |
| appro@manchengo.dz | appro123 | APPRO |
| prod@manchengo.dz | prod123 | PRODUCTION |

---

**FIN DU RAPPORT**

*Généré automatiquement le 12 Janvier 2026*

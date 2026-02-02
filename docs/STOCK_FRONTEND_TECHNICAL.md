# 📊 Documentation Technique — Frontend Stock Dashboard

> **Version**: 1.0.0  
> **Stack**: Next.js 14, React 18, TypeScript, TailwindCSS

---

## 🏗️ Architecture

### Structure des fichiers

```
apps/web/src/
├── app/(dashboard)/dashboard/stock/
│   ├── page.tsx              # Dashboard 3 zones
│   ├── inventaire/
│   │   └── page.tsx          # Gestion inventaire
│   └── expiry/
│       └── page.tsx          # Gestion DLC
├── components/stock/
│   ├── index.ts              # Exports
│   ├── ZoneCritique.tsx      # Zone rouge
│   ├── ZoneATraiter.tsx      # Zone orange
│   ├── ZoneSante.tsx         # Zone verte + health score
│   ├── StockAlertItem.tsx    # Item alerte réutilisable
│   └── StockSummaryCard.tsx  # Carte KPI réutilisable
├── lib/
│   └── api.ts                # Client API Stock Dashboard
└── e2e/
    └── stock-dashboard.spec.ts  # Tests E2E Playwright
```

---

## 🔌 API Client

### Types

```typescript
// lib/api.ts

interface StockAlert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  entityType: 'MP' | 'PF' | 'LOT' | 'INVENTORY';
  entityId: number;
  actionRequired: string;
  actionUrl?: string;
  createdAt: string;
  dismissable: boolean;
}

interface ZoneCritique {
  totalCount: number;
  ruptures: RuptureItem[];
  expiresJ3: ExpiringLot[];
  inventairesCritiques: CriticalInventory[];
  alerts: StockAlert[];
}

interface ZoneATraiter {
  totalCount: number;
  sousSeuilItems: SousSeuilItem[];
  expiresJ7: ExpiringLot[];
  inventairesEnAttente: PendingInventory[];
  alerts: StockAlert[];
}

interface ZoneSante {
  fifoCompliance: number;      // 0-100%
  stockRotation: number;       // 0-100%
  inventoryFreshness: number;  // 0-100%
  blockedLotsRatio: number;    // 0-100%
  expiryRiskScore: number;     // 0-100%
}

interface StockDashboardSummary {
  healthScore: number;         // 0-100
  criticalCount: number;
  warningCount: number;
  lastUpdated: string;         // ISO date
}

interface StockDashboardData {
  critique: ZoneCritique;
  aTraiter: ZoneATraiter;
  sante: ZoneSante;
  summary: StockDashboardSummary;
  _meta: { generatedAt: string; cacheHit: boolean };
}
```

### Endpoints

```typescript
export const stockDashboard = {
  // Dashboard complet
  getDashboard: () => 
    apiFetch<{ success: boolean; data: StockDashboardData }>('/stock/dashboard'),
  
  // Alertes critiques seules
  getCriticalAlerts: () => 
    apiFetch<{ success: boolean; data: { alerts: StockAlert[]; count: number } }>('/stock/dashboard/critical'),
  
  // Compteur rapide (pour badge navbar)
  getCriticalCount: () => 
    apiFetch<{ success: boolean; data: { criticalCount: number; hasCritical: boolean } }>('/stock/dashboard/count'),
  
  // Métriques santé
  getHealthMetrics: () => 
    apiFetch<{ success: boolean; data: { metrics: ZoneSante; interpretation: Record<string, string> } }>('/stock/dashboard/health'),
  
  // Stats DLC
  getExpiryStats: () => 
    apiFetch<{ success: boolean; data: ExpiryStats }>('/stock/dashboard/expiry'),
};
```

---

## 🧩 Composants

### ZoneCritique

Zone rouge - alertes critiques nécessitant action immédiate.

```tsx
<ZoneCritique 
  data={dashboardData.critique}
  onAction={(type, id) => handleAction(type, id)}
/>
```

**Props**:
- `data: ZoneCritique` - Données de la zone
- `onAction?: (type: string, id: number) => void` - Callback action

**Actions émises**:
- `DEMANDE_MP` - Créer demande MP
- `BLOQUER_LOT` - Bloquer un lot

### ZoneATraiter

Zone orange - à traiter sous 24-48h.

```tsx
<ZoneATraiter 
  data={dashboardData.aTraiter}
  onAction={(type, id) => handleAction(type, id)}
/>
```

### ZoneSante

Zone verte - indicateurs de santé avec health score.

```tsx
<ZoneSante 
  data={dashboardData.sante}
  summary={dashboardData.summary}
/>
```

### StockAlertItem

Composant réutilisable pour afficher une alerte.

```tsx
<StockAlertItem
  alert={alert}
  onAction={async (alertId, action) => { /* ... */ }}
  onDismiss={async (alertId) => { /* ... */ }}
/>
```

**Features**:
- Animation de feedback (success/error)
- Tooltip sur actions
- Dismiss si `dismissable: true`

### StockSummaryCard

Carte KPI réutilisable avec icône et trend.

```tsx
<StockSummaryCard
  title="Ruptures"
  value={5}
  subtitle="Produits concernés"
  trend="up"
  trendValue="+2"
  icon={Package}
  color="red"
  onClick={() => navigate('/stock/ruptures')}
/>
```

---

## 🔄 Data Flow

```
┌─────────────────┐
│   Dashboard     │
│   Page.tsx      │
└────────┬────────┘
         │ useCallback + useEffect
         ▼
┌─────────────────┐
│ stockDashboard  │
│ .getDashboard() │
└────────┬────────┘
         │ apiFetch (credentials: include)
         ▼
┌─────────────────┐
│  Backend API    │
│ /stock/dashboard│
└────────┬────────┘
         │ StockDashboardService
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   + Cache       │
└─────────────────┘
```

### Auto-refresh

Le dashboard se rafraîchit automatiquement toutes les **5 minutes** :

```tsx
useEffect(() => {
  loadDashboard();
  const interval = setInterval(() => loadDashboard(true), 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [loadDashboard]);
```

---

## 🧪 Tests E2E

### Exécution

```bash
# Installer Playwright
npm i -D @playwright/test

# Exécuter les tests Stock
npx playwright test e2e/stock-dashboard.spec.ts

# Mode headed (visible)
npx playwright test e2e/stock-dashboard.spec.ts --headed

# Un seul test
npx playwright test -g "Affichage des 3 zones"
```

### Suites de tests

| Suite | Tests | Description |
|-------|-------|-------------|
| Dashboard 3 Zones | 4 | Affichage, refresh, navigation, health |
| Gestion Inventaire | 4 | Accès rôles, filtrage, recherche |
| Gestion DLC | 3 | Accès, stats, résumé risques |
| Sécurité Anti-Fraude | 2 | Auto-validation, actions ADMIN |
| Navigation Menu | 2 | Section sidebar, liens |
| Responsive | 2 | Mobile, tablet |
| Performance | 2 | Temps charge, memory leak |

---

## 🎨 Theming

### Couleurs par zone

```css
/* Zone Critique */
.border-red-200 .bg-red-50/50 .text-red-700

/* Zone À Traiter */
.border-amber-200 .bg-amber-50/50 .text-amber-700

/* Zone Santé */
.border-green-200 .bg-green-50/50 .text-green-700
```

### Health Score Colors

```typescript
const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';  // Excellent
  if (score >= 60) return 'text-amber-600';  // Correct
  if (score >= 40) return 'text-orange-600'; // À surveiller
  return 'text-red-600';                     // Critique
};
```

---

## 📱 Responsive

Le dashboard utilise une grille responsive :

```tsx
<div className="grid lg:grid-cols-3 gap-6">
  <ZoneCritique />  {/* Stack on mobile */}
  <ZoneATraiter />
  <ZoneSante />
</div>
```

- **Desktop** (lg+): 3 colonnes côte à côte
- **Tablet** (md): 2 colonnes
- **Mobile** (sm): 1 colonne empilée

---

## 🔐 Sécurité

### Authentification

Toutes les requêtes API utilisent `credentials: 'include'` pour envoyer les cookies httpOnly.

```typescript
const apiFetch = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  // ...
};
```

### Contrôle d'accès

Les pages vérifient le rôle utilisateur :

```tsx
const { user } = useAuth();

// Page inventaire - ADMIN ou APPRO seulement
if (!['ADMIN', 'APPRO'].includes(user?.role)) {
  return <AccessDenied />;
}
```

---

## 🚀 Build & Deploy

```bash
# Build production
npm run build

# Vérifier les types
npx tsc --noEmit

# Lint
npm run lint
```

### Variables d'environnement

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

*Documentation technique — Manchengo Smart ERP Frontend*

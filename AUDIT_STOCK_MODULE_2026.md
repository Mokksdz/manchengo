# 🔍 AUDIT COMPLET MODULE STOCK DASHBOARD
## Manchengo Smart ERP - Janvier 2026

**Auditeur**: CTO Externe / Expert ERP Industriel Alimentaire  
**Date**: 29 Janvier 2026  
**Version Module**: 1.1  
**Criticité Métier**: HAUTE (Stock alimentaire, traçabilité DLC, anti-fraude)

---

# 📊 SYNTHÈSE EXÉCUTIVE

| Domaine | Score | Verdict |
|---------|-------|---------|
| Backend | 78/100 | ⚠️ Acceptable |
| API & Endpoints | 72/100 | ⚠️ À améliorer |
| Base de données | 85/100 | ✅ Solide |
| Frontend | 70/100 | ⚠️ À améliorer |
| UX/UI | 75/100 | ⚠️ Acceptable |
| Sécurité & Anti-fraude | 82/100 | ✅ Solide |
| Structure & Code | 80/100 | ✅ Solide |
| Tests | 65/100 | ❌ Insuffisant |
| **SCORE GLOBAL** | **76/100** | ⚠️ **GO CONDITIONNEL** |

---

# 1️⃣ AUDIT BACKEND

## ✅ Points forts

### Architecture des services
- **Séparation claire** : `StockService`, `LotsService`, `InventoryService`, `StockDashboardService`
- **Matrice de validation métier** : `VALID_COMBINATIONS` bien définie (MP/PF × Origins × MovementType)
- **Transaction atomiques** : Utilisation de `$transaction` avec `isolationLevel: Serializable` pour production/vente

### Logique métier FIFO
```typescript
// lots.service.ts:201-279 - Consommation FIFO correcte
orderBy: [
  { expiryDate: 'asc' },
  { manufactureDate: 'asc' },
  { createdAt: 'asc' },
]
```
- Tri correct par DLC puis date fabrication puis création
- Blocage lots expirés avant consommation

### Inventaire sécurisé
- Seuils de tolérance différenciés (MP périssable: 2%/5%, PF: 1%/3%)
- Cooldown 4h entre inventaires même produit
- Détection patterns suspects (écarts négatifs consécutifs)
- Compteur ≠ Validateur (OBLIGATOIRE)

### Job CRON DLC
```typescript
// lot-expiry.job.ts - Blocage automatique DLC
@Cron('5 0 * * *') // 00:05 chaque jour
async blockExpiredLots()
```

## ❌ Problèmes critiques (P0)

### 1. Inventory Service incomplet - Types Prisma manquants
```
Module '"@prisma/client"' has no exported member 'InventoryStatus'.
Module '"@prisma/client"' has no exported member 'InventoryRiskLevel'.
Property 'inventoryDeclaration' does not exist on type 'PrismaService'.
```
**Impact**: Le service `InventoryService` ne compile pas. Fonctionnalité inventaire bloquée.  
**Action**: Exécuter `npx prisma generate` après modification du schema.

### 2. Calcul stock par mouvements - Performance
```typescript
// stock.service.ts:128-151
async calculateStock() {
  const movements = await this.prisma.stockMovement.groupBy({...})
}
```
**Risque**: Appel BDD pour CHAQUE produit dans `getStockMp()`. O(n) requêtes.  
**Impact**: Lenteur avec +500 produits.  
**Recommandation**: Vue matérialisée ou cache Redis.

## ⚠️ Risques métier (P1)

### 3. Pas de verrou optimiste sur lots
```typescript
// lots.service.ts:260-265 - Update sans vérification version
await this.prisma.lotMp.update({
  where: { id: lot.id },
  data: { quantityRemaining: newQuantity }
});
```
**Risque**: Race condition si 2 productions simultanées sur même lot.  
**Recommandation**: Ajouter champ `version` et vérifier dans UPDATE.

### 4. AuditService injecté mais pas mocké dans tests
```typescript
// stock.service.ts:71-73
constructor(
  private prisma: PrismaService,
  private auditService: AuditService, // Non mocké dans tests
)
```

---

# 2️⃣ AUDIT API & ENDPOINTS

## Liste des endpoints Stock

| Méthode | Endpoint | Rôles | Validation DTO | Risque |
|---------|----------|-------|----------------|--------|
| GET | `/stock/mp` | ADMIN, APPRO, PRODUCTION | ❌ Query non validée | ⚠️ Moyen |
| GET | `/stock/mp/:id/stock` | Tous auth | ✅ ParseIntPipe | ✅ OK |
| GET | `/stock/mp/:id/movements` | Tous auth | ⚠️ limit non validé | ⚠️ Faible |
| POST | `/stock/mp/receptions` | ADMIN, APPRO | ❌ Body `any` | ❌ **Critique** |
| POST | `/stock/mp/inventory` | ADMIN | ❌ Body `any` | ❌ **Critique** |
| GET | `/stock/pf` | ADMIN, COMMERCIAL, PRODUCTION | ❌ Query non validée | ⚠️ Moyen |
| POST | `/stock/pf/inventory` | ADMIN | ❌ Body `any` | ❌ **Critique** |
| POST | `/stock/production/complete` | ADMIN, PRODUCTION | ❌ Body `any` | ❌ **Critique** |
| GET | `/stock/alerts` | Tous auth | ✅ | ✅ OK |
| GET | `/stock/value` | Tous auth | ✅ | ✅ OK |

## ❌ Problèmes critiques (P0)

### 1. ABSENCE TOTALE DE DTO VALIDATION
```typescript
// stock.controller.ts:95
async createReception(@Body() body: any, @Request() req: any) {
```
**Impact**: Aucune validation des entrées. Injection de données malformées possible.  
**Recommandation IMMÉDIATE**:
```typescript
// Créer CreateReceptionDto avec class-validator
@IsNumber() supplierId: number;
@IsDate() date: Date;
@IsArray() @ValidateNested() lines: ReceptionLineDto[];
```

### 2. Données financières exposées sans filtrage cohérent
```typescript
// stock.controller.ts:35-46 - Masquage manuel pour PRODUCTION
if (req.user?.role === 'PRODUCTION') {
  return data.map(item => ({...})); // Masquer priceHt, stockValue
}
```
**Risque**: Si oubli dans un autre endpoint, données financières exposées.  
**Recommandation**: Serializer global avec `@Exclude()` decorators.

## ⚠️ Risques (P1)

### 3. Endpoint `/stock/mp/:id/movements` - limit injectable
```typescript
@Query('limit') limit?: string
return this.stockService.getMovements('MP', id, limit ? parseInt(limit) : 50);
```
**Risque**: `limit=999999` → DoS par surcharge mémoire.  
**Recommandation**: `@Max(200) @Min(1) limit: number = 50`

---

# 3️⃣ AUDIT BASE DE DONNÉES

## ✅ Points forts

### Modèle bien structuré
- **Lots MP/PF** : `LotStatus` (AVAILABLE, BLOCKED, CONSUMED) correctement défini
- **Stock Movements** : Traçabilité complète (origin, referenceType, referenceId, userId)
- **Inventory Declarations** : Workflow complet (PENDING → AUTO_APPROVED/PENDING_VALIDATION → APPROVED)

### Index optimisés pour FIFO
```prisma
@@index([productId, status, createdAt, expiryDate], map: "idx_lots_mp_fifo")
```

### Soft delete sur mouvements
```prisma
isDeleted Boolean @default(false)
deletedAt DateTime?
deletedBy String?
deleteReason String?
```

### Clé d'idempotence
```prisma
idempotencyKey String? @unique // Protection double-clic
```

## ⚠️ Risques (P1)

### 1. Pas de contrainte CHECK sur quantity
**Risque**: `quantity` peut être négatif en BDD malgré validation service.  
**Recommandation**:
```sql
ALTER TABLE stock_movements ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
```

### 2. Pas de foreign key vers InventoryDeclaration dans tous les cas
```prisma
inventoryDeclarationId Int? // Nullable - peut être orphelin
```

### 3. Champs fiscaux fournisseur avec defaults "MIGRATED"
```prisma
rc String @default("MIGRATED") // Registre de Commerce
nif String @default("000000000000000")
```
**Risque**: Données non conformes en production.

---

# 4️⃣ AUDIT FRONTEND

## ✅ Points forts

### Architecture composants
- Dashboard 3 zones (Critique, À traiter, Santé) - bonne séparation
- Composants réutilisables (`ZoneCritique`, `ZoneATraiter`, `ZoneSante`)
- Auto-refresh 5 minutes

### Gestion des états
```typescript
// stock/page.tsx:23-25
const [isLoading, setIsLoading] = useState(true);
const [isRefreshing, setIsRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);
```

## ❌ Problèmes (P0)

### 1. Actions non implémentées
```typescript
// stock/page.tsx:56-67
const handleAction = async (type: string, id: number) => {
  switch (type) {
    case 'BLOQUER_LOT':
      toast.warning(`Blocage lot #${id} - à implémenter`); // ❌ NON IMPLÉMENTÉ
  }
};
```
**Impact**: Boutons CTA critiques non fonctionnels.

### 2. Pas de gestion optimiste des erreurs
Les mutations (inventory adjust, loss declaration) n'ont pas de rollback UI en cas d'échec.

## ⚠️ Risques (P1)

### 3. Couplage fort avec structure API
Les pages attendent une structure spécifique (`data.critique.lotsExpiresToday`). Pas de couche d'abstraction.

### 4. Liens frontend hardcodés
```typescript
actionLink: `/stock/lots/mp/${lot.id}/loss` // Route peut ne pas exister
```

---

# 5️⃣ AUDIT UX/UI

## ✅ Points forts

- **Hiérarchie visuelle claire** : 3 zones avec couleurs distinctes (rouge/orange/vert)
- **Alertes CRITICAL non dismissable** : Bonne pratique
- **Health Score visible** : Indicateur synthétique 0-100
- **Auto-refresh** : Données à jour sans action utilisateur

## ⚠️ Risques (P1)

### 1. CTA critiques potentiellement ignorés
Les alertes `SOON_EXPIRED` (J-7, J-3) sont dismissable → risque d'oubli.  
**Recommandation**: J-1 et J-0 non dismissable.

### 2. Pas de confirmation sur actions destructives
Blocage lot, déclaration perte → pas de modal de confirmation.

### 3. Charge cognitive élevée
Zone "À traiter" peut contenir 50+ items. Pagination requise.

---

# 6️⃣ AUDIT SÉCURITÉ & ANTI-FRAUDE

## ✅ Points forts

### FIFO non contournable
- Consommation FIFO forcée dans `LotsService.consumeMpFifo()`
- Pas d'endpoint pour sélectionner manuellement un lot

### Inventaire sécurisé
- **Compteur ≠ Validateur** : Vérifié et audité
```typescript
if (declaration.countedById === validatedById) {
  throw new ForbiddenException({ code: 'SELF_VALIDATION_FORBIDDEN' });
}
```
- **Double validation** : Pour écarts >5% ou valeur >50,000 DA
- **Cooldown 4h** : Empêche inventaires répétés suspects
- **Détection pattern** : Écarts négatifs consécutifs flaggés

### Rôles par origine mouvement
```typescript
const ORIGIN_ROLES: Record<MovementOrigin, UserRole[]> = {
  INVENTAIRE: ['ADMIN'],
  PERTE: ['ADMIN'],
};
```

### Audit trail complet
- `AuditService.log()` sur chaque mouvement
- Severity CRITICAL pour inventaires
- Before/After state capturé

## ⚠️ Risques (P1)

### 1. ADMIN peut être malveillant
**Scénario**: ADMIN crée faux inventaire → mouvement d'ajustement → vol marchandise.  
**Mitigation actuelle**: Logs audit, détection pattern.  
**Recommandation**: Alertes temps réel si ADMIN fait >3 inventaires/jour avec écarts négatifs.

### 2. Pas de rate limiting sur endpoints sensibles
`/stock/mp/inventory` peut être appelé en boucle malgré cooldown (contournable via produits différents).

---

# 7️⃣ AUDIT STRUCTURE & QUALITÉ CODE

## ✅ Points forts

- **Organisation modulaire** : `/stock/`, `/lots/`, `/appro/` bien séparés
- **Nommage cohérent** : `*.service.ts`, `*.controller.ts`, `*.spec.ts`
- **Documentation inline** : Headers de fichiers explicites avec règles métier
- **TypeScript strict** : Types bien définis (`StockLevel`, `LotInfo`, etc.)

## ⚠️ Risques (P1)

### 1. Duplication logique calcul stock
`StockService.calculateStock()` vs `LotsService` (aggregate sur lots).  
Deux sources de vérité potentiellement divergentes.

### 2. Fichiers volumineux
- `stock.service.ts` : 740 lignes
- `stock-dashboard.service.ts` : 811 lignes
- `inventory.service.ts` : 817 lignes

**Recommandation**: Extraire en sous-services (ex: `StockCalculationService`).

---

# 8️⃣ AUDIT TESTS

## ✅ Points forts

### Tests unitaires métier présents
```typescript
// stock.service.spec.ts - Business Invariant Tests
describe('INVARIANT: Stock cannot go negative', () => {
  it('should throw when OUT movement exceeds available stock')
  it('should throw when OUT on zero stock')
  it('should allow OUT when stock exactly matches')
});
```

### Tests d'intégration
- `stock-integration.spec.ts` (10KB)
- `business-rules.spec.ts` (16KB)

## ❌ Problèmes critiques (P0)

### 1. Tests E2E non fonctionnels
```
Cannot find module '@playwright/test'
```
Les tests E2E (`stock-dashboard.spec.ts`) ne s'exécutent pas.

### 2. Couverture inconnue
Pas de rapport de couverture visible. Estimation: 40-50%.

### 3. Cas limites non testés
- Consommation FIFO avec lots expirés mélangés
- Double validation avec rejection
- Race conditions production simultanée
- Inventaire avec valeur >50,000 DA

---

# 9️⃣ SCORE FINAL & VERDICT

## Scores par domaine

| Domaine | Score | Justification |
|---------|-------|---------------|
| Backend | 78/100 | Bonne architecture, mais InventoryService cassé |
| API | 72/100 | ABSENCE DE DTO VALIDATION critique |
| BDD | 85/100 | Modèle solide, index optimisés |
| Frontend | 70/100 | Actions non implémentées |
| UX/UI | 75/100 | Bonne hiérarchie, mais charge cognitive |
| Sécurité | 82/100 | Anti-fraude robuste |
| Structure | 80/100 | Bien organisé, quelques duplications |
| Tests | 65/100 | Présents mais incomplets, E2E cassés |

## **SCORE GLOBAL: 76/100**

---

# 🔴 NON NÉGOCIABLE (Avant mise en prod)

| # | Item | Priorité | Effort |
|---|------|----------|--------|
| 1 | Créer DTOs avec class-validator pour TOUS les POST | P0 | 2j |
| 2 | Exécuter `prisma generate` pour InventoryService | P0 | 1h |
| 3 | Implémenter actions critiques frontend (blocage lot, perte) | P0 | 1j |
| 4 | Fixer tests E2E Playwright | P0 | 0.5j |

---

# 🟠 ACCEPTABLE TEMPORAIREMENT

| # | Item | Priorité | Délai max |
|---|------|----------|-----------|
| 5 | Cache Redis pour calcul stock | P1 | 2 semaines |
| 6 | Verrou optimiste sur lots | P1 | 2 semaines |
| 7 | Rate limiting endpoints sensibles | P1 | 1 semaine |
| 8 | Pagination zone "À traiter" | P2 | 1 mois |
| 9 | Refactoring services volumineux | P2 | 1 mois |

---

# 🚦 VERDICT FINAL

## ⚠️ **GO CONDITIONNEL**

Le module Stock Dashboard est **fonctionnellement solide** avec une bonne architecture et des protections anti-fraude robustes. Cependant:

### Bloquants avant production:
1. **DTO Validation** - Risque injection données
2. **InventoryService** - Ne compile pas
3. **Actions frontend** - CTA critiques non fonctionnels
4. **Tests E2E** - Cassés

### Recommandation:
- **Sprint correctif 3-4 jours** avant mise en production
- Tests manuels complets workflow inventaire
- Surveillance étroite premiers 30 jours (alertes ADMIN sur écarts)

---

**Signature Auditeur**: ________________  
**Date**: 29/01/2026  
**Prochaine revue**: Après corrections P0

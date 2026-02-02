# 🔧 PLAN DE CORRECTION MODULE STOCK — EXÉCUTION 14 JOURS

**Date**: 28 Janvier 2026  
**Objectif**: Rendre le module Stock production-ready terrain (alimentaire)  
**Score actuel**: 50/100 → **Cible**: 85/100

---

# 1️⃣ PÉRIMÈTRE DE CORRECTION

## ✅ DANS LE SCOPE
- Logique métier Stock (mouvements, calculs)
- Process Inventaire complet
- FIFO & gestion lots/DLC
- Sécurité métier anti-fraude
- Dashboard Stock actionnable

## ❌ HORS SCOPE
- Nouvelles features non stock
- Refonte UI esthétique
- ML / prédiction
- Multi-entrepôt

---

# 2️⃣ CORRECTIONS P0 — BLOQUANTES PROD

## P0.1 — FIFO BASIQUE FONCTIONNEL

### Règle Métier Finale
> Toute sortie MP consomme les lots par: Date réception ASC, puis DLC ASC.
> **AUCUN bypass manuel.**

### Backend: `lot-consumption.service.ts`

```typescript
@Injectable()
export class LotConsumptionService {
  async consumeFIFO(productId: number, qty: number, reason: string, userId: string) {
    // 1. Lots disponibles triés FIFO
    const lots = await this.prisma.lotMp.findMany({
      where: { productMpId: productId, status: 'AVAILABLE', quantityRemaining: { gt: 0 } },
      orderBy: [{ receptionDate: 'asc' }, { expiryDate: 'asc' }],
    });

    // 2. Vérifier stock suffisant
    const total = lots.reduce((s, l) => s + l.quantityRemaining.toNumber(), 0);
    if (total < qty) throw new BadRequestException('INSUFFICIENT_STOCK_FIFO');

    // 3. Consommer séquentiellement
    let remaining = qty;
    const consumptions = [];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.quantityRemaining.toNumber(), remaining);
      consumptions.push({ lotId: lot.id, quantity: take });
      remaining -= take;
    }

    // 4. Transaction: mise à jour lots + mouvements
    await this.prisma.$transaction(async (tx) => {
      for (const c of consumptions) {
        const lot = await tx.lotMp.findUnique({ where: { id: c.lotId } });
        const newQty = lot.quantityRemaining.toNumber() - c.quantity;
        await tx.lotMp.update({
          where: { id: c.lotId },
          data: { quantityRemaining: newQty, status: newQty <= 0 ? 'CONSUMED' : 'AVAILABLE' },
        });
        await tx.stockMovement.create({
          data: { type: 'OUT', origin: reason, productType: 'MP', productId,
                  lotMpId: c.lotId, quantity: -c.quantity, userId },
        });
      }
    });
    return { consumptions, totalConsumed: qty };
  }
}
```

### BDD
```sql
CREATE INDEX idx_lots_mp_fifo ON lots_mp (product_mp_id, status, reception_date, expiry_date)
WHERE status = 'AVAILABLE' AND quantity_remaining > 0;
ALTER TABLE stock_movements ADD COLUMN lot_mp_id INTEGER REFERENCES lots_mp(id);
```

---

## P0.2 — BLOCAGE AUTO LOTS DLC DÉPASSÉE

### Règle Métier
> Lot DLC dépassée = BLOCKED automatiquement. Seul mouvement: PERTE.

### Job CRON quotidien

```typescript
@Cron('5 0 * * *')
async blockExpiredLots() {
  const today = new Date(); today.setHours(0,0,0,0);
  
  const expired = await this.prisma.lotMp.findMany({
    where: { expiryDate: { lt: today }, status: 'AVAILABLE' },
  });
  
  await this.prisma.lotMp.updateMany({
    where: { id: { in: expired.map(l => l.id) } },
    data: { status: 'BLOCKED', blockedAt: new Date(), blockedReason: 'DLC_EXPIRED_AUTO' },
  });
  
  if (expired.length) await this.alert.sendCritical('LOTS_EXPIRED_BLOCKED', { count: expired.length });
}

@Cron('0 8 * * *')
async alertExpiringLots() {
  for (const days of [7, 3, 1]) {
    const target = addDays(new Date(), days);
    const lots = await this.prisma.lotMp.findMany({
      where: { expiryDate: { lte: target, gte: new Date() }, status: 'AVAILABLE' },
    });
    if (lots.length) await this.alert.send({ type: `LOTS_EXPIRING_J${days}`, count: lots.length });
  }
}
```

---

## P0.3 — INVENTAIRE AVEC SEUILS

### Seuils de Tolérance

| Type | Auto-Approuvé | Validation Simple | Double Validation |
|------|---------------|-------------------|-------------------|
| MP périssable | ≤2% | 2-5% | >5% ou >50kDA |
| MP non périssable | ≤3% | 3-8% | >8% ou >50kDA |
| PF | ≤1% | 1-3% | >3% ou >50kDA |

### Process Inventaire

```
COMPTEUR → Déclare quantité → SYSTÈME analyse écart
                                    ↓
           ┌────────────────────────┼────────────────────────┐
           ↓                        ↓                        ↓
       [≤ seuil 1]            [seuil 1-2]             [> seuil 2]
    Auto-approuvé         Validation ADMIN         Double validation
    Mouvement créé        (différent compteur)     (2 ADMIN différents)
```

### Backend: InventoryService

```typescript
async declareInventory(data, countedBy: string, role: UserRole) {
  const theoretical = await this.calculateStock(data.productType, data.productId);
  const diff = data.declaredQuantity - theoretical;
  const pct = theoretical > 0 ? Math.abs(diff / theoretical) * 100 : 100;
  
  const tolerance = TOLERANCES[this.getToleranceKey(data.productType, data.productId)];
  
  let status: InventoryStatus;
  if (pct <= tolerance.autoApprove) status = 'AUTO_APPROVED';
  else if (pct <= tolerance.singleValidation) status = 'PENDING_VALIDATION';
  else status = 'PENDING_DOUBLE_VALIDATION';
  
  const decl = await this.prisma.inventoryDeclaration.create({
    data: { ...data, theoreticalStock: theoretical, difference: diff,
            differencePercent: pct, status, countedById: countedBy },
  });
  
  if (status === 'AUTO_APPROVED' && diff !== 0) {
    await this.createAdjustmentMovement(decl.id, countedBy);
  }
  return { declarationId: decl.id, status, differencePercent: pct };
}

async validateInventory(declId: number, reason: string, validatedBy: string) {
  const decl = await this.prisma.inventoryDeclaration.findUnique({ where: { id: declId } });
  
  if (decl.countedById === validatedBy)
    throw new ForbiddenException('Validateur ≠ Compteur obligatoire');
  
  if (decl.status === 'PENDING_DOUBLE_VALIDATION' && !decl.firstValidatorId) {
    await this.prisma.inventoryDeclaration.update({
      where: { id: declId },
      data: { firstValidatorId: validatedBy, firstValidatedAt: new Date() },
    });
    return; // Attendre 2ème validation
  }
  
  await this.prisma.inventoryDeclaration.update({
    where: { id: declId },
    data: { status: 'APPROVED', validatedById: validatedBy, validatedAt: new Date() },
  });
  await this.createAdjustmentMovement(declId, validatedBy);
}
```

### BDD

```sql
CREATE TABLE inventory_declarations (
  id SERIAL PRIMARY KEY,
  product_type VARCHAR(2) NOT NULL,
  product_id INTEGER NOT NULL,
  theoretical_stock DECIMAL(15,3) NOT NULL,
  declared_stock DECIMAL(15,3) NOT NULL,
  difference DECIMAL(15,3) NOT NULL,
  difference_percent DECIMAL(5,2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  counted_by_id INTEGER NOT NULL REFERENCES users(id),
  counted_at TIMESTAMP DEFAULT NOW(),
  first_validator_id INTEGER REFERENCES users(id),
  validated_by_id INTEGER REFERENCES users(id),
  validated_at TIMESTAMP,
  validation_reason TEXT,
  CONSTRAINT chk_validator_not_counter CHECK (validated_by_id != counted_by_id)
);

ALTER TABLE products_mp ADD COLUMN last_physical_stock DECIMAL(15,3);
ALTER TABLE products_mp ADD COLUMN last_physical_stock_date TIMESTAMP;
```

---

## P0.4 — STOCK THÉORIQUE VS PHYSIQUE

### Backend

```typescript
interface StockState {
  theoretical: number;
  lastPhysical: number | null;
  lastPhysicalDate: Date | null;
  drift: number | null;
  inventoryOverdue: boolean; // >30j
}

async getStockState(productType: 'MP'|'PF', productId: number): Promise<StockState> {
  const theoretical = await this.calculateStock(productType, productId);
  const product = await this.getProduct(productType, productId);
  
  return {
    theoretical,
    lastPhysical: product.lastPhysicalStock,
    lastPhysicalDate: product.lastPhysicalStockDate,
    drift: product.lastPhysicalStock ? theoretical - product.lastPhysicalStock : null,
    inventoryOverdue: product.lastPhysicalStockDate 
      ? daysSince(product.lastPhysicalStockDate) > 30 : true,
  };
}
```

### Frontend
```
Stock théorique: 1,250 L
Dernier physique: 1,230 L (il y a 15j)
Écart: +20 L (+1.6%)  ✅
```

---

# 3️⃣ FIFO — DÉCISION FINALE

## VERDICT: **FIFO = P0 BLOQUANT**

| Critère | Impact |
|---------|--------|
| Alimentaire | DLC = obligation légale |
| Risque sanitaire | Vente périmé = rappel |
| Pertes | Sans FIFO, lots anciens périment |
| Traçabilité | Impossible sans gestion lot |

**Un ERP alimentaire SANS FIFO fonctionnel n'est pas exploitable.**

---

# 4️⃣ DASHBOARD STOCK — VERSION PILOTAGE

## 3 Zones

### 🔴 CRITIQUE (Action immédiate)
| Indicateur | CTA |
|------------|-----|
| Lots expirés bloqués | "Déclarer pertes" |
| Produits en rupture | "Commander urgent" |
| Lots expirent aujourd'hui | "Écouler maintenant" |

### 🟠 À TRAITER (Cette semaine)
| Indicateur | CTA |
|------------|-----|
| MP sous seuil | "Créer demande appro" |
| Lots J-7 | "Prioriser production" |
| Inventaire retard >30j | "Lancer inventaire" |

### 🟢 SANTÉ
| Métrique | Bon | Attention |
|----------|-----|-----------|
| FIFO Compliance | ≥95% | <80% |
| Fraîcheur Inventaire | ≤15j | >30j |
| Écart Moyen | ≤2% | >5% |

---

# 5️⃣ SÉCURITÉ MÉTIER

## Comportements Suspects Détectés

| Pattern | Seuil | Alerte |
|---------|-------|--------|
| Inventaires répétés même produit | >3/semaine | 🔴 CRITICAL |
| Écarts toujours négatifs | >5 consécutifs | 🟠 WARNING |
| Activité 22h-6h | Tout | 🟡 INFO |
| Volume >3x moyenne | 1 jour | 🟠 WARNING |

## Logs Obligatoires
- ✅ Tout mouvement (succès)
- ✅ Tout échec (stock insuffisant, rôle invalide, lot bloqué)
- ✅ Toute tentative validation propre déclaration

## Actions avec Contre-Pouvoir

| Action | Exigence |
|--------|----------|
| Inventaire >5% | Validation ADMIN ≠ compteur |
| Inventaire >10% | 2 ADMIN différents |
| Déblocage lot expiré | INTERDIT |
| Modification mouvement | INTERDIT (correctif uniquement) |

---

# 6️⃣ PLAN D'EXÉCUTION 14 JOURS

| Jour | Action | Livrable |
|------|--------|----------|
| J1 | Migration BDD (index FIFO, table inventory) | Scripts appliqués |
| J2 | LotConsumptionService + LotExpiryJob | Services testés |
| J3 | InventoryService (déclaration + analyse) | Workflow LOW/MEDIUM |
| J4 | Intégration FIFO dans ProductionService | completeProduction OK |
| J5 | Double validation + Endpoints inventaire | Workflow CRITICAL |
| J6 | StockState + Alertes pré-expiration | API enrichie |
| **J7** | **REVUE MI-PARCOURS** | Go/No-Go |
| J8 | Frontend: lots FIFO + inventaire | Formulaires fonctionnels |
| J9 | Frontend: dashboard 3 zones | Alertes + CTA |
| J10 | Détection comportements suspects | Jobs + alertes |
| J11 | Tests intégration complets | Coverage 85%+ |
| J12 | Tests UAT avec données réelles | Validation métier |
| J13 | Fix bugs UAT + documentation | Manuel utilisateur |
| **J14** | **GO PROD** | Module déployé |

---

# 7️⃣ CRITÈRES GO PROD

## ✅ GO si:
- [ ] FIFO fonctionnel sur toutes sorties MP
- [ ] Blocage auto lots DLC dépassée
- [ ] Inventaire avec seuils et validation
- [ ] Double validation écarts >10%
- [ ] Stock théorique/physique affiché
- [ ] Dashboard avec alertes critiques
- [ ] Tests intégration passent

## ❌ NO-GO si:
- Un seul P0 non livré
- Tests intégration <80%
- Bug bloquant non résolu
- Validation métier non signée

---

**FIN DU PLAN DE CORRECTION**

*Ce document est la référence d'exécution. Aucune feature hors scope. Aucun compromis sur les P0.*

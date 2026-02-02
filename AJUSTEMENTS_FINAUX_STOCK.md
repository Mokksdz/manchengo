# 🔒 AJUSTEMENTS FINAUX — MODULE STOCK

**Date**: 28 Janvier 2026  
**Statut**: Verrouillage pré-production  
**Objectif**: Éliminer les angles morts avant GO PROD

---

# 1️⃣ AJUSTEMENTS TECHNIQUES CRITIQUES

## T1. Race Condition sur Consommation FIFO

**Problème évité**: Deux requêtes simultanées consomment le même lot → quantityRemaining < 0

**Ajustement**:
```typescript
// Ajouter SELECT FOR UPDATE dans la transaction
const lots = await tx.$queryRaw`
  SELECT * FROM lots_mp
  WHERE product_mp_id = ${productId}
    AND status = 'AVAILABLE'
    AND quantity_remaining > 0
  ORDER BY reception_date ASC, expiry_date ASC
  FOR UPDATE SKIP LOCKED
`;
```

**Impact**: Faible (1 ligne SQL)

---

## T2. Contrainte BDD quantité négative

**Problème évité**: Bug applicatif → stock négatif en base

**Ajustement**:
```sql
ALTER TABLE lots_mp ADD CONSTRAINT chk_qty_positive 
  CHECK (quantity_remaining >= 0);

ALTER TABLE lots_pf ADD CONSTRAINT chk_qty_positive 
  CHECK (quantity_remaining >= 0);
```

**Impact**: Faible (migration)

---

## T3. Validation DTO stricte sur quantités

**Problème évité**: Injection de valeurs négatives ou NaN via API

**Ajustement**:
```typescript
// Dans tous les DTOs stock
@IsNumber()
@IsPositive()
@Max(999999) // Éviter overflow
quantity: number;
```

**Impact**: Faible (validation DTO)

---

## T4. Timeout transaction FIFO

**Problème évité**: Lock infini si transaction échoue silencieusement

**Ajustement**:
```typescript
await this.prisma.$transaction(async (tx) => {
  // ... logique FIFO
}, {
  timeout: 10000,        // 10s max
  isolationLevel: 'Serializable',
});
```

**Impact**: Faible (config transaction)

---

## T5. Idempotence création mouvement

**Problème évité**: Double-clic → double mouvement

**Ajustement**:
```typescript
// Ajouter champ idempotencyKey sur stockMovement
// Unique par (userId, origin, productId, idempotencyKey)
const existing = await tx.stockMovement.findFirst({
  where: { idempotencyKey: data.idempotencyKey },
});
if (existing) return existing; // Retourner existant sans créer
```

**Impact**: Moyen (champ BDD + logique)

---

# 2️⃣ AJUSTEMENTS INVENTAIRE (ANTI-CONTOURNEMENT)

## I1. Contrainte BDD validateur ≠ compteur

**Problème évité**: Bypass applicatif de la règle métier

**Ajustement**:
```sql
-- Déjà prévu, VÉRIFIER présence
ALTER TABLE inventory_declarations 
  ADD CONSTRAINT chk_validator_not_counter 
  CHECK (validated_by_id IS NULL OR validated_by_id != counted_by_id);

ALTER TABLE inventory_declarations 
  ADD CONSTRAINT chk_first_validator_not_counter 
  CHECK (first_validator_id IS NULL OR first_validator_id != counted_by_id);
```

**Impact**: Faible (contrainte BDD)

---

## I2. Cooldown inventaire même produit

**Problème évité**: Spam d'inventaires pour masquer écarts

**Ajustement**:
```typescript
// Avant création déclaration
const lastDecl = await this.prisma.inventoryDeclaration.findFirst({
  where: { productId, productType, countedAt: { gte: subHours(new Date(), 4) } },
  orderBy: { countedAt: 'desc' },
});

if (lastDecl && lastDecl.status !== 'REJECTED') {
  throw new BadRequestException({
    code: 'INVENTORY_COOLDOWN',
    message: 'Inventaire déjà effectué il y a moins de 4h',
    lastInventoryAt: lastDecl.countedAt,
  });
}
```

**Impact**: Faible (1 check)

---

## I3. Audit log MÊME sur auto-approval

**Problème évité**: Petits écarts répétés passent sous le radar

**Ajustement**:
```typescript
// TOUJOURS logger, même si AUTO_APPROVED
await this.audit.log({
  actor: { id: countedBy, role },
  action: 'INVENTORY_AUTO_APPROVED',
  severity: 'INFO',
  entityType: productType === 'MP' ? 'ProductMp' : 'ProductPf',
  entityId: String(productId),
  metadata: {
    declarationId: decl.id,
    difference: diff,
    differencePercent: pct,
    autoApproved: true, // Flag explicite
  },
});
```

**Impact**: Faible (déjà prévu, vérifier implémentation)

---

## I4. Expiration déclaration non validée

**Problème évité**: Déclarations orphelines qui traînent

**Ajustement**:
```typescript
// Job CRON quotidien
@Cron('0 6 * * *')
async expireStaleDeclarations() {
  const staleThreshold = subHours(new Date(), 24);
  
  await this.prisma.inventoryDeclaration.updateMany({
    where: {
      status: { in: ['PENDING_VALIDATION', 'PENDING_DOUBLE_VALIDATION'] },
      countedAt: { lt: staleThreshold },
    },
    data: {
      status: 'EXPIRED',
      expiredAt: new Date(),
    },
  });
}
```

**Impact**: Faible (job CRON)

---

## I5. Blocage si écarts successifs même sens

**Problème évité**: Vol progressif par petits ajustements négatifs

**Ajustement**:
```typescript
// Dans declareInventory, après calcul écart
const recentDecls = await this.prisma.inventoryDeclaration.findMany({
  where: { 
    productId, productType, 
    countedById: countedBy,
    countedAt: { gte: subDays(new Date(), 30) },
    status: { in: ['AUTO_APPROVED', 'APPROVED'] },
  },
  orderBy: { countedAt: 'desc' },
  take: 5,
});

const allNegative = recentDecls.length >= 3 && 
  recentDecls.every(d => d.difference < 0);

if (allNegative) {
  // Forcer validation même si sous seuil
  status = 'PENDING_VALIDATION';
  await this.alert.send({
    type: 'SUSPICIOUS_INVENTORY_PATTERN',
    severity: 'WARNING',
    userId: countedBy,
    pattern: 'CONSECUTIVE_NEGATIVE',
  });
}
```

**Impact**: Moyen (logique supplémentaire)

---

# 3️⃣ FIFO & LOTS — SÉCURISATION FINALE

## F1. Double vérification statut lot avant consommation

**Problème évité**: Lot bloqué entre SELECT et UPDATE

**Ajustement**:
```typescript
// Dans la boucle de consommation, RE-VÉRIFIER
for (const c of consumptions) {
  const lot = await tx.lotMp.findUnique({ 
    where: { id: c.lotId },
    select: { status: true, quantityRemaining: true },
  });
  
  if (lot.status !== 'AVAILABLE') {
    throw new ConflictException(`Lot ${c.lotId} n'est plus disponible`);
  }
  
  if (lot.quantityRemaining.toNumber() < c.quantity) {
    throw new ConflictException(`Lot ${c.lotId} quantité insuffisante`);
  }
  
  // Puis UPDATE...
}
```

**Impact**: Faible (vérification défensive)

---

## F2. Trigger BDD blocage consommation lot BLOCKED

**Problème évité**: Bypass applicatif → sortie sur lot bloqué

**Ajustement**:
```sql
CREATE OR REPLACE FUNCTION prevent_blocked_lot_consumption()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'BLOCKED' AND NEW.quantity_remaining < OLD.quantity_remaining THEN
    RAISE EXCEPTION 'Cannot consume from BLOCKED lot %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_blocked_consumption
  BEFORE UPDATE ON lots_mp
  FOR EACH ROW EXECUTE FUNCTION prevent_blocked_lot_consumption();
```

**Impact**: Faible (trigger BDD)

---

## F3. Log mouvement avec snapshot lot

**Problème évité**: Impossible de reconstituer l'état du lot au moment du mouvement

**Ajustement**:
```typescript
// Dans création mouvement, ajouter snapshot
await tx.stockMovement.create({
  data: {
    // ... champs existants
    lotSnapshot: {
      quantityBefore: lot.quantityRemaining,
      quantityAfter: newQty,
      expiryDate: lot.expiryDate,
      receptionDate: lot.receptionDate,
    },
  },
});
```

**Impact**: Faible (champ JSON)

---

# 4️⃣ DASHBOARD — AJUSTEMENT PRODUIT

## D1. Ordre de priorité alertes CRITIQUE

**Problème évité**: Alerte importante noyée dans le bruit

**Ajustement** — Ordre obligatoire zone CRITIQUE:
1. **Lots expirés AUJOURD'HUI** (action immédiate)
2. **Produits en RUPTURE** (blocage opérationnel)
3. **Lots bloqués à déclarer perte** (valeur immobilisée)
4. **Inventaire écart CRITICAL en attente** (fraude potentielle)

---

## D2. CTA non masquable

**Problème évité**: Utilisateur ferme l'alerte sans agir

**Ajustement**:
```typescript
// Alertes CRITICAL = sticky, pas de dismiss
interface DashboardAlert {
  dismissable: boolean; // false si severity === 'CRITICAL'
  requiresAction: boolean;
  actionDeadline?: Date;
}
```

**Impact**: Faible (flag frontend)

---

## D3. Badge compteur alertes critiques

**Problème évité**: Dashboard ignoré, alertes non vues

**Ajustement**:
- Badge rouge permanent dans nav si alertes CRITICAL > 0
- Compteur visible même hors page dashboard
- Rafraîchissement toutes les 5 min

**Impact**: Faible (composant UI)

---

# 5️⃣ SÉCURITÉ MÉTIER — RÉGLAGES FINS

## S1. Ajustement seuils détection

| Pattern | Seuil Initial | Seuil Ajusté | Raison |
|---------|---------------|--------------|--------|
| Inventaires répétés | >3/semaine | >2/semaine | Plus conservateur |
| Écarts négatifs consécutifs | >5 | >3 | Détection plus rapide |
| Volume anormal | >3x moyenne | >2.5x moyenne | Sensibilité accrue |
| Activité hors horaires | 22h-6h | 21h-6h | Marge sécurité |

---

## S2. Regroupement alertes anti-spam

**Problème évité**: 50 alertes "lot expire J-7" → fatigue d'alerte

**Ajustement**:
```typescript
// Grouper alertes par type + période
interface AlertBatch {
  type: string;
  count: number;
  items: AlertItem[]; // Max 5 affichés, lien "voir tous"
  firstOccurrence: Date;
  lastOccurrence: Date;
}

// Max 1 alerte consolidée par type par 4h
const ALERT_COOLDOWN_HOURS = 4;
```

**Impact**: Moyen (logique alertes)

---

## S3. Escalade alertes ignorées

**Problème évité**: Alerte critique ignorée pendant des jours

**Ajustement**:
```typescript
// Si alerte CRITICAL non traitée > 24h
@Cron('0 9 * * *')
async escalateIgnoredAlerts() {
  const threshold = subHours(new Date(), 24);
  
  const ignored = await this.prisma.alert.findMany({
    where: {
      severity: 'CRITICAL',
      createdAt: { lt: threshold },
      resolvedAt: null,
    },
  });
  
  if (ignored.length > 0) {
    await this.notifyManagement({
      type: 'CRITICAL_ALERTS_IGNORED',
      count: ignored.length,
      alerts: ignored,
    });
  }
}
```

**Impact**: Faible (job CRON)

---

## S4. Rate limiting par action sensible

**Problème évité**: Abus automatisé ou erreur de script

**Ajustement**:

| Action | Limite | Fenêtre | Si dépassé |
|--------|--------|---------|------------|
| Déclaration inventaire | 10 | 1h | Block 1h |
| Mouvement PERTE | 5 | 1h | Alert ADMIN |
| Validation inventaire | 20 | 1h | Log WARNING |
| Création réception | 30 | 1h | Log INFO |

**Impact**: Moyen (middleware rate limit)

---

# 6️⃣ GO PROD — CONDITIONS FINALES

## ✅ 5 Critères de Validation Finale

| # | Critère | Vérification |
|---|---------|--------------|
| **1** | FIFO consomme dans l'ordre correct | Test avec 5 lots, vérifier ordre |
| **2** | Lot BLOCKED impossible à consommer | Test direct + via trigger |
| **3** | Inventaire: compteur ≠ validateur enforced | Test API + contrainte BDD |
| **4** | Double validation fonctionne | Test écart >10% avec 2 ADMIN |
| **5** | Alertes CRITICAL visibles et non dismissable | Test UI + persistence |

---

## 🛑 STOP Immédiat Si

| Condition | Action |
|-----------|--------|
| quantityRemaining < 0 détecté | Rollback + investigation |
| Mouvement sans audit log | Blocage déploiement |
| Validation propre déclaration réussie | Fix + re-test complet |
| Lot BLOCKED consommé | Fix trigger + audit |
| Transaction FIFO timeout fréquent (>1%) | Optimisation avant prod |

---

## ⚠️ Accepté Temporairement (Surveillance)

| Élément | Durée Max | Surveillance |
|---------|-----------|--------------|
| Dashboard sans badge nav | 2 semaines | Métrique consultation |
| Alertes non groupées | 1 semaine | Compteur alertes/jour |
| Rate limiting désactivé | 3 jours | Monitoring volume |
| Escalade non implémentée | 2 semaines | Review alertes quotidien |

---

# CHECKLIST PRÉ-DÉPLOIEMENT

```
□ Contraintes BDD appliquées (qty >= 0, validator ≠ counter)
□ Trigger blocage lot BLOCKED actif
□ Index FIFO créé et performant (<50ms)
□ Job expiration lots testé manuellement
□ Job expiration déclarations testé
□ Tests intégration FIFO: 100% pass
□ Tests intégration Inventaire: 100% pass
□ Test charge: 50 mouvements/min sans erreur
□ Alertes CRITICAL testées end-to-end
□ Documentation utilisateur inventaire validée
□ Formation équipe terrain effectuée
□ Backup BDD avant migration
□ Rollback plan documenté
```

---

**FIN DES AJUSTEMENTS**

*Ce document complète le Plan de Correction. Les ajustements sont des garde-fous, pas des features.*

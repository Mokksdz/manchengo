# PHASE 4: ERP UX ROBUSTNESS & OPERATIONAL SAFETY

**Date**: 5 Janvier 2026  
**Statut**: ✅ IMPLÉMENTÉ  
**Objectif**: L'ERP ne doit JAMAIS surprendre l'utilisateur

---

## 1. POURQUOI L'UX EST UN SYSTÈME DE SÉCURITÉ

### Contexte ERP Industriel

| Facteur | Impact |
|---------|--------|
| **Stress** | Opérateurs sous pression de production |
| **Fatigue** | Shifts de 8-12h, erreurs en fin de journée |
| **Multitâche** | Interruptions fréquentes |
| **Formation variable** | Pas tous des experts informatiques |

### Conséquences des erreurs UX

| Erreur UX | Impact Business |
|-----------|-----------------|
| Message d'erreur technique | Opérateur bloqué, appel support |
| Action sans confirmation | Stock corrompu, annulation accidentelle |
| Alerte invisible | Rupture non détectée, production arrêtée |
| État de chargement absent | Double-clic, doublons de données |

---

## 2. TAXONOMIE DES ERREURS

### Catégories

| Catégorie | Description | Action utilisateur | Severity UI |
|-----------|-------------|-------------------|-------------|
| **USER_ERROR** | Erreur de saisie corrigeable | L'utilisateur peut corriger | Warning |
| **BUSINESS_RULE** | Règle métier bloquante | Comprendre pourquoi, changer d'approche | Error |
| **SYSTEM_ERROR** | Problème technique | Réessayer ou contacter support | Error |

### Codes d'erreur → Messages utilisateur

```typescript
// Backend
throw ErpErrors.insufficientStock(50, 100, 'Lait Pasteurisé');

// Frontend reçoit
{
  "statusCode": 422,
  "error": "INSUFFICIENT_STOCK",
  "category": "BUSINESS_RULE",
  "message": "Stock insuffisant pour \"Lait Pasteurisé\"",
  "userAction": "Réduisez la quantité demandée ou attendez une nouvelle réception.",
  "context": { "available": 50, "requested": 100 }
}
```

### Mapping complet

| Code Backend | Titre UI | Message | Action |
|--------------|----------|---------|--------|
| `INSUFFICIENT_STOCK` | Stock insuffisant | La quantité dépasse le stock | Réduire la quantité |
| `ROLE_NOT_AUTHORIZED` | Accès refusé | Droits insuffisants | Contacter admin |
| `INVALID_STATE_TRANSITION` | Transition impossible | État incompatible | Vérifier état actuel |
| `PRODUCTION_BLOCKED` | Production bloquée | MP manquantes | Vérifier stocks |
| `NEGATIVE_QUANTITY` | Quantité invalide | Doit être positive | Corriger la saisie |
| `DATABASE_ERROR` | Erreur système | Problème technique | Réessayer |

---

## 3. ÉTATS UI SÉCURISÉS

### Principe: Chaque état possible est géré explicitement

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTATS POSSIBLES D'UN WIDGET                  │
├─────────────────────────────────────────────────────────────────┤
│  LOADING         → Spinner + message contextuel                 │
│  EMPTY           → Illustration + message + action              │
│  SUCCESS         → Données affichées                            │
│  PARTIAL_FAILURE → Certains widgets OK, banner d'alerte         │
│  ERROR           → Message + action + code support              │
│  DEGRADED        → Mode lecture seule, banner explicatif        │
│  OFFLINE         → Icône déconnexion + retry                    │
└─────────────────────────────────────────────────────────────────┘
```

### Composants créés

| Composant | Usage |
|-----------|-------|
| `EmptyState` | Aucune donnée (pas une erreur) |
| `LoadingState` | Opération en cours |
| `ErrorState` | Échec avec action |
| `OfflineState` | Connexion perdue |
| `PartialFailureBanner` | Certains widgets ont échoué |
| `DegradedModeBanner` | Mode lecture seule |
| `WidgetError` | Un widget spécifique a échoué |

### Exemple: Empty State

```tsx
<EmptyState
  title="Aucun produit en stock"
  description="Commencez par ajouter des produits ou effectuer une réception."
  action={{ 
    label: 'Ajouter un produit', 
    onClick: () => navigate('/products/new') 
  }}
/>
```

---

## 4. CONFIRMATIONS OBLIGATOIRES

### Actions nécessitant confirmation

| Action | Risque | Type de confirmation |
|--------|--------|---------------------|
| Ajustement stock (INVENTAIRE) | Corruption données | Checkbox + explication |
| Annulation production | Perte MP consommées | Taper "ANNULER" |
| Override manuel | Contournement règles | Taper "OVERRIDE" + checkbox |
| Désactivation utilisateur | Perte d'accès | Checkbox |
| Export données sensibles | Fuite données | Checkbox |

### Exemple: Confirmation annulation production

```tsx
<ProductionCancelConfirm
  open={showConfirm}
  onOpenChange={setShowConfirm}
  orderNumber="OP-240105-001"
  productName="Fromage Manchego 500g"
  consumedMp={[
    { name: 'Lait', quantity: 50 },
    { name: 'Présure', quantity: 0.5 }
  ]}
  onConfirm={handleCancel}
/>
```

**Ce que voit l'utilisateur:**

```
┌──────────────────────────────────────────────────────────────┐
│ ❌ Annuler l'ordre de production                             │
├──────────────────────────────────────────────────────────────┤
│ Cette action est irréversible.                               │
│                                                              │
│ Conséquences:                                                │
│ • L'ordre OP-240105-001 sera annulé définitivement          │
│ • Produit: Fromage Manchego 500g                            │
│ • Les matières premières consommées seront restituées:       │
│   - Lait: +50                                               │
│   - Présure: +0.5                                           │
│ • Cette action sera enregistrée dans le journal d'audit     │
│                                                              │
│ Tapez ANNULER pour confirmer:                               │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ ANNULER                                                  ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                         [Annuler]  [Annuler l'ordre]         │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. UX CONSCIENTE DE L'AUDIT

### Principe: L'utilisateur voit qui a fait quoi

#### Last Action Badge

Affiché en haut des pages de détail:

```
┌──────────────────────────────────────────────────────────────┐
│ Ordre de Production OP-240105-001                            │
│                                                              │
│ [👤 Ahmed B. • Démarré • 🕐 il y a 2h]                       │
└──────────────────────────────────────────────────────────────┘
```

#### Entity Audit Footer

En bas des cartes d'entité:

```
──────────────────────────────────────────────────────────────
Créé par Ahmed B. le 05/01/2026 à 14:32
Modifié par Sarah M. le 05/01/2026 à 16:45
```

#### Audit Timeline

Pour les entités critiques (ordres, mouvements):

```
Historique des actions
──────────────────────────────────────────────────────────────
✓ Créé                 Ahmed B. • PRODUCTION • 05/01 14:32
↻ Démarré              Ahmed B. • PRODUCTION • 05/01 14:45
   MP consommées selon recette
✓ Terminé              Ahmed B. • PRODUCTION • 05/01 16:30
   Lot PF-240105-001 créé
```

---

## 6. SURFACE DES ALERTES CRITIQUES

### Principe: Aucun échec silencieux

#### Types d'alertes

| Type | Severity | Affichage |
|------|----------|-----------|
| `stock_rupture` | CRITICAL | Banner rouge + indicateur header |
| `production_blocked` | CRITICAL | Banner orange + indicateur header |
| `security_incident` | CRITICAL | Banner plein écran (admin) |
| `threshold_breach` | WARNING | Badge module concerné |
| `expiry_warning` | WARNING | Liste dans module lots |

#### Alert Indicator (Header)

```
┌──────────────────────────────────────────────────────────────┐
│ 🏭 Manchengo ERP    [Dashboard] [Stock] [Production]  [🔔 3] │
└──────────────────────────────────────────────────────────────┘
                                                          ↑
                                              Badge rouge animé
                                              si alertes critiques
```

#### Alerts Panel

```
┌──────────────────────────────────────────────────────────────┐
│ 🔔 Alertes actives                                    [3]    │
├──────────────────────────────────────────────────────────────┤
│ ❌ Rupture de stock                          il y a 15 min  │
│    Lait Pasteurisé - Stock à 0                              │
│    [Voir] [Accuser réception]                               │
├──────────────────────────────────────────────────────────────┤
│ ⚠️ Production bloquée                        il y a 1h      │
│    OP-240105-002 - MP manquantes: Présure                   │
│    [Voir] [Accuser réception]                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. FICHIERS CRÉÉS

```
apps/backend/src/common/errors/
└── erp-error.ts                    # Taxonomie erreurs + factories

apps/web/src/lib/errors/
└── erp-error-handler.ts            # Traitement erreurs frontend

apps/web/src/components/ui/
├── safe-states.tsx                 # Empty, Loading, Error, Offline
├── critical-action-confirm.tsx     # Dialogues confirmation
├── audit-trail-display.tsx         # Affichage audit
└── critical-alerts.tsx             # Surface alertes
```

---

## 8. PATTERNS UX POUR ERP

### Pattern 1: Jamais de bouton "Supprimer" sans conséquences

❌ **Mauvais**:
```
[Supprimer]
```

✅ **Bon**:
```
[Annuler l'ordre]
→ Ouvre confirmation avec:
  - Explication des conséquences
  - Liste des données affectées
  - Checkbox "Je comprends"
```

### Pattern 2: Loading states informatifs

❌ **Mauvais**:
```
[Spinner]
```

✅ **Bon**:
```
[Spinner] Calcul du stock en cours...
          Ne fermez pas cette fenêtre.
```

### Pattern 3: Erreurs avec action

❌ **Mauvais**:
```
Erreur 422: Unprocessable Entity
```

✅ **Bon**:
```
Stock insuffisant

La quantité demandée (100) dépasse le stock disponible (50).

→ Réduisez la quantité ou attendez une nouvelle réception.

[Modifier la quantité]
```

### Pattern 4: Dégradation gracieuse

❌ **Mauvais**:
```
[Page blanche / crash]
```

✅ **Bon**:
```
┌────────────────────────────────────────────────┐
│ ⚠️ Mode lecture seule                          │
│ Le système fonctionne en mode dégradé.        │
│ Vous pouvez consulter mais pas modifier.      │
└────────────────────────────────────────────────┘

[Contenu en lecture seule affiché normalement]
```

---

## 9. COMMENT CELA RÉDUIT LES ERREURS HUMAINES

| Mécanisme | Erreur évitée |
|-----------|---------------|
| **Confirmation typée** | Double-clic accidentel, action précipitée |
| **Explication des conséquences** | Action sans comprendre l'impact |
| **Empty states explicites** | Confusion "pas de données" vs "erreur" |
| **Loading states** | Double soumission |
| **Alertes visibles** | Problème ignoré par manque de visibilité |
| **Audit visible** | "Qui a fait ça?" → réponse immédiate |
| **Erreurs actionnables** | Blocage sans savoir quoi faire |

### Scénario: Avant vs Après

**Scénario**: Opérateur veut annuler un ordre de production à 17h45 (fatigué)

**AVANT (sans Phase 4)**:
1. Clic sur "Annuler"
2. Pop-up "Êtes-vous sûr?" → OK (réflexe)
3. Ordre annulé
4. Le lendemain: "Qui a annulé ça? Pourquoi?"
5. Pas de trace, dispute

**APRÈS (avec Phase 4)**:
1. Clic sur "Annuler l'ordre"
2. Dialog avec:
   - Liste des conséquences
   - MP qui seront restituées
   - Note "Sera enregistré dans l'audit"
   - Champ "Tapez ANNULER pour confirmer"
3. Opérateur lit, comprend, tape ANNULER
4. Ordre annulé avec trace audit complète
5. Le lendemain: "Qui a annulé?" → Audit: "Ahmed, 17h47, raison visible"

---

## 10. INTÉGRATION

### Utilisation dans les pages

```tsx
// pages/production/[id].tsx
import { ProductionCancelConfirm } from '@/components/ui/critical-action-confirm';
import { EntityAuditFooter, LastActionBadge } from '@/components/ui/audit-trail-display';
import { ProductionBlockedAlert } from '@/components/ui/critical-alerts';
import { LoadingState, ErrorState } from '@/components/ui/safe-states';

export default function ProductionOrderPage() {
  // ... data fetching

  if (isLoading) return <LoadingState message="Chargement de l'ordre..." />;
  if (error) return <ErrorState title="Erreur" message={error.message} action="Réessayer" onRetry={refetch} />;

  return (
    <div>
      <LastActionBadge 
        action={order.lastAction} 
        actorName={order.lastActor} 
        timestamp={order.lastActionAt} 
      />
      
      <ProductionBlockedAlert blockedOrders={blockedOrders} onNavigate={navigate} />
      
      {/* ... contenu principal ... */}
      
      <EntityAuditFooter 
        createdBy={order.createdByName}
        createdAt={order.createdAt}
        lastModifiedBy={order.modifiedByName}
        lastModifiedAt={order.updatedAt}
      />
      
      <ProductionCancelConfirm
        open={showCancel}
        onOpenChange={setShowCancel}
        orderNumber={order.number}
        productName={order.productName}
        consumedMp={order.consumedMp}
        onConfirm={handleCancel}
      />
    </div>
  );
}
```

---

## CONCLUSION

Phase 4 établit un **système de sécurité UX** qui:

- ✅ Classe les erreurs en catégories compréhensibles
- ✅ Traduit les erreurs techniques en actions utilisateur
- ✅ Gère explicitement chaque état possible de l'UI
- ✅ Force la confirmation des actions critiques
- ✅ Rend l'audit visible pour les opérateurs
- ✅ Surface les alertes critiques de manière visible

**L'ERP ne surprend plus l'utilisateur. Chaque action est comprise, chaque erreur est actionnable, chaque alerte est visible.**

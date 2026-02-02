# V1 SAFE — Implémentation Redesign APPRO

**Date:** 15 janvier 2026  
**Statut:** Implémenté  

---

## RÉSUMÉ DES CHANGEMENTS

### Règle fondamentale appliquée
> "Si le système te laisse faire une erreur, c'est un bug."

Chaque écran répond à **UNE question métier**. S'il répond à 2 → il est mal conçu.

---

## ÉCRAN 0 — DASHBOARD (`/dashboard/appro`)

**Question:** "Y a-t-il quelque chose de critique aujourd'hui ?"

### Avant
- Cartes Stock MP / Stock PF
- Chiffres non actionnables
- Info sans clic direct
- IRS comme indicateur principal

### Après (V1 SAFE)
```
AUJOURD'HUI — APPRO

🔴 1 MP BLOQUANTE
[ Voir maintenant ]

🟠 3 MP À COMMANDER
[ Voir ]

🟢 12 BC EN COURS
⏱ 2 en retard
[ Voir ]
```

**Règles:**
- 3 blocs MAX
- Tout cliquable
- Zéro détail ici
- Cette page REDIRIGE, elle ne DÉCIDE pas

**Fichier:** `apps/web/src/app/(dashboard)/dashboard/appro/page.tsx`

---

## ÉCRAN 1 — STOCK MP (`/dashboard/appro/stock`)

**Question:** "Sur quoi dois-je agir maintenant ?"

**C'EST L'ÉCRAN CENTRAL DU PRODUIT**

### Structure V1 SAFE (Table)

| MP | ÉTAT | STOCK | JOURS | BC EN COURS | IMPACT | ACTION |
|----|------|-------|-------|-------------|--------|--------|
| Lait cru | 🔴 BLOQUANT | 72 L | 0 j | ❌ | 4 recettes | **Créer BC URGENT** |
| Seau 800g | 🟠 À COMMANDER | 0 | — | ❌ | — | **Créer Demande** |
| Carton 12u | 🟢 OK | 30 000 | 45 j | — | — | — |

**Règles:**
- Une seule action possible par ligne
- BLOQUANT → "Créer BC URGENT" (rouge, bypass demande)
- À COMMANDER → "Créer Demande" (orange)
- OK → Pas de bouton (tiret)
- Suppression du "∞" (remplacé par "—")

**Fichier:** `apps/web/src/app/(dashboard)/dashboard/appro/stock/page.tsx`

---

## ÉCRAN 3 — CRÉATION BC (`/dashboard/appro/bons/new`)

**Question:** "Comment sécuriser cet approvisionnement ?"

### Règle non négociable
On n'arrive JAMAIS ici sans contexte.  
Sources autorisées:
- MP BLOQUANTE
- Demande MP VALIDÉE

### Formulaire V1 SAFE (1 écran)

**Pré-rempli automatiquement:**
- MP (depuis paramètre URL)
- Quantité recommandée (minStock - currentStock)
- Fournisseur habituel
- Dernier prix
- Délai moyen (date = today + leadTime)

**Champs obligatoires:**
- Quantité (>0)
- Fournisseur
- Prix (>0)
- Date livraison (OBLIGATOIRE)

### Contrôles avant confirmation
- Prix aberrant? (>2x ou <0.5x dernier prix)
- Quantité très élevée? (>3x minStock)
- Warning bloquant explicite si oui

**Fichier:** `apps/web/src/app/(dashboard)/dashboard/appro/bons/new/page.tsx`

---

## ÉCRAN 4 — BONS DE COMMANDE (`/dashboard/appro/bons`)

**Question:** "Mes commandes sont-elles sous contrôle ?"

### Règle critique V1 SAFE
```
Si date < aujourd'hui ET statut != RECEIVED
→ STATUT = EN RETARD
→ ALERTE ROUGE
```

### Affichage par BC
- Fournisseur
- MP
- Quantité
- Date prévue
- Statut réel
- **Retard (badge rouge "EN RETARD" si oui)**

### Supprimé
- Message mensonger "BC créés uniquement via Demande"
- BC confirmés à 0,00 (validation prix obligatoire)

**Fichier:** `apps/web/src/app/(dashboard)/dashboard/appro/bons/page.tsx`

---

## FICHIERS MODIFIÉS

| Fichier | Changement |
|---------|------------|
| `page.tsx` (dashboard) | Refonte complète - 3 blocs uniquement |
| `stock/page.tsx` | Actions simplifiées, suppression ∞ |
| `bons/new/page.tsx` | Formulaire 1 écran, pré-rempli, validations |
| `bons/page.tsx` | Détection EN RETARD, alerte rouge |

## FICHIERS ARCHIVÉS

| Fichier | Raison |
|---------|--------|
| `bons/new/page.old.tsx` | Ancienne version multi-étapes |

---

## GAINS V1 SAFE

| Avant | Après |
|-------|-------|
| Décisions aveugles | Décisions guidées |
| Double commandes possibles | Impossible (validation contexte) |
| Cockpit décoratif | Cockpit utile (3 blocs) |
| Flux contradictoires | Flux unique |
| BC en retard invisibles | Alerte rouge automatique |
| Création BC sans date | Date obligatoire |
| Prix 0 accepté | Validation obligatoire |

---

## PROCHAINES ÉTAPES (V1.1)

1. **Backend:** Ajouter `bcEnRetard` au endpoint dashboard
2. **Backend:** Ajouter `bcEnCours` par MP au endpoint stock
3. **Backend:** Valider prix > 0 côté serveur
4. **Frontend:** Afficher colonne "BC EN COURS" dans stock

---

*Document généré le 15 janvier 2026*

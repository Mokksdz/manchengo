# 📦 Guide Utilisateur — Module Stock

> **Version**: 1.0.0  
> **Dernière MAJ**: Janvier 2026  
> **Rôles concernés**: ADMIN, APPRO, PRODUCTION

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Dashboard Stock 3 Zones](#dashboard-stock-3-zones)
3. [Gestion des Lots (FIFO)](#gestion-des-lots-fifo)
4. [Inventaire et Validation](#inventaire-et-validation)
5. [Gestion DLC / Expiration](#gestion-dlc--expiration)
6. [Règles de sécurité Anti-Fraude](#règles-de-sécurité-anti-fraude)
7. [FAQ](#faq)

---

## 1. Vue d'ensemble

Le module Stock de Manchengo ERP permet de gérer :
- **Matières Premières (MP)** : Lait, présure, sel, etc.
- **Produits Finis (PF)** : Fromages, yaourts, etc.
- **Lots** : Traçabilité complète avec DLC
- **Inventaires** : Déclaration et validation sécurisée

### Accès au module

1. Connectez-vous à l'application
2. Dans le menu latéral, cliquez sur **📊 Stock**
3. Choisissez la page souhaitée

---

## 2. Dashboard Stock 3 Zones

Le dashboard est divisé en **3 zones actionables** :

### 🔴 Zone Critique (Rouge)
Actions **immédiates** requises :
- **Ruptures de stock** : Stock = 0, production bloquée
- **Lots expirant sous 3 jours** : À consommer ou bloquer
- **Inventaires critiques** : Écarts > 10% ou > 50 000 DA

**Actions disponibles** :
- `Demander` → Créer une demande MP urgente
- `Bloquer` → Bloquer un lot avant expiration
- `Valider` → Aller à la page de validation inventaire

### 🟠 Zone À Traiter (Orange)
À traiter dans les **24-48h** :
- **Sous seuil minimum** : Stock < seuil, réappro nécessaire
- **Lots expirant sous 7 jours** : Planifier consommation FIFO
- **Inventaires en attente** : Validation requise

### 🟢 Zone Santé (Vert)
Indicateurs de **performance** :
- **Health Score** : Score global 0-100
- **Conformité FIFO** : % de consommations FIFO correctes
- **Rotation Stock** : Vitesse de rotation
- **Fraîcheur Inventaire** : Ancienneté des derniers inventaires
- **Lots bloqués** : % de lots en statut BLOCKED
- **Risque DLC** : Score de risque expiration

---

## 3. Gestion des Lots (FIFO)

### Principe FIFO
**First In, First Out** : Les lots les plus anciens sont consommés en premier.

L'ordre de priorité est :
1. **DLC** (Date Limite de Consommation) la plus proche
2. **Date de création** la plus ancienne

### Statuts des lots

| Statut | Description | Consommable |
|--------|-------------|-------------|
| `AVAILABLE` | Disponible pour production | ✅ Oui |
| `BLOCKED` | Bloqué (DLC dépassée, qualité) | ❌ Non |
| `CONSUMED` | Entièrement consommé | ❌ Non |

### Blocage automatique
- Les lots dont la **DLC est dépassée** sont automatiquement bloqués
- Un job s'exécute chaque nuit à 02:00

### Blocage manuel
1. Accédez à **Stock > Lots**
2. Recherchez le lot concerné
3. Cliquez sur **Bloquer**
4. Renseignez le motif (obligatoire)

---

## 4. Inventaire et Validation

### Workflow Inventaire

```
┌─────────────┐     ┌────────────────┐     ┌─────────────┐
│  DÉCLARATION │ ──▶ │  ANALYSE RISQUE │ ──▶ │  VALIDATION │
│  (Compteur)  │     │   (Automatique) │     │  (Valideur) │
└─────────────┘     └────────────────┘     └─────────────┘
```

### Niveaux de risque

| Niveau | Seuil | Validation requise |
|--------|-------|-------------------|
| `LOW` | Écart < 2% | Auto-approuvé |
| `MEDIUM` | Écart 2-5% | Simple validation |
| `HIGH` | Écart 5-10% | Double validation |
| `CRITICAL` | Écart > 10% ou > 50k DA | Double validation obligatoire |

### Déclarer un inventaire

1. Accédez à **Stock > Inventaire**
2. Cliquez sur **Nouvelle déclaration**
3. Sélectionnez le produit (MP ou PF)
4. Entrez la **quantité comptée**
5. Ajoutez des **notes** si nécessaire
6. Cliquez sur **Soumettre**

### Valider un inventaire (ADMIN uniquement)

1. Accédez à **Stock > Inventaire**
2. Filtrez par **En attente**
3. Cliquez sur une déclaration
4. Vérifiez les informations
5. Cliquez sur **Valider** ou **Rejeter**

> ⚠️ **Important** : Vous ne pouvez pas valider votre propre déclaration

---

## 5. Gestion DLC / Expiration

### Page DLC

Accès : **Stock > DLC / Expiry**

Cette page affiche :
- **Lots expirés (bloqués)** : Déjà bloqués automatiquement
- **J-1** : Expire demain
- **J-3** : Expire sous 3 jours
- **J-7** : Expire sous 7 jours

### Valeur à risque

Le système calcule automatiquement la **valeur financière** des lots à risque d'expiration.

### Actions recommandées

| Délai | Action recommandée |
|-------|-------------------|
| J-7 | Planifier consommation prioritaire |
| J-3 | Alerter production, forcer FIFO |
| J-1 | Décision: consommer ou bloquer |
| Expiré | Bloquer immédiatement |

---

## 6. Règles de sécurité Anti-Fraude

### Séparation des rôles

| Règle | Description |
|-------|-------------|
| Compteur ≠ Valideur | Le déclarant ne peut pas valider |
| Double validation | Écarts HIGH/CRITICAL nécessitent 2 validateurs |
| Cooldown 4h | Pas de nouvelle déclaration sur même produit < 4h |

### Détection patterns suspects

Le système détecte automatiquement :
- 3+ écarts négatifs consécutifs sur même produit
- Écarts toujours dans le même sens
- Déclarations hors heures ouvrables

### Audit Trail

Toutes les opérations sont **tracées** :
- Qui a fait quoi
- Quand
- Depuis quelle IP
- État avant/après

Accès audit : **Sécurité > Audit** (ADMIN uniquement)

---

## 7. FAQ

### Q: Pourquoi je ne peux pas valider un inventaire ?
**R**: Soit vous êtes le déclarant (règle anti-fraude), soit vous n'avez pas le rôle ADMIN.

### Q: Comment débloquer un lot ?
**R**: Contactez un ADMIN. Le déblocage nécessite un motif valide et est tracé dans l'audit.

### Q: Le dashboard affiche "Aucune alerte critique" mais j'ai des stocks bas
**R**: Vérifiez que les seuils minimum sont correctement configurés dans les fiches produits.

### Q: Pourquoi mon inventaire est en "Double validation" ?
**R**: L'écart détecté est HIGH ou CRITICAL. Une deuxième validation par un autre ADMIN est requise.

### Q: Comment fonctionne le Health Score ?
**R**: C'est une moyenne pondérée de :
- Conformité FIFO (30%)
- Rotation stock (20%)
- Fraîcheur inventaire (20%)
- Ratio lots bloqués (15%)
- Score risque DLC (15%)

---

## 📞 Support

Pour toute question :
- **Email**: support@manchengo.dz
- **Téléphone**: +213 XX XX XX XX
- **Documentation technique**: `/docs/STOCK_MODULE_GO_PROD.md`

---

*Document généré automatiquement — Manchengo Smart ERP v1.0*

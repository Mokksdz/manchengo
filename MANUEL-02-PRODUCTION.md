# MANCHENGO SMART ERP -- MANUEL UTILISATEUR
# ROLE : RESPONSABLE PRODUCTION (PRODUCTION)

**Version :** 2.0.0
**Date :** 24 fevrier 2026
**Classification :** INTERNE -- Usage operationnel
**Redige par :** Direction Systemes d'Information, EURL Manchengo
**Plateforme :** Railway (NestJS Backend) + Vercel (Next.js 14 Frontend)

---

> **AVERTISSEMENT LEGAL**
> Ce document constitue le manuel de reference pour le role PRODUCTION dans Manchengo Smart ERP. Toute operation effectuee dans le systeme est tracee, auditee et horodatee. Le non-respect des procedures decrites dans ce manuel engage la responsabilite de l'operateur au regard des normes HACCP, de la reglementation agroalimentaire algerienne et du reglement interieur de l'entreprise.

---

## TABLE DES MATIERES

1. [Fiche d'identite du role](#1-fiche-didentite-du-role)
2. [Workflow complet (step-by-step)](#2-workflow-complet-step-by-step)
3. [Scenarios reels](#3-scenarios-reels)
4. [Erreurs humaines frequentes](#4-erreurs-humaines-frequentes)
5. [Risques metier critiques](#5-risques-metier-critiques)
6. [Checklists quotidienne / hebdomadaire / mensuelle](#6-checklists)
7. [Scripts de formation video](#7-scripts-de-formation-video)
8. [Matrice RACI](#8-matrice-raci)
9. [Niveaux de maturite](#9-niveaux-de-maturite)
10. [Recommandations d'optimisation](#10-recommandations-doptimisation)
11. [Glossaire metier](#11-glossaire-metier)
12. [Annexes](#12-annexes)

---

## 1. FICHE D'IDENTITE DU ROLE

### 1.1 Designation

| Attribut | Valeur |
|---|---|
| **Code role RBAC** | `PRODUCTION` |
| **Intitule complet** | Responsable de Production |
| **Perimetre fonctionnel** | Production, Recettes, Stock (lecture, sans donnees financieres), Inventaire (declaration), Approvisionnement (lecture) |
| **Niveau hierarchique** | Operationnel (N-1 du Directeur d'Exploitation) |
| **Classification donnees** | Acces restreint -- Donnees financieres masquees (priceHt, stockValue) |

### 1.2 Perimetre d'acces detaille

**Modules en acces complet (CRUD) :**

- **Production** : Creation, demarrage, achevement, annulation des ordres de production. Acces au dashboard KPIs, alertes, calendrier, analytics, planning hebdomadaire, tracabilite des lots, generation PDF.
- **Recettes** : Creation, modification, ajout/suppression d'ingredients, calcul des besoins, verification de disponibilite stock.

**Modules en acces lecture seule :**

- **Stock MP** : Consultation des niveaux de stock sans les colonnes `priceHt` et `stockValue`. Consultation des mouvements et lots individuels.
- **Stock PF** : Consultation des niveaux de stock sans donnees financieres. Consultation des mouvements et lots individuels.
- **Approvisionnement** : Consultation du stock MP critique, des alertes critiques, des bons de commande (liste et detail). Verification de production possible.
- **Rapports** : Export production et mouvements de stock (Excel, PDF).

**Modules en acces partiel :**

- **Inventaire** : Declaration de comptage physique uniquement (`POST /inventory/declare`). La validation et le rejet sont reserves au role ADMIN.

**Modules interdits :**

- Facturation et comptabilite
- Gestion des clients
- Gestion des fournisseurs (creation/modification)
- Gestion des utilisateurs et securite
- Ajustements de stock directs (reserves ADMIN)
- Declaration de pertes (reserves ADMIN)
- Donnees financieres (prix d'achat MP, valeur de stock)

### 1.3 Endpoints API accessibles

#### Production (`/production`)

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/production` | Liste des ordres de production (filtres: status, productPfId, limit) |
| `GET` | `/production/:id` | Detail d'un ordre de production |
| `POST` | `/production` | Creer un ordre de production |
| `POST` | `/production/:id/start` | Demarrer une production (consommation FIFO) |
| `POST` | `/production/:id/complete` | Terminer une production (creation lot PF) |
| `POST` | `/production/:id/cancel` | Annuler une production (reversal automatique) |
| `GET` | `/production/dashboard/kpis` | KPIs production (jour, semaine, mois) |
| `GET` | `/production/dashboard/supply-risks` | Risques supply chain agreges |
| `GET` | `/production/dashboard/at-risk` | Productions a risque |
| `GET` | `/production/dashboard/alerts` | Alertes production (DLC, rendement, blocages, stock bas) |
| `GET` | `/production/dashboard/stock-pf` | Resume stock PF |
| `GET` | `/production/dashboard/calendar` | Calendrier de production (defaut 7 jours) |
| `GET` | `/production/dashboard/analytics` | Analytics de production (semaine/mois/annee) |
| `GET` | `/production/lots/search` | Recherche tracabilite lots (MP et PF) |
| `GET` | `/production/planning/week` | Planning hebdomadaire |
| `POST` | `/production/planning/check-stock` | Verification stock pour planning |
| `PUT` | `/production/:id/schedule` | Modifier la date planifiee |
| `GET` | `/production/product/:id/history` | Historique de production par produit PF |
| `GET` | `/production/:id/pdf` | Telecharger la fiche de production PDF |

#### Recettes (`/recipes`)

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/recipes` | Liste de toutes les recettes |
| `GET` | `/recipes/:id` | Detail d'une recette |
| `POST` | `/recipes` | Creer une recette |
| `PUT` | `/recipes/:id` | Modifier les parametres d'une recette |
| `POST` | `/recipes/:id/items` | Ajouter un ingredient |
| `PUT` | `/recipes/:id/items/:itemId` | Modifier un ingredient |
| `DELETE` | `/recipes/:id/items/:itemId` | Supprimer un ingredient |
| `GET` | `/recipes/:id/requirements` | Calculer les besoins MP pour N batchs |
| `GET` | `/recipes/:id/check-stock` | Verifier la disponibilite stock |

#### Stock (lecture seule)

| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/stock/mp` | Stock MP (sans priceHt, stockValue) |
| `GET` | `/stock/pf` | Stock PF (sans donnees financieres) |
| `GET` | `/stock/mp/:id/stock` | Stock actuel d'une MP |
| `GET` | `/stock/pf/:id/stock` | Stock actuel d'un PF |
| `GET` | `/stock/mp/:id/movements` | Mouvements d'une MP |
| `GET` | `/stock/pf/:id/movements` | Mouvements d'un PF |
| `GET` | `/stock/alerts` | Alertes stock (ruptures, seuils) |

#### Inventaire

| Methode | Endpoint | Description |
|---|---|---|
| `POST` | `/inventory/declare` | Declarer un comptage physique |
| `GET` | `/inventory/:id` | Consulter une declaration |

### 1.4 Conventions de nommage

- **Reference ordre de production** : `OP-AAMMJJ-NNN` (ex: `OP-260224-001` pour le 1er ordre du 24 fevrier 2026)
- **Reference lot PF** : `{CODE_PRODUIT}-AAMMJJ-NNN` (ex: `FONDU400-260224-001`)
- **Statuts production** : `PENDING` -> `IN_PROGRESS` -> `COMPLETED` ou `CANCELLED`
- **Statuts qualite** : `OK`, `DEFAUT_MINEUR`, `DEFAUT_MAJEUR`
- **Types d'alertes** : `DLC_PROCHE`, `RENDEMENT_FAIBLE`, `ORDRE_BLOQUE`, `STOCK_PF_BAS`

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### WORKFLOW A : Creer et planifier un ordre de production

**Prerequis** : Le produit fini (PF) doit exister dans le referentiel et avoir une recette active associee avec au moins un ingredient, un `batchWeight > 0` et un `outputQuantity > 0`.

**Etape 1 -- Ouvrir l'assistant de production**

Depuis le Dashboard Production, cliquer sur le bouton "Nouvelle production" (icone eclair violet). L'assistant s'ouvre en modal avec un processus en 4 etapes : Produit -> Quantite -> Verification -> Lancement.

**Etape 2 -- Selectionner le produit fini**

L'assistant affiche uniquement les produits ayant une recette configuree. Chaque produit indique son code, son nombre d'ingredients et son poids de batch. Selectionner le produit souhaite en cliquant sur sa ligne. Si le produit n'a pas de recette, un message d'erreur s'affiche : "Ce produit n'a pas de recette configuree."

**Etape 3 -- Definir la quantite et la date**

- **Nombre de batchs** : Utiliser les boutons +/- ou saisir directement un nombre entre 1 et 100. Le systeme calcule automatiquement :
  - Quantite cible = `outputQuantity` x `batchCount`
  - Poids total = `batchWeight` x `batchCount`
  - DLC previsionnelle = date du jour + `shelfLifeDays`
- **Date planifiee** (optionnel) : Selectionner une date via le calendrier. Seules les dates futures sont acceptees. Laisser vide pour un ordre non planifie.

**Etape 4 -- Verification du stock**

Cliquer sur "Verifier le stock". Le systeme appelle `GET /recipes/:id/check-stock?batchCount=N` et affiche un tableau detaille :

| Ingredient | Code | Requis | Disponible | Statut |
|---|---|---|---|---|
| Lait en poudre | MP-001 | 500 kg | 620 kg | OK |
| Huile vegetale | MP-003 | 120 kg | 80 kg | -40 kg |

- **Banniere verte** "Stock suffisant" : toutes les matieres obligatoires sont disponibles.
- **Banniere rouge** "Stock insuffisant" : au moins une matiere obligatoire est en deficit. Le bouton "Continuer" est desactive. L'operateur doit soit reduire le nombre de batchs, soit attendre un reapprovisionnement.

Le systeme ne verifie que les items dont `affectsStock = true` (les fluides type `FLUID` comme l'eau sont exclus). Seuls les lots MP ayant le statut `AVAILABLE`, une quantite restante > 0 et non expires sont comptabilises.

**Etape 5 -- Confirmation et lancement**

Si le stock est suffisant, passer a l'etape 4 "Lancement". L'ecran recapitule : produit, nombre de batchs, quantite cible, date planifiee. Cliquer sur "Lancer la production".

Le systeme cree l'ordre via `POST /production` avec les champs : `productPfId`, `batchCount`, `scheduledDate` (optionnel). L'ordre est cree avec le statut `PENDING`. La reference est generee automatiquement au format `OP-AAMMJJ-NNN` avec un mecanisme anti-collision (3 tentatives + fallback timestamp).

L'operateur est redirige vers la page de detail de l'ordre `/dashboard/production/order/:id`.

> **REGLE METIER CRITIQUE** : La creation de l'ordre ne consomme PAS les matieres premieres. La consommation FIFO n'intervient qu'au demarrage effectif (`POST /production/:id/start`).

---

### WORKFLOW B : Demarrer une production

**Prerequis** : L'ordre de production doit etre au statut `PENDING`.

**Etape 1 -- Ouvrir le detail de l'ordre**

Depuis la liste des ordres ou le dashboard, naviguer vers la page de l'ordre concerne. Verifier le statut "En attente" (badge jaune).

**Etape 2 -- Verifier les conditions de demarrage**

Avant de cliquer sur "Demarrer", s'assurer que :
- Toutes les matieres premieres sont physiquement disponibles dans la zone de production
- Les equipements sont propres et prets (nettoyage CIP effectue)
- Le personnel de production est en poste
- Le laboratoire qualite a valide les analyses des MP (si applicable)

**Etape 3 -- Demarrer la production**

Cliquer sur le bouton "Demarrer" (`POST /production/:id/start`). Le systeme execute les operations suivantes dans une transaction atomique :

1. **Preview FIFO** : Pour chaque ingredient de la recette (`affectsStock = true`), le systeme calcule la quantite requise (`quantity x batchCount`) et identifie les lots MP a consommer.

2. **Consommation FIFO stricte** : Les lots MP sont consommes par ordre chronologique (les plus anciens d'abord, classes par `createdAt` puis `expiryDate`). Seuls les lots au statut `AVAILABLE` sont eligibles. Les lots `BLOCKED` sont interdits de consommation.

3. **Creation des enregistrements de consommation** : Pour chaque lot MP consomme, un enregistrement `ProductionConsumption` est cree avec : `quantityPlanned`, `quantityConsumed`, `lotMpId` (tracabilite), `unitCost`.

4. **Mise a jour du stock** : Les mouvements de stock (`StockMovement`) de type `OUT` avec l'origine `PRODUCTION_OUT` sont crees automatiquement.

5. **Mise a jour de l'ordre** : Le statut passe a `IN_PROGRESS`, `startedAt` et `startedBy` sont enregistres.

6. **Audit** : Un evenement `PRODUCTION_ORDER_STARTED` est enregistre dans le journal d'audit avec la reference de l'ordre, le nombre de consommations et le nombre total de lots utilises.

7. **Invalidation du cache** : Les caches stock et production sont invalides pour garantir la coherence des donnees.

> **MECANISME DE SECURITE** : Si la consommation FIFO echoue en cours de route (ex: lot verrouille par un processus concurrent), le systeme effectue un rollback complet : les quantites deja deduites sont restaurees, les mouvements de stock correctifs sont crees avec l'origine `ROLLBACK-{reference}`, et l'erreur est remontee a l'operateur.

**Etape 4 -- Suivi en cours de production**

L'ecran de detail de l'ordre affiche desormais :
- Le statut "En cours" (badge bleu)
- La liste des consommations MP avec les numeros de lot FIFO
- Le temps ecoule depuis le demarrage
- Les notes de production

Pendant la production, l'operateur peut consulter les consommations detaillees pour verifier la tracabilite MP -> lot -> fournisseur.

---

### WORKFLOW C : Terminer une production

**Prerequis** : L'ordre de production doit etre au statut `IN_PROGRESS`.

**Etape 1 -- Peser et compter la production**

A la fin du process de fabrication :
- Peser la production totale pour obtenir le `batchWeightReal` (poids reel en grammes)
- Compter les unites produites pour obtenir `quantityProduced`

**Etape 2 -- Effectuer le controle qualite**

Evaluer la qualite du lot produit et attribuer un statut :
- `OK` : Conforme aux specifications
- `DEFAUT_MINEUR` : Defauts cosmetiques mineurs, produit commercialisable
- `DEFAUT_MAJEUR` : Defauts significatifs, produit a bloquer ou degrader

Documenter les observations dans les `qualityNotes`.

**Etape 3 -- Saisir la completion dans le systeme**

Cliquer sur "Terminer la production" et remplir le formulaire (`POST /production/:id/complete`) :

| Champ | Type | Obligatoire | Exemple |
|---|---|---|---|
| `quantityProduced` | Nombre > 0 | Oui | 95 |
| `batchWeightReal` | Nombre | Non | 48500 |
| `qualityStatus` | Selection | Non | OK |
| `qualityNotes` | Texte | Non | "Conforme aux specifications" |

> **VALIDATION** : La quantite produite doit etre strictement superieure a 0. Si la production est nulle (aucune unite produite), utiliser l'annulation (Workflow D) au lieu de la completion.

**Etape 4 -- Operations automatiques du systeme**

A la confirmation, le systeme execute dans une transaction atomique :

1. **Calcul du rendement** : `yieldPercentage = (quantityProduced / targetQuantity) * 100`. Si le rendement est inferieur a la tolerance de perte de la recette (`lossTolerance`, 2% par defaut), un avertissement metier est journalise (`PRODUCTION_LOW_YIELD`).

2. **Generation du numero de lot PF** : Format `{CODE_PRODUIT}-AAMMJJ-NNN` avec mecanisme anti-collision.

3. **Calcul de la DLC** : `expiryDate = manufactureDate + shelfLifeDays` (defaut 90 jours).

4. **Calcul du cout de revient** : Somme des consommations (`quantityConsumed * unitCost`) divisee par `quantityProduced`.

5. **Creation du lot PF** : Un enregistrement `LotPf` est cree avec le statut `AVAILABLE`, contenant toutes les informations de tracabilite.

6. **Mouvement de stock entrant** : Un `StockMovement` de type `IN` avec l'origine `PRODUCTION_IN` est cree.

7. **Mise a jour de l'ordre** : Statut `COMPLETED`, `completedAt`, `completedBy`, `yieldPercentage`.

**Etape 5 -- Verifier le lot cree**

Apres confirmation, l'ecran affiche :
- Le lot PF cree avec son numero unique
- La quantite initiale et la DLC
- Le rendement obtenu
- La possibilite de telecharger la fiche de production PDF

---

### WORKFLOW D : Annuler une production

**Prerequis** : L'ordre ne doit pas etre au statut `COMPLETED` (une production terminee ne peut pas etre annulee) ni deja `CANCELLED`.

**Etape 1 -- Evaluer la necessite d'annulation**

Raisons valables : rupture de matiere premiere en cours de production, panne equipement majeure, contamination detectee, erreur de planification.

**Etape 2 -- Saisir l'annulation**

Cliquer sur "Annuler la production" et remplir le motif (`POST /production/:id/cancel`) :

| Champ | Type | Obligatoire | Contrainte |
|---|---|---|---|
| `reason` | Texte | Oui | Minimum 10 caracteres |

> **OBLIGATION REGLEMENTAIRE** : Le motif d'annulation est obligatoire pour la tracabilite d'audit. Un motif de moins de 10 caracteres est rejete par le systeme.

**Etape 3 -- Operations automatiques de reversal**

Si l'ordre etait au statut `IN_PROGRESS` (les MP avaient ete consommees), le systeme execute dans une transaction atomique :

1. **Pour chaque consommation MP** :
   - Le lot MP est restaure : `quantityRemaining` est incrementee de la quantite consommee
   - Si le lot etait au statut `CONSUMED` (entierement consomme par cette production), il repasse a `AVAILABLE`
   - Si le lot etait `BLOCKED` (expire ou probleme qualite), il reste `BLOCKED` mais la quantite est restauree pour coherence comptable. Une note est ajoutee : "[LOT BLOQUE] -- Lot bloque, stock non disponible"
   - Un mouvement de stock `IN` avec l'origine `PRODUCTION_CANCEL` est cree avec la reference `ANNUL-{reference_ordre}`

2. **Les consommations sont marquees comme annulees** : Le champ `isReversed` passe a `true` et `reversedAt` enregistre l'horodatage. Les enregistrements ne sont JAMAIS supprimes (tracabilite).

3. **L'ordre passe au statut `CANCELLED`** avec le motif dans `qualityNotes`.

4. **Audit** : Un evenement `PRODUCTION_ORDER_CANCELLED` de severite `WARNING` est enregistre.

Si l'ordre etait au statut `PENDING` (aucune MP consommee), seul le changement de statut est effectue, sans reversal.

---

### WORKFLOW E : Gerer les recettes

#### E1 -- Creer une recette

**Prerequis** : Le produit fini doit exister dans le referentiel et ne pas avoir de recette existante (une seule recette par PF).

**Etape 1** : Naviguer vers l'onglet "Recettes" du module Production.

**Etape 2** : Cliquer sur "Nouvelle recette" et remplir le formulaire (`POST /recipes`) :

| Champ | Type | Obligatoire | Description | Exemple |
|---|---|---|---|---|
| `productPfId` | Selection | Oui | Produit fini associe | Fromage fondu 400g |
| `name` | Texte | Oui | Nom de la recette | "Recette Manchego 400g v1" |
| `description` | Texte | Non | Notes ou instructions | "Process standard fromagerie" |
| `batchWeight` | Nombre (grammes) | Oui | Poids d'un batch | 50000 (= 50 kg) |
| `outputQuantity` | Nombre | Oui | Unites produites par batch | 100 |
| `lossTolerance` | Decimal (0-1) | Non | Tolerance de perte (defaut 0.02 = 2%) | 0.03 |
| `productionTime` | Nombre (minutes) | Non | Duree estimee | 240 |
| `shelfLifeDays` | Nombre (jours) | Non | Duree de vie (defaut 90) | 120 |
| `items` | Tableau | Oui | Au moins 1 ingredient | Voir E3 |

**Etape 3** : Ajouter les ingredients (au minimum un). Voir section E3 ci-dessous.

**Etape 4** : Valider. Le systeme verifie l'existence de tous les produits MP references et cree la recette en version 1.

#### E2 -- Modifier les parametres d'une recette

Cliquer sur une recette puis "Modifier" (`PUT /recipes/:id`). Les champs modifiables sont : `name`, `description`, `batchWeight`, `outputQuantity`, `lossTolerance`, `productionTime`, `shelfLifeDays`, `isActive`.

> **VERROUILLAGE** : Si des ordres de production en statut `PENDING` ou `IN_PROGRESS` utilisent cette recette, la modification est bloquee avec le message : "Impossible de modifier la recette: N ordre(s) de production en cours". Attendre la fin ou l'annulation des ordres.

Chaque modification incremente automatiquement le numero de `version` de la recette.

#### E3 -- Ajouter un ingredient

Depuis le detail d'une recette, cliquer sur "Ajouter un ingredient" (`POST /recipes/:id/items`) :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `type` | Selection | Non (defaut: MP) | `MP` (matiere premiere), `FLUID` (eau/vapeur), `PACKAGING` (emballage) |
| `productMpId` | Selection | Oui pour MP/PACKAGING | Produit MP associe |
| `name` | Texte | Oui pour FLUID | Nom du fluide (ex: "Eau") |
| `quantity` | Nombre > 0.001 | Oui | Quantite par batch |
| `unit` | Texte | Oui | Unite de mesure (kg, L, unite) |
| `affectsStock` | Case | Non (defaut: true pour MP, false pour FLUID) | Impact sur le stock |
| `isMandatory` | Case | Non (defaut: true) | Ingredient obligatoire |
| `isSubstitutable` | Case | Non (defaut: false) | Peut etre remplace |
| `substituteIds` | Selection multiple | Si substituable | IDs des substituts possibles |
| `sortOrder` | Nombre | Non (auto-incrementee) | Ordre d'ajout dans le process |

> **DUPLICATION INTERDITE** : Le systeme empeche l'ajout d'un produit MP deja present dans la recette. Un seul enregistrement par `productMpId` par recette.

#### E4 -- Calculer les besoins MP

`GET /recipes/:id/requirements?batchCount=N` retourne pour chaque ingredient :
- `quantityPerBatch` : quantite unitaire
- `totalQuantity` : quantite x nombre de batchs
- `outputQuantity` : production totale attendue

#### E5 -- Verifier la disponibilite stock

`GET /recipes/:id/check-stock?batchCount=N` retourne pour chaque ingredient impactant le stock :
- Quantite requise vs quantite disponible
- Statut `isAvailable` par ingredient
- Shortage (manque) si applicable
- Top 5 des lots FIFO qui seraient consommes
- Indicateur global `canProduce`

---

### WORKFLOW F : Planning hebdomadaire

**Etape 1 -- Consulter le planning**

Naviguer vers la vue Planning (onglet ou sous-menu). Le systeme affiche `GET /production/planning/week` : une grille de 7 jours (lundi a dimanche) avec les ordres planifies pour chaque jour et une section "Non planifies" pour les ordres `PENDING` sans `scheduledDate`.

**Etape 2 -- Planifier un ordre existant**

Pour un ordre `PENDING` non planifie, cliquer et glisser (ou selectionner) vers un jour. Le systeme appelle `PUT /production/:id/schedule` avec la nouvelle `scheduledDate`.

> **RESTRICTION** : Seuls les ordres au statut `PENDING` peuvent etre replanifies. Un ordre `IN_PROGRESS`, `COMPLETED` ou `CANCELLED` ne peut pas changer de date.

**Etape 3 -- Verifier le stock pour le planning**

Avant de figer le planning de la semaine, utiliser `POST /production/planning/check-stock` avec la liste des items planifies :

```json
{
  "items": [
    { "recipeId": 1, "batchCount": 3 },
    { "recipeId": 2, "batchCount": 2 }
  ]
}
```

Le systeme retourne pour chaque item :
- `canProduce` : true/false
- `status` : "available" ou "shortage"
- `shortages` : liste des MP manquantes avec quantites

**Etape 4 -- Creer un nouvel ordre depuis le planning**

Cliquer sur un jour pour ouvrir l'assistant de production pre-rempli avec la date selectionnee (via le parametre `initialDate` du wizard modal).

**Etape 5 -- Deplanifier un ordre**

Pour retirer un ordre du planning, envoyer `PUT /production/:id/schedule` avec `scheduledDate: null`.

---

### WORKFLOW G : Declaration d'inventaire

**Etape 1 -- Compter physiquement**

En atelier ou en entrepot, compter physiquement les quantites de matieres premieres ou de produits finis. Utiliser des fiches de comptage papier ou la vue mobile du systeme.

**Etape 2 -- Saisir la declaration**

Via l'interface inventaire ou le modal InventoryModal, declarer le comptage (`POST /inventory/declare`) :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `productType` | Selection | Oui | `MP` ou `PF` |
| `productId` | Selection | Oui | ID du produit concerne |
| `declaredQuantity` | Nombre >= 0 | Oui | Quantite comptee physiquement |
| `notes` | Texte | Non | Observations (ex: "ecart du a casse") |
| `evidencePhotos` | Fichiers | Non | Photos justificatives |

**Etape 3 -- Traitement automatique**

Le systeme compare la `declaredQuantity` au stock theorique et determine le traitement :

| Ecart | Traitement | Message |
|---|---|---|
| Faible (dans la tolerance) | Auto-approuve (`AUTO_APPROVED`) | "Inventaire auto-approuve (ecart faible)" |
| Significatif | En attente validation ADMIN | "Inventaire en attente de validation ADMIN" |
| Critique | Double validation requise | "Inventaire en attente de double validation (ecart critique)" |

**Etape 4 -- Suivi de la declaration**

Consulter le statut de la declaration via `GET /inventory/:id`. Les statuts possibles sont : `PENDING`, `AUTO_APPROVED`, `APPROVED`, `REJECTED`, `PENDING_DOUBLE_VALIDATION`.

> **IMPORTANT** : Le role PRODUCTION peut declarer mais ne peut PAS valider. La validation est strictement reservee au role ADMIN, avec la contrainte que le validateur doit etre different du declarant (separation des taches).

---

## 3. SCENARIOS REELS

### Scenario 1 : Production quotidienne de fromage fondu 400g

**Contexte** : Lundi matin, 07h30. Le Responsable Production planifie la production de la journee : 5 batchs de fromage fondu 400g, soit 500 unites attendues (100 unites par batch).

**Deroulement** :

1. Connexion a Manchengo Smart ERP. Le dashboard affiche : 3 ordres PENDING de vendredi, 0 en cours, alerte "Stock MP-003 Huile vegetale sous seuil".
2. Creation de l'ordre via le wizard : selection du produit "Fromage Fondu 400g" (code FF-400), 5 batchs, date planifiee = aujourd'hui.
3. Verification du stock : le systeme confirme la disponibilite de toutes les MP obligatoires. Le lait en poudre sera preleve sur 2 lots differents (lot L-MP001-260220-001 : 300 kg restants, lot L-MP001-260218-003 : 200 kg restants -- FIFO strict).
4. Lancement. L'ordre OP-260224-001 est cree au statut PENDING.
5. A 08h00, apres preparation de l'atelier, demarrage de la production. Le systeme consomme les MP en FIFO et confirme : "Production demarree. 12 lots MP consommes."
6. A 14h30, la production est terminee. Pesee : 48.2 kg reels (cible 50 kg = 5 x 10 kg). Comptage : 482 unites (cible 500).
7. Completion : `quantityProduced = 482`, `batchWeightReal = 48200`, `qualityStatus = OK`, `qualityNotes = "Rendement normal, legere perte liee au nettoyage des cuves"`.
8. Le systeme cree le lot FF400-260224-001 avec DLC au 25 mai 2026 (90 jours). Rendement affiche : 96.4%.
9. La fiche PDF est generee et imprimee pour archivage physique.

**Points de vigilance** : Le rendement de 96.4% est dans la tolerance (> 98% = 100% - 2%). Si le rendement avait ete de 88%, un avertissement `PRODUCTION_LOW_YIELD` aurait ete journalise.

---

### Scenario 2 : Rupture de matiere premiere en cours de planification

**Contexte** : Le Responsable Production planifie 8 batchs de fromage a tartiner. Lors de la verification du stock, le systeme detecte un manque de 150 kg de caseinate de sodium (MP-007).

**Deroulement** :

1. Creation de l'ordre : 8 batchs de "Tartiner Cremeux 200g".
2. Verification stock : banniere rouge "Stock insuffisant". Tableau : MP-007 Caseinate de sodium -- Requis: 400 kg, Disponible: 250 kg, Manque: -150 kg.
3. Le bouton "Continuer" est grise. L'operateur ne peut pas lancer la production.
4. Consultation du dashboard supply-risks (`GET /production/dashboard/supply-risks`) : la MP-007 est en etat `RISQUE_48H` avec 1.8 jours de couverture.
5. Verification des BC en cours (`GET /appro/purchase-orders`) : un BC-260222-003 est en retard de 2 jours pour cette MP.
6. Decision : reduire a 5 batchs (250 kg disponibles couvrent le besoin de 250 kg). Creer l'ordre pour 5 batchs, noter dans les observations "Reduit de 8 a 5 batchs suite rupture MP-007".
7. Contacter le service Appro pour signaler l'urgence et demander une relance fournisseur.
8. Planifier la production des 3 batchs manquants des reception de la MP.

---

### Scenario 3 : Defaut qualite majeur detecte en fin de production

**Contexte** : En fin de production de fromage fondu, l'operateur detecte un gout anormal. Analyse rapide : contamination probable d'un lot de lait en poudre.

**Deroulement** :

1. La production physique est terminee mais le lot doit etre bloque.
2. Completion de l'ordre avec `qualityStatus = DEFAUT_MAJEUR`, `qualityNotes = "Gout anormal detecte. Suspicion contamination lot MP MP001-260220-001. Lot PF a bloquer. Analyse labo demandee."`, `quantityProduced = 500` (la quantite a bien ete produite).
3. Le lot PF est cree avec statut `AVAILABLE`. L'ADMIN devra le bloquer manuellement (le role PRODUCTION ne peut pas modifier le statut d'un lot PF).
4. Utiliser la tracabilite des lots (`GET /production/lots/search`) pour identifier toutes les productions ayant utilise le lot MP suspect : saisir le numero de lot MP. Le systeme remonte la chaine : lot MP -> ordres de production -> lots PF produits.
5. Communiquer la liste des lots PF concernes au service Qualite et a la Direction.
6. Documenter l'incident pour les besoins HACCP.

---

### Scenario 4 : Annulation d'une production deja demarree

**Contexte** : Une panne du pasteurisateur survient 30 minutes apres le demarrage d'une production. La matiere est irrecuperable.

**Deroulement** :

1. L'ordre OP-260224-003 est au statut `IN_PROGRESS`. Les MP ont ete consommees.
2. Cliquer sur "Annuler la production". Saisir le motif : "Panne pasteurisateur reference PAST-02. Matiere premiere irrecuperable apres 30 min d'exposition sans pasteurisation. Maintenance en cours, estimation reparation 48h."
3. Le systeme effectue le reversal automatique : les quantites MP sont restaurees dans les lots d'origine. Les lots FIFO precedemment consommes retrouvent leur statut `AVAILABLE` (sauf si `BLOCKED`).
4. Verifier dans les mouvements de stock que les mouvements `PRODUCTION_CANCEL` avec reference `ANNUL-OP-260224-003` apparaissent.
5. Une fois le pasteurisateur repare, creer un nouvel ordre de production pour remplacer celui annule.

> **ATTENTION** : Les MP restaurees n'ont pas ete physiquement remises en stock si elles ont ete dechargees. S'assurer que le stock physique correspond au stock theorique apres annulation.

---

### Scenario 5 : Optimisation du planning hebdomadaire avec verification stock anticipee

**Contexte** : Vendredi apres-midi, le Responsable Production prepare le planning de la semaine suivante : 3 references de produits, 15 batchs au total repartis sur 5 jours.

**Deroulement** :

1. Ouvrir la vue planning hebdomadaire (`GET /production/planning/week?startDate=2026-03-02`).
2. Creer les ordres pour la semaine :
   - Lundi : FF-400 x 5 batchs, TART-200 x 3 batchs
   - Mardi : FF-400 x 3 batchs
   - Mercredi : PORT-250 x 4 batchs
3. Chaque ordre est cree via le wizard avec la date correspondante.
4. Verification stock globale : `POST /production/planning/check-stock` avec les 4 items. Le systeme retourne que FF-400 et TART-200 sont couverts mais PORT-250 a un shortage de 80 kg de fromage rape (MP-012).
5. Decision : deplacer les 4 batchs de PORT-250 du mercredi au jeudi en esperant la livraison d'un BC prevu mercredi matin. Mettre a jour via `PUT /production/:id/schedule`.
6. Verifier les alertes supply-risks : le BC concerne est en statut CONFIRMED avec livraison prevue mercredi.
7. Valider le planning et communiquer aux equipes.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Demarrer une production sans verification physique des MP

**Description** : L'operateur demarre la production dans le systeme sans verifier que les matieres sont physiquement presentes en zone de production. Le stock theorique est correct, mais les MP sont encore en entrepot ou en quarantaine.

**Consequence** : La consommation FIFO se fait dans le systeme, mais les matieres ne sont pas disponibles physiquement. La production est bloquee en atelier et l'operateur doit annuler (reversal complexe) ou attendre.

**Prevention** : Toujours effectuer un rapprochement physique avant le clic "Demarrer". Implementer un checkpoint papier "MP verifiees en zone de production" avant la saisie systeme.

### Erreur 2 : Saisir une quantite produite erronee

**Description** : L'operateur saisit 50 au lieu de 500, ou inverse la quantite produite avec le poids du batch. Le rendement calcule est alors aberrant (10% ou 1000%).

**Consequence** : Le lot PF est cree avec une quantite erronee. Les KPIs de rendement sont fausses. Le stock PF theorique ne correspond plus au stock physique.

**Prevention** : Verifier que la quantite saisie est coherente avec la quantite cible affichee. Le systeme journalise un avertissement si le rendement est inferieur a 90%, mais ne bloque pas la saisie pour les rendements superieurs a 100% (surproduction possible).

### Erreur 3 : Oublier de terminer une production dans le systeme

**Description** : La production physique est terminee et les produits sont deja en chambre froide, mais l'operateur oublie de faire le `complete` dans le systeme. L'ordre reste au statut `IN_PROGRESS`.

**Consequence** : Les MP restent marquees comme consommees (correct), mais le lot PF n'est pas cree. Le stock PF theorique est sous-evalue. Les alertes "stock PF bas" se declenchent inutilement. Le dashboard KPIs montre un nombre anormal d'ordres en cours.

**Prevention** : Integrer la saisie systeme dans la procedure de fin de production. Surveiller l'alerte `ORDRE_BLOQUE` qui se declenche pour les ordres `PENDING` de plus de 24h (s'applique aussi moralement aux IN_PROGRESS stagnants).

### Erreur 4 : Modifier une recette pendant une production active

**Description** : L'operateur tente de modifier les quantites d'une recette alors que des ordres de production l'utilisent (PENDING ou IN_PROGRESS).

**Consequence** : Le systeme bloque la modification avec le message "Impossible de modifier la recette: N ordre(s) de production en cours". Ce n'est pas une erreur systeme mais une perte de temps.

**Prevention** : Terminer ou annuler tous les ordres actifs avant de modifier une recette. Planifier les evolutions de recette en dehors des periodes de production.

### Erreur 5 : Annuler une production avec un motif trop vague

**Description** : L'operateur saisit "Annulation" ou "Probleme" comme motif d'annulation.

**Consequence** : Le systeme rejette les motifs de moins de 10 caracteres. Si l'operateur contourne en ajoutant des espaces ou des caracteres vides, la tracabilite est compromise pour les audits HACCP.

**Prevention** : Saisir un motif explicite incluant : la cause (panne, rupture, qualite), la reference de l'element causal, et l'action corrective prevue. Minimum 2 phrases.

### Erreur 6 : Creer un ordre de production pour un produit sans recette

**Description** : L'operateur selectionne un produit fini qui n'a pas encore de recette configuree.

**Consequence** : L'assistant de production affiche "Ce produit n'a pas de recette configuree" et bloque la selection. L'API retourne : "Aucune recette definie pour le produit {code}. Creez d'abord une recette."

**Prevention** : S'assurer que chaque produit fini du catalogue a une recette active avant la mise en production. Utiliser la liste des recettes pour identifier les produits non configures.

### Erreur 7 : Oublier la date planifiee lors de la creation

**Description** : L'operateur cree un ordre de production sans renseigner la date planifiee, pensant que l'ordre sera automatiquement associe a la date du jour.

**Consequence** : L'ordre apparait dans la section "Non planifies" du planning hebdomadaire, sans date. Il n'est pas visible dans la vue calendrier par jour et risque d'etre oublie.

**Prevention** : Toujours renseigner la date planifiee. Si la production est prevue pour le jour meme, saisir la date du jour. La date peut etre modifiee ulterieurement tant que l'ordre est au statut PENDING.

### Erreur 8 : Ne pas consulter les alertes DLC avant expedition

**Description** : L'operateur ne consulte pas les alertes `DLC_PROCHE` du dashboard et ne signale pas les lots PF dont la DLC approche au service Commercial.

**Consequence** : Des lots expirent en stock et doivent etre detruits. Perte de produits finis et de marge.

**Prevention** : Consulter quotidiennement les alertes production. Les alertes DLC se declenchent 7 jours avant expiration (severity `warning` pour J-7 a J-3, severity `critical` pour J-3 a J-0). Transmettre systematiquement ces alertes au service Commercial pour prioriser la vente.

### Erreur 9 : Creer une recette avec un batchWeight ou outputQuantity a zero

**Description** : L'operateur oublie de renseigner le poids du batch ou la quantite de sortie.

**Consequence** : Le systeme rejette la creation avec le message "Le poids du batch doit etre superieur a 0" ou "La quantite de sortie doit etre superieure a 0". Si la recette existait deja et qu'on tente de mettre ces valeurs a zero, la modification est egalement rejetee.

**Prevention** : Verifier les parametres fondamentaux de la recette avant validation. Le batchWeight est en grammes (50000 = 50 kg), l'outputQuantity est le nombre d'unites produites par batch.

### Erreur 10 : Confondre declaration d'inventaire et ajustement de stock

**Description** : L'operateur effectue une declaration d'inventaire (`POST /inventory/declare`) en pensant que cela ajustera immediatement le stock.

**Consequence** : La declaration est creee mais necessite la validation d'un ADMIN (sauf ecart faible auto-approuve). Le stock theorique n'est pas modifie tant que la validation n'est pas effectuee. L'operateur pense que l'ajustement est fait alors qu'il ne l'est pas.

**Prevention** : Comprendre que la declaration d'inventaire est un processus en 2 temps : declaration par PRODUCTION, puis validation par ADMIN. Pour un ajustement immediat, contacter un administrateur.

---

## 5. RISQUES METIER CRITIQUES

### Risque 1 : Rupture de la chaine de tracabilite FIFO

**Niveau** : CRITIQUE
**Description** : Si les lots physiques ne sont pas consommes dans l'ordre chronologique prevu par le systeme (ex: l'atelier utilise un lot plus recent par commodite), la tracabilite du systeme ne correspond plus a la realite.

**Impact** : En cas de rappel produit, les lots PF identifies par le systeme comme concernes ne correspondent pas aux lots MP reellement utilises. Non-conformite reglementaire HACCP. Responsabilite legale en cas de probleme sanitaire.

**Mesure d'attenuation** : Former le personnel d'atelier au principe FIFO physique. Etiqueter les lots MP avec des codes couleur par semaine de reception. Effectuer des audits de tracabilite mensuels en comparant les consommations systeme aux fiches de production papier.

### Risque 2 : Ecart stock theorique / stock physique non detecte

**Niveau** : ELEVE
**Description** : Les pertes en cours de production (casse, evaporation, nettoyage) ne sont pas systematiquement declarees. Le stock theorique s'ecarte progressivement du stock reel.

**Impact** : Ordres de production crees sur la base d'un stock theorique superieur au stock reel. Echec au demarrage (stock insuffisant). Planification hebdomadaire non fiable.

**Mesure d'attenuation** : Declarer un inventaire mensuel pour chaque MP et PF. Utiliser les declarations d'inventaire (`POST /inventory/declare`) pour chaque ecart detecte. Analyser les ecarts par produit pour identifier les sources de perte systematiques.

### Risque 3 : DLC expirees non detectees (lots PF)

**Niveau** : ELEVE
**Description** : Des lots PF proches de l'expiration ne sont pas detectes a temps pour etre vendus ou degrades.

**Impact** : Perte financiere directe (destruction de stock). Risque sanitaire si des lots expires sont livres.

**Mesure d'attenuation** : Le systeme genere automatiquement des alertes `DLC_PROCHE` avec 2 niveaux : `warning` (J-7 a J-3) et `critical` (J-3 a J-0). Un job d'expiration automatique (`lot-expiry.job`) desactive les lots expires. Consulter les alertes quotidiennement.

### Risque 4 : Mono-sourcing MP critique

**Niveau** : ELEVE
**Description** : Une matiere premiere essentielle n'est approvisionnee que par un seul fournisseur. En cas de defaillance de ce fournisseur, la production est bloquee.

**Impact** : Arret complet de production pour les produits concernes. Le dashboard supply-risks affiche `isMonoSourced = true` pour ces MP.

**Mesure d'attenuation** : Consulter regulierement `GET /production/dashboard/supply-risks` qui identifie les fournisseurs bloquants. Signaler les situations de mono-sourcing a la Direction Achats pour diversifier les sources.

### Risque 5 : Rendement chroniquement faible non investigue

**Niveau** : MOYEN
**Description** : Le rendement moyen de production est inferieur aux attentes (< 95%) sans que la cause ne soit identifiee.

**Impact** : Surconsommation de matieres premieres. Cout de revient superieur aux previsions. Marge reduite.

**Mesure d'attenuation** : Utiliser `GET /production/dashboard/analytics` pour suivre l'evolution du rendement par produit et par periode. Les KPIs hebdomadaires incluent `avgYield` et `lowYieldCount` (nombre de productions avec rendement < 90%). Investiguer systematiquement tout rendement < 90%.

---

## 6. CHECKLISTS

### 6.1 Checklist quotidienne (debut de journee)

| # | Action | Endpoint / Ecran | Critere de validation |
|---|---|---|---|
| 1 | Consulter le dashboard production | `GET /production/dashboard/kpis` | KPIs du jour affiches, ordres en attente identifies |
| 2 | Verifier les alertes production | `GET /production/dashboard/alerts` | Toutes les alertes `critical` traitees ou escaladees |
| 3 | Consulter les alertes DLC proches | Alertes type `DLC_PROCHE` | Lots expirant dans 3 jours signales au Commercial |
| 4 | Verifier les productions a risque | `GET /production/dashboard/at-risk` | Actions correctives definies pour chaque production CRITICAL |
| 5 | Consulter le calendrier du jour | `GET /production/dashboard/calendar` | Productions du jour confirmees et pretes |
| 6 | Verifier les alertes stock | `GET /stock/alerts` | Ruptures et sous-seuils signales au service Appro |
| 7 | Demarrer les productions planifiees | `POST /production/:id/start` | Productions du jour demarrees avant la coupure de fin de matinee |
| 8 | Terminer les productions de la veille | `POST /production/:id/complete` | Aucun ordre IN_PROGRESS de J-1 restant |

### 6.2 Checklist hebdomadaire (vendredi)

| # | Action | Endpoint / Ecran | Critere de validation |
|---|---|---|---|
| 1 | Planifier la semaine suivante | `GET /production/planning/week` | Tous les ordres crees et dates pour S+1 |
| 2 | Verifier stock pour planning | `POST /production/planning/check-stock` | Tous les items en statut `available` |
| 3 | Analyser les risques supply chain | `GET /production/dashboard/supply-risks` | Risques BLOQUANT_PRODUCTION escales a la Direction |
| 4 | Revoir les analytics de la semaine | `GET /production/dashboard/analytics?period=week` | Rendement moyen > 95%, ecarts investigues |
| 5 | Verifier les recettes actives | `GET /recipes` | Toutes les recettes a jour, pas de recette orpheline |
| 6 | Cloturer les ordres en retard | Liste ordres PENDING > 48h | Ordres bloques annules ou replanifies |
| 7 | Exporter le rapport hebdomadaire | `GET /reports/production` + `GET /reports/export/pdf` | Rapport transmis a la Direction |

### 6.3 Checklist mensuelle

| # | Action | Endpoint / Ecran | Critere de validation |
|---|---|---|---|
| 1 | Inventaire physique complet MP | `POST /inventory/declare` pour chaque MP | Ecarts < 3% pour chaque reference |
| 2 | Inventaire physique complet PF | `POST /inventory/declare` pour chaque PF | Ecarts < 2% pour chaque reference |
| 3 | Analyse des rendements mensuels | `GET /production/dashboard/analytics?period=month` | Tendance rendement stable ou amelioree |
| 4 | Revue des recettes | `GET /recipes?includeInactive=true` | Recettes inactives archivees, actives validees |
| 5 | Rapport de production mensuel | `GET /reports/production` (mois) | Rapport compile et presente en comite de Direction |
| 6 | Analyse des causes d'annulation | Liste ordres CANCELLED du mois | Causes recurrentes identifiees, actions correctives |
| 7 | Verification des DLC expirantes M+1 | Alertes DLC a 30 jours | Liste transmise au Commercial pour action prioritaire |
| 8 | Audit tracabilite echantillon | `GET /production/lots/search` (3 lots aleatoires) | Chaine tracabilite complete : MP -> Production -> PF -> Client |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Decouverte du Dashboard Production (12 minutes)

**Titre** : "Piloter votre production en un coup d'oeil"

**Scene 1 (0:00 - 2:00) -- Connexion et navigation**
- Se connecter avec un compte role PRODUCTION
- Presenter la barre de navigation et l'acces au module Production
- Expliquer les restrictions du role : pas d'acces aux donnees financieres

**Scene 2 (2:00 - 5:00) -- KPIs du dashboard**
- Presenter les 4 cartes KPIs : aujourd'hui (completees, en cours, en attente, total produit), semaine (completees, total produit, rendement moyen, rendements faibles), mois (completees, total produit), ordres actifs et bloques
- Expliquer la signification de chaque indicateur
- Montrer la banniere d'urgence supply-risks si presente (niveau CRITIQUE, ATTENTION, OK)

**Scene 3 (5:00 - 8:00) -- Alertes et risques**
- Parcourir le panneau d'alertes : 4 types (DLC_PROCHE, RENDEMENT_FAIBLE, ORDRE_BLOQUE, STOCK_PF_BAS)
- Expliquer les niveaux de severite : `critical` (rouge), `warning` (orange), `info` (bleu)
- Montrer le panneau Productions a Risque avec les indicateurs canStart et riskLevel
- Presenter le panneau Supply Risks : MP critiques, BC en retard, fournisseurs bloquants

**Scene 4 (8:00 - 10:00) -- Calendrier et stock PF**
- Presenter la vue calendrier (7 jours avec repartition par statut)
- Montrer le resume stock PF avec les indicateurs (rupture, bas, ok)
- Expliquer les codes couleur

**Scene 5 (10:00 - 12:00) -- Synthese et bonnes pratiques**
- Routine de debut de journee en 5 etapes
- Importance de traiter les alertes critiques en priorite
- Transition vers le module 2

---

### Module 2 : Creer et lancer une production (15 minutes)

**Titre** : "De la commande a l'atelier"

**Scene 1 (0:00 - 3:00) -- L'assistant de production**
- Ouvrir le wizard via le bouton "Nouvelle production"
- Presenter les 4 etapes : Produit -> Quantite -> Verification -> Lancement
- Selectionner un produit : expliquer pourquoi seuls les produits avec recette apparaissent

**Scene 2 (3:00 - 6:00) -- Definir la quantite**
- Manipuler le compteur de batchs (+/-)
- Observer les calculs automatiques : quantite cible, poids total, DLC previsionnelle
- Renseigner la date planifiee (optionnel)

**Scene 3 (6:00 - 10:00) -- Verification du stock**
- Cliquer sur "Verifier le stock"
- Lire le tableau de disponibilite ingredient par ingredient
- Cas 1 : banniere verte "Stock suffisant" -- continuer
- Cas 2 : banniere rouge "Stock insuffisant" -- montrer comment reduire les batchs ou identifier les manques

**Scene 4 (10:00 - 12:00) -- Lancement et creation de l'ordre**
- Confirmer et lancer la production
- Observer la redirection vers la page de detail
- Montrer la reference OP-AAMMJJ-NNN generee

**Scene 5 (12:00 - 15:00) -- Demarrer la production**
- Depuis la page de detail, cliquer sur "Demarrer"
- Observer la consommation FIFO : liste des lots MP consommes avec numeros de lot et quantites
- Expliquer le statut IN_PROGRESS et ce que cela signifie pour le stock

---

### Module 3 : Terminer, annuler et gerer la qualite (12 minutes)

**Titre** : "Cloturer avec precision"

**Scene 1 (0:00 - 4:00) -- Terminer une production**
- Ouvrir un ordre IN_PROGRESS
- Saisir la quantite produite, le poids reel, le statut qualite
- Expliquer le calcul du rendement et la tolerance de perte
- Observer la creation du lot PF avec son numero et sa DLC

**Scene 2 (4:00 - 7:00) -- Gerer les ecarts de rendement**
- Scenario : rendement a 85% -- avertissement du systeme
- Expliquer quand saisir DEFAUT_MINEUR vs DEFAUT_MAJEUR
- Documenter les notes qualite pour la tracabilite

**Scene 3 (7:00 - 10:00) -- Annuler une production**
- Scenario : panne equipement
- Saisir un motif detaille (minimum 10 caracteres)
- Observer le reversal automatique des MP
- Verifier que les mouvements PRODUCTION_CANCEL apparaissent

**Scene 4 (10:00 - 12:00) -- Telecharger et archiver**
- Telecharger la fiche de production PDF
- Contenu du PDF : informations de l'ordre, consommations MP, lots produits, notes qualite
- Archivage physique et numerique

---

### Module 4 : Gestion des recettes (10 minutes)

**Titre** : "Maitriser vos nomenclatures"

**Scene 1 (0:00 - 3:00) -- Creer une recette**
- Naviguer vers l'onglet Recettes
- Remplir les parametres : nom, poids batch, quantite sortie, tolerance, duree, DLC
- Expliquer chaque parametre avec des exemples concrets fromagerie

**Scene 2 (3:00 - 6:00) -- Ajouter des ingredients**
- Les 3 types : MP (matiere premiere, impact stock), FLUID (eau/vapeur, pas d'impact stock), PACKAGING (emballage, impact stock)
- Ajouter un MP : selectionner le produit, saisir quantite et unite
- Ajouter un FLUID : nommer le fluide, saisir quantite, desactiver l'impact stock
- Expliquer mandatory vs optionnel, et le systeme de substituts

**Scene 3 (6:00 - 8:00) -- Calculer les besoins et verifier le stock**
- Utiliser "Calculer les besoins" pour N batchs
- Utiliser "Verifier le stock" pour valider la faisabilite

**Scene 4 (8:00 - 10:00) -- Modifier et versionner**
- Modifier les parametres : expliquer le verrouillage si ordres actifs
- Comprendre le systeme de versioning automatique
- Activer/desactiver une recette

---

### Module 5 : Tracabilite et planning (10 minutes)

**Titre** : "Tracabilite totale et planification efficace"

**Scene 1 (0:00 - 3:00) -- Tracabilite des lots**
- Utiliser la recherche de lots : saisir un numero de lot PF ou MP
- Tracabilite ascendante : du lot PF, remonter vers l'ordre de production, puis vers les lots MP consommes et les fournisseurs
- Tracabilite descendante : du lot MP, identifier toutes les productions et lots PF concernes

**Scene 2 (3:00 - 6:00) -- Planning hebdomadaire**
- Ouvrir la vue planning
- Comprendre la grille 7 jours et la section "Non planifies"
- Planifier et deplanifier des ordres
- Verifier le stock pour le planning complet

**Scene 3 (6:00 - 8:00) -- Historique et analytics**
- Consulter l'historique de production par produit avec filtres temporels
- Analyser les tendances de production sur la semaine, le mois, l'annee
- Identifier les top produits et les tendances de rendement

**Scene 4 (8:00 - 10:00) -- Declaration d'inventaire**
- Procedure de comptage physique
- Saisie de la declaration dans le systeme
- Comprendre le processus de validation (auto-approbation vs validation ADMIN)
- Suivi des declarations

---

## 8. MATRICE RACI

La matrice RACI definit les responsabilites croisees entre le role PRODUCTION et les autres roles du systeme pour chaque processus metier.

**Legende** : R = Responsable (execute), A = Approbateur (decide), C = Consulte, I = Informe

| Processus | PRODUCTION | ADMIN | APPRO | COMMERCIAL |
|---|---|---|---|---|
| **Creer un ordre de production** | R/A | C | I | I |
| **Demarrer une production** | R/A | I | - | - |
| **Terminer une production** | R/A | I | - | I |
| **Annuler une production** | R | A | I | I |
| **Creer/modifier une recette** | R/A | C | - | - |
| **Planifier la production hebdomadaire** | R/A | C | C | C |
| **Declarer un inventaire** | R | A | - | - |
| **Valider un inventaire** | I | R/A | - | - |
| **Ajuster le stock** | C | R/A | - | - |
| **Receptioner des MP** | I | C | R/A | - |
| **Creer un bon de commande** | I | C | R/A | - |
| **Gerer les alertes DLC** | R | C | - | I |
| **Analyser les rendements** | R | A | - | - |
| **Tracabilite / rappel produit** | R | A | C | C |
| **Bloquer un lot PF** | C | R/A | - | I |
| **Exporter rapports production** | R | A | I | I |
| **Gerer les fournisseurs** | - | A | R | - |
| **Gerer les utilisateurs** | - | R/A | - | - |
| **Facturation / prix** | - | R/A | - | R |

### Regles de collaboration inter-roles

1. **PRODUCTION -> APPRO** : Le Responsable Production communique les besoins MP via les alertes supply-risks. Il consulte les BC en lecture seule mais ne peut pas en creer.

2. **PRODUCTION -> ADMIN** : Le Responsable Production declare les inventaires ; l'ADMIN valide. Le PRODUCTION signale les anomalies de stock ; l'ADMIN effectue les ajustements.

3. **PRODUCTION -> COMMERCIAL** : Le Responsable Production signale les DLC proches et les niveaux de stock PF ; le Commercial priorise les ventes en consequence.

4. **ADMIN -> PRODUCTION** : L'ADMIN peut creer et gerer des ordres de production (acces identique). L'ADMIN gere les blocages de lots et les ajustements que le PRODUCTION ne peut pas effectuer.

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 -- Initial (Mois 1-2)

**Objectif** : L'operateur maitrise les operations de base.

| Competence | Critere de validation |
|---|---|
| Creer un ordre de production | 10 ordres crees sans erreur |
| Demarrer et terminer une production | 10 cycles complets sans assistance |
| Consulter le dashboard | Navigation autonome dans les KPIs et alertes |
| Lire les alertes stock | Comprendre la signification de chaque type d'alerte |
| Generer un PDF de production | 5 fiches PDF generees et archivees |

**Indicateurs** : Temps moyen de saisie d'un cycle complet < 10 minutes. Zero erreur de saisie de quantite sur les 10 derniers ordres.

### Niveau 2 -- Repetable (Mois 3-4)

**Objectif** : L'operateur gere les recettes et le planning de maniere autonome.

| Competence | Critere de validation |
|---|---|
| Creer et modifier des recettes | 5 recettes creees, parametres corrects |
| Planifier sur la semaine | 4 semaines planifiees sans rupture |
| Verifier le stock pour le planning | Utilisation systematique du check-stock avant validation |
| Declarer un inventaire | 3 declarations avec ecart < 3% |
| Annuler une production | 2 annulations avec motif detaille et reversal verifie |

**Indicateurs** : Rendement moyen > 93%. Taux de planification des ordres > 80%. Zero ordre bloque > 48h.

### Niveau 3 -- Defini (Mois 5-6)

**Objectif** : L'operateur optimise la production et anticipe les problemes.

| Competence | Critere de validation |
|---|---|
| Analyser les rendements par produit | Utilisation reguliere des analytics |
| Utiliser la tracabilite complete | Tracabilite ascendante et descendante maitrisee |
| Anticiper les risques supply chain | Consultation quotidienne des supply-risks |
| Gerer les alertes DLC proactivement | Zero lot expire en stock depuis 2 mois |
| Former un collegue niveau 1 | Tutorat valide par le formateur |

**Indicateurs** : Rendement moyen > 95%. Taux de respect du planning > 90%. Checklists quotidiennes et hebdomadaires completees a 100%.

### Niveau 4 -- Maitrise (Mois 7-12)

**Objectif** : L'operateur est referent production et contribue a l'amelioration continue.

| Competence | Critere de validation |
|---|---|
| Optimiser les recettes | 3 ameliorations de recette documentees |
| Analyser les tendances annuelles | Rapport d'analyse annuel presente en comite |
| Proposer des ameliorations systeme | 2 suggestions implementees |
| Gerer les situations de crise | 1 annulation complexe (reversal multi-lots) geree sans escalade |
| Maitriser les exports et rapports | Rapports Excel et PDF generes pour audit externe |

**Indicateurs** : Rendement moyen > 97%. Zero rupture de tracabilite sur audit annuel. Temps de cycle de saisie < 5 minutes.

### Niveau 5 -- Excellence (12+ mois)

**Objectif** : L'operateur est expert referent, capable de former, auditer et optimiser l'ensemble du processus de production.

| Competence | Critere de validation |
|---|---|
| Auditer la tracabilite d'autres operateurs | 3 audits realises |
| Contribuer aux evolutions du systeme | Participation aux specifications fonctionnelles |
| Gerer le reporting Direction | Rapport mensuel autonome |
| Anticiper les besoins a 30 jours | Planning mensuel avec verification stock validee |
| Representer la production en audit externe | Audit HACCP passe avec zero non-conformite production |

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Optimisation des processus

**R1 -- Automatiser les alertes DLC par email/SMS**
Le systeme genere les alertes DLC mais ne notifie pas activement les utilisateurs. Recommandation : implementer un job quotidien qui envoie un email recapitulatif des alertes `critical` au Responsable Production et au Responsable Commercial.

**R2 -- Implementer le demarrage conditionnel**
Actuellement, le systeme verifie le stock au demarrage mais ne verifie pas la disponibilite des equipements ni la validite des analyses qualite MP. Recommandation : ajouter un pre-checklist configurable avant le demarrage (equipement propre, analyses OK, personnel present).

**R3 -- Ajouter le suivi des temps de production**
La recette inclut un `productionTime` (en minutes) mais ce temps n'est pas compare au temps reel (`completedAt - startedAt`). Recommandation : calculer et afficher automatiquement l'ecart temps prevu vs temps reel dans les analytics.

### 10.2 Optimisation des donnees

**R4 -- Enrichir les analytics avec des benchmarks**
Les analytics actuels montrent les tendances mais sans objectifs. Recommandation : definir des objectifs par produit (rendement cible, temps de production cible, cout de revient cible) et afficher les ecarts dans le dashboard.

**R5 -- Ajouter des KPIs de productivite**
Les KPIs actuels se concentrent sur les volumes. Recommandation : ajouter des KPIs de productivite : unites produites par heure, taux d'utilisation des equipements, taux de premiere passe (productions sans retouche).

**R6 -- Historiser les versions de recettes**
Le systeme incremente la version mais ne conserve pas un historique des modifications. Recommandation : creer un journal des modifications de recette pour la tracabilite complete (qui a modifie quoi, quand).

### 10.3 Optimisation de l'experience utilisateur

**R7 -- Ajouter un mode de saisie rapide sur mobile**
L'interface actuelle du wizard est optimisee pour le desktop. Pour les operations en atelier, recommander l'utilisation de la vue mobile (`ProductionMobileView`) avec des boutons d'action rapide.

**R8 -- Implementer la lecture de codes-barres**
Pour accelerer la verification physique des lots MP en zone de production : scanner le code-barres du lot pour confirmer automatiquement la correspondance avec le lot FIFO prevu par le systeme.

**R9 -- Ajouter des tableaux de bord par equipe/shift**
Pour les fromageries fonctionnant en equipes (matin/apres-midi/nuit) : filtrer les KPIs et le calendrier par equipe pour responsabiliser chaque shift.

### 10.4 Optimisation de la conformite

**R10 -- Generer automatiquement le registre HACCP**
Les donnees de tracabilite (lots MP -> production -> lots PF -> consommations -> qualite) sont toutes presentes dans le systeme. Recommandation : generer un export PDF conforme au format registre HACCP pour les inspections sanitaires.

---

## 11. GLOSSAIRE METIER

| Terme | Definition |
|---|---|
| **Batch** | Unite de production correspondant a une charge complete de la ligne de fabrication. La quantite et le poids d'un batch sont definis dans la recette (`batchWeight` en grammes, `outputQuantity` en unites). |
| **BC (Bon de Commande)** | Document d'approvisionnement emis vers un fournisseur pour l'achat de matieres premieres. Visible en lecture seule par le role PRODUCTION via le module Appro. |
| **BL (Bon de Livraison)** | Document accompagnant une reception de marchandise. Reference enregistree dans le systeme lors de la reception MP. |
| **DLC (Date Limite de Consommation)** | Date au-dela de laquelle un produit fini ne doit plus etre vendu ni consomme. Calculee automatiquement : `DLC = date de fabrication + shelfLifeDays`. |
| **FIFO (First In, First Out)** | Methode de gestion des stocks imposant la consommation des lots les plus anciens en priorite. Le systeme ordonne les lots par `createdAt` puis `expiryDate` (ascendant). |
| **KPI (Key Performance Indicator)** | Indicateur cle de performance. Les KPIs production incluent : nombre d'ordres completes, quantite produite, rendement moyen, ordres bloques. |
| **Lot MP** | Lot de matiere premiere identifie par un numero unique. Chaque lot a un statut (`AVAILABLE`, `BLOCKED`, `CONSUMED`), une quantite restante et une date d'expiration. |
| **Lot PF** | Lot de produit fini cree a l'issue d'une production. Identifie par un numero unique au format `{CODE}-AAMMJJ-NNN`. Associe a un ordre de production pour la tracabilite. |
| **MP (Matiere Premiere)** | Ingredient entrant dans la composition d'un produit fini. Types dans les recettes : MP (stock impacte), FLUID (eau/vapeur, pas d'impact stock), PACKAGING (emballage, stock impacte). |
| **OP (Ordre de Production)** | Document systeme ordonnant la fabrication d'un produit fini. Reference au format `OP-AAMMJJ-NNN`. Cycle de vie : PENDING -> IN_PROGRESS -> COMPLETED ou CANCELLED. |
| **PF (Produit Fini)** | Produit fabrique pret a la vente. Chaque PF est associe a une recette unique. |
| **Rendement** | Ratio entre la quantite produite et la quantite cible : `yieldPercentage = (quantityProduced / targetQuantity) * 100`. Un rendement de 100% signifie que la production correspond exactement a l'objectif. |
| **Reversal (Annulation comptable)** | Operation inverse d'une consommation. Lors de l'annulation d'une production, les quantites MP consommees sont restaurees dans les lots d'origine. Les consommations sont marquees `isReversed = true` sans etre supprimees (tracabilite). |
| **Tolerance de perte (lossTolerance)** | Pourcentage de perte acceptable defini dans la recette (defaut: 2%). Un rendement inferieur a `(1 - lossTolerance) * 100%` declenche un avertissement metier. |
| **Tracabilite** | Capacite a reconstituer l'historique complet d'un lot PF : quelles MP ont ete utilisees (lots MP, fournisseurs), par quel ordre de production, a quelle date, par quel operateur. |
| **Supply Risk** | Risque d'approvisionnement identifie par le systeme. Niveaux : `BLOQUANT_PRODUCTION` (production impossible), `RISQUE_48H` (couverture < 2 jours), `RISQUE_72H` (couverture < 3 jours), `SURVEILLANCE` (sous seuil de commande). |
| **Couverture stock** | Nombre de jours de production possibles avec le stock disponible. Calculee a partir de la consommation moyenne quotidienne. |
| **Cache invalidation** | Mecanisme technique : apres chaque operation modifiant le stock (demarrage, completion, annulation), les caches Redis sont invalides pour garantir que les lectures suivantes refletent l'etat reel. |
| **Transaction atomique** | Garantie technique : un ensemble d'operations est execute en tout-ou-rien. Si une etape echoue, toutes les etapes precedentes sont annulees. Protege contre les etats incoherents. |
| **Idempotency key** | Cle unique (`PROD-{orderId}-{productMpId}`) empechant la double consommation d'une meme MP pour un meme ordre, meme si la requete est rejouee. |
| **HACCP** | Hazard Analysis Critical Control Point. Systeme de maitrise de la securite sanitaire des aliments. Les donnees de tracabilite du systeme contribuent a la conformite HACCP. |

---

## 12. ANNEXES

### Annexe A : Diagramme des statuts d'un ordre de production

```
                    ┌─────────────────────────────┐
                    │          CREATION            │
                    │   POST /production           │
                    │   Reference: OP-AAMMJJ-NNN  │
                    └──────────┬──────────────────┘
                               │
                               v
                    ┌──────────────────────┐
                    │       PENDING        │
                    │   "En attente"       │
                    │                      │
                    │  Actions possibles:  │
                    │  - Demarrer (start)  │
                    │  - Annuler (cancel)  │
                    │  - Replanifier       │
                    └────┬───────────┬─────┘
                         │           │
              start      │           │  cancel (pas de reversal)
                         v           v
              ┌──────────────┐  ┌──────────────┐
              │ IN_PROGRESS  │  │  CANCELLED   │
              │ "En cours"   │  │  "Annule"    │
              │              │  │              │
              │ MP consomme  │  │  Statut      │
              │ FIFO actif   │  │  terminal    │
              └──┬────────┬──┘  └──────────────┘
                 │        │
       complete  │        │  cancel (avec reversal MP)
                 v        v
     ┌──────────────┐  ┌──────────────┐
     │  COMPLETED   │  │  CANCELLED   │
     │  "Termine"   │  │  "Annule"    │
     │              │  │              │
     │  Lot PF cree │  │  MP restaure │
     │  Rendement   │  │  isReversed  │
     │  calcule     │  │  = true      │
     │  Statut      │  │  Statut      │
     │  terminal    │  │  terminal    │
     └──────────────┘  └──────────────┘
```

### Annexe B : Schema de consommation FIFO

```
Ordre de production OP-260224-001
    Recette: Fromage Fondu 400g
    Batchs: 5

    Ingredient: Lait en poudre (MP-001)
    Besoin total: 500 kg

    FIFO Resolution:
    ┌────────────────────────────────────────────────────┐
    │ Lot L-MP001-260210-002 (reception 10/02) │ 200 kg │ --> Consomme 200 kg (epuise)
    │ Lot L-MP001-260215-001 (reception 15/02) │ 350 kg │ --> Consomme 300 kg (50 kg restants)
    │ Lot L-MP001-260220-003 (reception 20/02) │ 180 kg │ --> Non touche
    └────────────────────────────────────────────────────┘

    StockMovements crees:
    - OUT | PRODUCTION_OUT | MP-001 | Lot ...002 | -200 kg | OP-260224-001
    - OUT | PRODUCTION_OUT | MP-001 | Lot ...001 | -300 kg | OP-260224-001

    ProductionConsumptions creees:
    - lotMpId: ...002 | quantityPlanned: 200 | quantityConsumed: 200
    - lotMpId: ...001 | quantityPlanned: 300 | quantityConsumed: 300
```

### Annexe C : Calcul du rendement et de la DLC

**Rendement :**
```
targetQuantity = outputQuantity * batchCount = 100 * 5 = 500 unites
quantityProduced = 482 unites (saisie operateur)
yieldPercentage = (482 / 500) * 100 = 96.4%

Tolerance de perte = lossTolerance = 0.02 (2%)
Seuil minimum acceptable = 500 * (1 - 0.02) = 490 unites
482 < 490 --> Avertissement PRODUCTION_LOW_YIELD journalise
```

**DLC :**
```
manufactureDate = 2026-02-24T14:30:00Z (horodatage de completion)
shelfLifeDays = 90 jours
expiryDate = 2026-02-24 + 90 jours = 2026-05-25T14:30:00Z
```

**Cout de revient :**
```
Consommation 1: Lot MP-001 | 200 kg * 850 DA/kg = 170 000 DA
Consommation 2: Lot MP-001 | 300 kg * 870 DA/kg = 261 000 DA
Consommation 3: Lot MP-003 | 120 kg * 1200 DA/kg = 144 000 DA
...
Total cout MP = 575 000 DA
unitCost = 575 000 / 482 = 1 193 DA/unite
```

### Annexe D : Referentiel des alertes production

| Type alerte | Severite | Condition de declenchement | Frequence de calcul | Action attendue |
|---|---|---|---|---|
| `DLC_PROCHE` | `critical` | Lot PF expire dans <= 3 jours, quantite > 0, actif | Chaque appel au dashboard | Signaler au Commercial pour vente prioritaire |
| `DLC_PROCHE` | `warning` | Lot PF expire dans 4-7 jours, quantite > 0, actif | Chaque appel au dashboard | Planifier la vente dans la semaine |
| `RENDEMENT_FAIBLE` | `critical` | Rendement < 80% sur les 7 derniers jours | Chaque appel au dashboard | Investigation immediate des causes |
| `RENDEMENT_FAIBLE` | `warning` | Rendement < 90% sur les 7 derniers jours | Chaque appel au dashboard | Surveillance et analyse |
| `ORDRE_BLOQUE` | `critical` | Ordre PENDING depuis > 48h | Chaque appel au dashboard | Annuler ou demarrer l'ordre immediatement |
| `ORDRE_BLOQUE` | `warning` | Ordre PENDING depuis > 24h | Chaque appel au dashboard | Verifier les conditions de demarrage |
| `STOCK_PF_BAS` | `critical` | Stock PF < 25% du minimum | Chaque appel au dashboard | Planifier une production urgente |
| `STOCK_PF_BAS` | `warning` | Stock PF < minimum defini | Chaque appel au dashboard | Planifier une production dans la semaine |

### Annexe E : Referentiel des niveaux de risque supply chain

| Etat | Condition | Impact production | Couleur UI |
|---|---|---|---|
| `BLOQUANT_PRODUCTION` | Stock MP = 0 ou insuffisant pour toute recette active | Production impossible | Rouge |
| `RISQUE_48H` | Couverture stock < 2 jours | Production menacee a court terme | Orange |
| `RISQUE_72H` | Couverture stock < 3 jours | Production menacee a moyen terme | Jaune |
| `SURVEILLANCE` | Stock sous seuil de commande | Approvisionnement necessaire | Bleu |
| `OK` | Stock suffisant | Pas de risque identifie | Vert |

### Annexe F : Permissions detaillees par endpoint

| Endpoint | ADMIN | PRODUCTION | APPRO | COMMERCIAL |
|---|---|---|---|---|
| `POST /production` | Oui | **Oui** | Non | Non |
| `POST /production/:id/start` | Oui | **Oui** | Non | Non |
| `POST /production/:id/complete` | Oui | **Oui** | Non | Non |
| `POST /production/:id/cancel` | Oui | **Oui** | Non | Non |
| `GET /production/*` | Oui | **Oui** | Non | Non |
| `GET/POST/PUT/DELETE /recipes/*` | Oui | **Oui** | Non | Non |
| `GET /stock/mp` (sans financier) | Oui (complet) | **Oui** (masque) | Oui (complet) | Non |
| `GET /stock/pf` (sans financier) | Oui (complet) | **Oui** (masque) | Non | Oui (complet) |
| `POST /inventory/declare` | Oui | **Oui** | Oui | Non |
| `POST /inventory/:id/validate` | Oui | Non | Non | Non |
| `POST /stock/mp/receptions` | Oui | Non | Oui | Non |
| `POST /stock/mp/inventory` | Oui | Non | Non | Non |
| `POST /stock/loss` | Oui | Non | Non | Non |
| `GET /appro/*` | Oui | **Oui** (lecture) | Oui | Non |

### Annexe G : Structure du PDF de production

Le fichier PDF genere par `GET /production/:id/pdf` contient les sections suivantes :

1. **En-tete entreprise** : Logo Manchengo, raison sociale "EURL MANCHENGO", adresse (Lot 05, grp propriete 342, local n 01, Ouled Chbel - Alger), RC, NIF, telephones.
2. **Titre** : "FICHE DE PRODUCTION" + reference de l'ordre.
3. **Informations** : Produit (nom, code), recette utilisee, createur de l'ordre.
4. **Statut** : Statut actuel, nombre de batchs, quantite cible, quantite produite, rendement.
5. **Dates** : Creation, demarrage, completion.
6. **Consommations MP** : Tableau avec colonnes Matiere Premiere, Lot, Prevu, Consomme.
7. **Lots produits** : Tableau avec colonnes N Lot, Quantite, Date Fabrication, DLC.
8. **Notes qualite** : Statut qualite et notes textuelles.

### Annexe H : Formules de calcul de reference

| Calcul | Formule | Exemple |
|---|---|---|
| Quantite cible | `outputQuantity * batchCount` | 100 * 5 = 500 unites |
| Poids total batch | `batchWeight * batchCount` | 50000g * 5 = 250000g = 250 kg |
| Besoin MP par ingredient | `quantity * batchCount` | 100 kg * 5 = 500 kg |
| Rendement | `(quantityProduced / targetQuantity) * 100` | (482 / 500) * 100 = 96.4% |
| Seuil rendement minimum | `targetQuantity * (1 - lossTolerance)` | 500 * (1 - 0.02) = 490 |
| DLC | `manufactureDate + shelfLifeDays jours` | 24/02/2026 + 90j = 25/05/2026 |
| Cout unitaire PF | `SUM(quantityConsumed * unitCost) / quantityProduced` | 575000 / 482 = 1193 DA |
| Couverture stock (jours) | `stockActuel / consommationMoyenneQuotidienne` | 500 kg / 100 kg/jour = 5 jours |
| Ecart inventaire | `declaredQuantity - stockTheorique` | 480 - 500 = -20 unites |

---

**FIN DU DOCUMENT**

*Manchengo Smart ERP -- Module Production -- Manuel Utilisateur v2.0.0*
*Document genere le 24/02/2026 -- Classification INTERNE*
*EURL MANCHENGO -- Lot 05, grp propriete 342, Ouled Chbel, Alger*
*RC: 25 B 1204921 16/00 | NIF: 002516120492183*

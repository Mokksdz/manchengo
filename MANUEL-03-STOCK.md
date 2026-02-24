# MANUEL UTILISATEUR -- RESPONSABLE STOCK

## Manchengo Smart ERP -- Module Stock & Inventaire

| Attribut | Valeur |
|---|---|
| **Version du document** | 3.0.0 |
| **Date de publication** | 24 fevrier 2026 |
| **Classification** | CONFIDENTIEL -- Usage interne |
| **Redige par** | Direction des Systemes d'Information |
| **Valide par** | Direction Generale, Direction Qualite |
| **Destinataires** | Responsable Stock, ADMIN, Equipe Approvisionnement |
| **ERP** | Manchengo Smart ERP (NestJS + Next.js 14) |
| **Infrastructure** | Railway (Backend) / Vercel (Frontend) / PostgreSQL / Redis |

---

## TABLE DES MATIERES

1. [Fiche d'Identite du Role](#1-fiche-didentite-du-role)
2. [Workflow Complet (Step-by-Step)](#2-workflow-complet-step-by-step)
3. [Scenarios Reels](#3-scenarios-reels)
4. [Erreurs Humaines Frequentes](#4-erreurs-humaines-frequentes)
5. [Risques Metier Critiques](#5-risques-metier-critiques)
6. [Checklists Quotidienne / Hebdomadaire / Mensuelle](#6-checklists-quotidienne--hebdomadaire--mensuelle)
7. [Scripts de Formation Video](#7-scripts-de-formation-video)
8. [Matrice RACI](#8-matrice-raci)
9. [Niveaux de Maturite](#9-niveaux-de-maturite)
10. [Recommandations d'Optimisation](#10-recommandations-doptimisation)
11. [Glossaire Metier](#11-glossaire-metier)
12. [Annexes](#12-annexes)

---

## 1. FICHE D'IDENTITE DU ROLE

### 1.1 Designation et Perimetre

| Attribut | Detail |
|---|---|
| **Intitule du poste** | Responsable Stock / Responsable Magasin |
| **Role systeme ERP** | `APPRO` (Approvisionnement) |
| **Roles complementaires requis** | Coordination avec `ADMIN` pour les operations sensibles (ajustements, pertes, validations inventaire) |
| **Rattachement hierarchique** | Direction des Operations / Direction Supply Chain |
| **Perimetre fonctionnel** | Gestion integrale des stocks MP (Matieres Premieres) et PF (Produits Finis), tracabilite des lots, inventaires physiques, alertes stock, valorisation |

### 1.2 Missions Principales

Le Responsable Stock dans Manchengo Smart ERP est en charge de :

1. **Reception et controle des matieres premieres** : Enregistrement des receptions fournisseur (endpoint `POST /stock/mp/receptions`), verification des quantites, dates de fabrication, DLC (Date Limite de Consommation) et numeros de lots fournisseur.

2. **Gestion des lots et tracabilite FIFO** : Surveillance des lots MP et PF, respect strict du principe FIFO (First In, First Out) ou les lots les plus anciens sont consommes en priorite (tri par `createdAt` puis `expiryDate`).

3. **Pilotage des inventaires physiques** : Declaration des comptages physiques via `POST /inventory/declare`, suivi des ecarts, coordination avec l'ADMIN pour les validations.

4. **Surveillance des alertes stock** : Consultation quotidienne des alertes de rupture, sous-seuil et DLC proche via `GET /stock/alerts` et le dashboard stock (`GET /stock/dashboard`).

5. **Valorisation et reporting** : Suivi de la valeur du stock PF (`GET /stock/value`), export des rapports de mouvements et de valorisation en Excel/PDF.

6. **Coordination des pertes et ajustements** : Remontee des constatations de perte a l'ADMIN qui dispose des droits exclusifs de declaration (`POST /stock/loss`) et d'ajustement inventaire direct (`POST /stock/mp/inventory`, `POST /stock/pf/inventory`).

### 1.3 Droits d'Acces Systeme

| Fonctionnalite | APPRO (Resp. Stock) | ADMIN | PRODUCTION | COMMERCIAL |
|---|---|---|---|---|
| Consulter stock MP | Oui | Oui | Oui (sans prix) | Non |
| Consulter stock PF | Non | Oui | Oui (sans prix) | Oui |
| Creer reception MP | **Oui** | Oui | Non | Non |
| Ajustement inventaire direct | Non | **Exclusif** | Non | Non |
| Declarer une perte | Non | **Exclusif** | Non | Non |
| Declarer inventaire physique | **Oui** | Oui | Oui | Non |
| Valider/Rejeter inventaire | Non | **Exclusif** | Non | Non |
| Voir inventaires en attente | **Oui** | Oui | Non | Non |
| Alertes stock | **Oui** | Oui | Oui | Non |
| Valorisation stock PF | **Oui** | Oui | Non | Non |
| Dashboard stock complet | **Oui** | Oui | Oui | Non |
| Consulter lots MP | **Oui** | Oui | Oui | Non |
| Consulter lots PF | Non | Oui | Oui | Oui |
| Lots expirant (DLC) | **Oui** | Oui | Oui | Non |
| Ajuster quantite lot | Non | **Exclusif** | Non | Non |
| Export Excel/PDF | **Oui** | Oui | Non | Non |

### 1.4 Indicateurs de Performance du Role (KPI)

| KPI | Cible | Source de calcul |
|---|---|---|
| Taux d'ecart moyen inventaire | < 2% | `GET /stock/dashboard` (zone Sante : `avgInventoryDrift`) |
| Fraicheur des inventaires | > 80% des produits inventories sous 30 jours | `inventoryFreshness` dans la zone Sante |
| Nombre de ruptures MP bloquantes par mois | 0 | Dashboard critique `productsInRupture` |
| Nombre de lots expires non declares en perte | 0 | Dashboard critique `lotsBlockedToDeclare` |
| Compliance FIFO | > 95% | `fifoCompliance` dans la zone Sante |
| Delai moyen de traitement des alertes critiques | < 4 heures | Temps entre creation alerte et resolution |
| Score de sante global stock | > 70/100 | `healthScore` dans le summary du dashboard |

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Reception Fournisseur

**Objectif** : Enregistrer une livraison de matieres premieres dans le systeme, creer les lots associes et mettre a jour le stock en temps reel.

**Endpoint principal** : `POST /stock/mp/receptions`
**Roles autorises** : `ADMIN`, `APPRO`

#### Etape A1 : Preparation de la reception

1. **Verifier le bon de livraison (BL) physique** remis par le transporteur. Comparer avec le bon de commande (BC) emis precedemment (`BC-YYYY-NNNNN`).
2. **Controler visuellement** : etat des emballages, chaine du froid respectee (pour les matieres perissables), absence de deterioration.
3. **Compter physiquement** chaque reference MP livree. Noter les quantites reelles sur le BL en les comparant avec les quantites commandees.

#### Etape A2 : Saisie dans le systeme

Acceder au module Stock, section "Receptions MP". Remplir le formulaire de reception :

```
POST /stock/mp/receptions
{
  "supplierId": 3,                    // ID fournisseur (obligatoire, entier positif)
  "date": "2026-02-24T09:00:00Z",    // Date ISO de reception (obligatoire)
  "blNumber": "BL-2026-00458",       // Numero du BL fournisseur (optionnel)
  "note": "Reception complete, conforme au BC-2026-00123",
  "lines": [
    {
      "productMpId": 1,              // ID matiere premiere (obligatoire)
      "quantity": 500,               // Quantite recue en unite de base (obligatoire, max 1 000 000)
      "unitCost": 15000,             // Cout unitaire HT en centimes (optionnel, max 100 000 000)
      "lotNumber": "LOT-FOUR-2026-A", // Numero de lot fournisseur (optionnel)
      "expiryDate": "2026-08-24",    // DLC (optionnel, format ISO)
      "manufactureDate": "2026-02-15" // Date de fabrication (optionnel, format ISO)
    },
    {
      "productMpId": 5,
      "quantity": 200,
      "unitCost": 8500,
      "expiryDate": "2026-12-31"
    }
  ]
}
```

**Regles de validation** :
- Au moins une ligne de reception est requise (`ArrayMinSize(1)`)
- Chaque `quantity` doit etre un entier strictement positif, ne depassant pas 1 000 000
- Le `unitCost` est en centimes (ex: 150,00 DA = 15000 centimes)
- Le `supplierId` doit correspondre a un fournisseur actif et non bloque dans le systeme

#### Etape A3 : Validation et creation atomique

Lors de la validation, le systeme execute en une seule transaction atomique :

1. **Creation de la reception** avec la reference auto-generee `REC-YYMMDD-NNN` et le statut `DRAFT`.
2. **Creation des lots MP** pour chaque ligne : le systeme genere un numero de lot interne `LYYMMDD-NNN` (ex: `L260224-001`), renseigne `quantityInitial` et `quantityRemaining`, le `supplierId`, et le statut `AVAILABLE`.
3. **Creation des mouvements de stock** de type `IN` avec l'origine `RECEPTION`, incluant la cle d'idempotence (`idempotencyKey`) pour la protection anti-double-clic, et le `lotSnapshot` (etat du lot avant/apres).
4. **Calcul de la TVA** par ligne (taux applicables en Algerie : 0%, 9%, 19%) avec generation des montants HT, TVA et TTC.
5. **Passage au statut** `VALIDATED`.
6. **Audit** : un enregistrement dans `audit_logs` avec l'action `STOCK_RECEPTION_CREATED`, l'identite de l'operateur, l'adresse IP, et les etats avant/apres.

#### Etape A4 : Verification post-reception

- Consulter `GET /stock/mp` pour verifier que les quantites ont ete correctement incrementees.
- Consulter `GET /stock/mp/{id}/movements` pour chaque MP recue afin de confirmer que le mouvement `IN / RECEPTION` apparait.
- Verifier que les lots crees apparaissent dans `GET /lots/mp?productId={id}` avec le statut `AVAILABLE`.

---

### Workflow B : Gestion des Lots (FIFO, Blocage/Deblocage, DLC, Tracabilite)

**Objectif** : Assurer la tracabilite complete des lots MP et PF, garantir le respect du FIFO, et gerer les blocages qualite et DLC.

#### Etape B1 : Consultation des lots actifs

- **Lots MP** : `GET /lots/mp` ou `GET /lots/mp?productId=3` pour un produit specifique. Le parametre `includeInactive=true` permet de voir egalement les lots epuises (`CONSUMED`).
- **Lots PF** : `GET /lots/pf` ou `GET /lots/pf?productId=7`.
- **Stock disponible** : `GET /lots/mp/{productId}/stock` retourne le stock disponible (hors lots expires/bloques), le nombre de lots expires et le total de lots.

Chaque lot expose les attributs suivants :
- `lotNumber` : identifiant unique (ex: `L260224-001`)
- `quantityInitial` / `quantityRemaining` : quantites initiale et restante
- `manufactureDate` / `expiryDate` : dates de fabrication et DLC
- `status` : `AVAILABLE`, `BLOCKED`, ou `CONSUMED`
- `blockedReason` : motif de blocage (`DLC_EXPIRED_AUTO`, `QUALITY`, `MANUAL`)
- `supplierId` et `receptionId` : tracabilite amont

#### Etape B2 : Respect du FIFO

Le systeme impose le FIFO automatiquement :
- L'index de base de donnees `idx_lots_mp_fifo` trie les lots par `productId`, `status`, `createdAt`, puis `expiryDate`.
- Lors de chaque consommation (production, vente), le systeme selectionne automatiquement le lot le plus ancien disponible.
- Le Responsable Stock doit verifier via le dashboard que le taux de compliance FIFO reste superieur a 95%.

**Point de controle** : Si un operateur de production tente de consommer un lot plus recent alors qu'un lot plus ancien est disponible, le systeme forcera l'utilisation du lot le plus ancien. Il n'existe pas de mecanisme de contournement sans intervention ADMIN.

#### Etape B3 : Blocage automatique DLC

Un job planifie (`Cron '5 0 * * *'` -- execute chaque jour a 00h05) effectue le blocage automatique des lots dont la DLC est depassee :
- Requete sur tous les lots `AVAILABLE` avec `expiryDate < aujourd'hui` et `quantityRemaining > 0`.
- Passage en statut `BLOCKED` avec `blockedReason = 'DLC_EXPIRED_AUTO'`.
- Enregistrement dans `audit_logs` avec le detail du lot, sa valeur estimee et le motif.
- Creation d'une alerte consolidee de severite `CRITICAL`.

**Regle metier stricte** : Un lot bloque pour DLC ne peut PAS etre debloque. Le seul mouvement autorise est la declaration de perte (`PERTE`).

#### Etape B4 : Blocage manuel (Qualite)

Un ADMIN peut bloquer manuellement un lot pour des raisons qualite. Le `blockedReason` sera alors `QUALITY` ou `MANUAL`, et le lot sera exclu de toute consommation future (FIFO le contourne automatiquement).

#### Etape B5 : Alertes pre-expiration

Un second job planifie (`Cron '0 8 * * *'` -- execute chaque jour a 08h00) genere des alertes proactives :

| Horizon | Severite | Action attendue |
|---|---|---|
| J-7 | `INFO` | Planifier la consommation du lot |
| J-3 | `WARNING` | Prioriser la consommation / Promouvoir la vente |
| J-1 | `CRITICAL` | Action immediate : consommer ou preparer declaration perte |

Le Responsable Stock doit consulter quotidiennement le dashboard stock (`GET /stock/dashboard`) qui affiche ces alertes dans les zones "Critique" et "A Traiter".

---

### Workflow C : Inventaire Physique

**Objectif** : Reconcilier le stock theorique calcule par le systeme avec le stock physique reel, detecter les ecarts, et les corriger de maniere tracee et securisee.

**Endpoint principal** : `POST /inventory/declare`
**Roles autorises pour la declaration** : `ADMIN`, `APPRO`, `PRODUCTION`
**Roles autorises pour la validation/rejet** : `ADMIN` uniquement

#### Etape C1 : Preparation du comptage

1. **Consulter le stock theorique** : `GET /stock/mp/{id}/stock` pour obtenir la quantite theorique calculee (somme des IN - somme des OUT, mouvements non supprimes).
2. **Organiser le comptage physique** dans les zones de stockage appropriees selon le type de stockage :
   - `REFRIGERE` : 2-8 degres C (chambres froides)
   - `FRAIS` : 0-4 degres C
   - `SEC` : Temperature ambiante
   - `CONGELE` : -18 degres C
3. **Preparer les fiches de comptage** avec les codes produits et les zones de stockage.

#### Etape C2 : Declaration dans le systeme

```
POST /inventory/declare
{
  "productType": "MP",         // "MP" ou "PF"
  "productId": 3,              // ID du produit
  "declaredQuantity": 480,     // Quantite physique comptee (minimum 0)
  "notes": "Comptage zone frigo A, ecart sur sacs ouverts entames",
  "evidencePhotos": ["https://storage.../photo1.jpg"]  // Preuves photographiques
}
```

#### Etape C3 : Analyse automatique par le systeme

Le systeme effectue immediatement l'analyse suivante :

1. **Calcul du stock theorique** via agregation des mouvements (`IN - OUT` non supprimes).
2. **Calcul de l'ecart** : `difference = declaredQuantity - theoreticalStock`
3. **Calcul du pourcentage d'ecart** : `|difference| / theoreticalStock * 100`
4. **Calcul de la valeur d'ecart** : `|difference| * unitCost` (cout moyen des lots pour MP, prix HT pour PF)
5. **Determination du niveau de risque et du statut** selon les seuils configures :

**Seuils pour MP perissables** :
| Ecart | Risque | Statut | Validation requise |
|---|---|---|---|
| 0-2% | `LOW` | `AUTO_APPROVED` | Aucune (mouvement cree automatiquement) |
| 2-5% | `MEDIUM` | `PENDING_VALIDATION` | 1 ADMIN |
| 5-10% | `HIGH` | `PENDING_VALIDATION` | 1 ADMIN + preuves obligatoires |
| >10% ou valeur >50 000 DA | `CRITICAL` | `PENDING_DOUBLE_VALIDATION` | 2 ADMIN differents + preuves |

**Seuils pour MP non perissables** :
| Ecart | Risque | Statut | Validation requise |
|---|---|---|---|
| 0-3% | `LOW` | `AUTO_APPROVED` | Aucune |
| 3-8% | `MEDIUM` | `PENDING_VALIDATION` | 1 ADMIN |
| >8% ou valeur >50 000 DA | `HIGH`/`CRITICAL` | Validation/Double validation | 1 ou 2 ADMIN |

**Seuils pour PF** :
| Ecart | Risque | Statut | Validation requise |
|---|---|---|---|
| 0-1% | `LOW` | `AUTO_APPROVED` | Aucune |
| 1-3% | `MEDIUM` | `PENDING_VALIDATION` | 1 ADMIN |
| >3% ou valeur >50 000 DA | `HIGH`/`CRITICAL` | Validation/Double validation | 1 ou 2 ADMIN |

#### Etape C4 : Controles anti-fraude automatiques

- **Cooldown de 4 heures** : Il est impossible de declarer un inventaire pour le meme produit si un inventaire non rejete/expire a ete effectue dans les 4 dernieres heures. Le systeme retourne l'erreur `INVENTORY_COOLDOWN`.
- **Detection de pattern suspect** : Si le meme compteur a declare 3 ecarts negatifs consecutifs ou plus sur le meme produit au cours des 30 derniers jours, le systeme force le passage en `PENDING_VALIDATION` meme si l'ecart est sous le seuil d'auto-approbation. Une alerte `SUSPICIOUS_INVENTORY_PATTERN` est generee.

#### Etape C5 : Suivi des declarations en attente

Le Responsable Stock consulte les declarations en attente via :
```
GET /inventory/pending
```
Retourne la liste triee par `riskLevel DESC, countedAt ASC` (les plus critiques et les plus anciennes en premier), incluant pour chaque declaration : le type de produit, le nom, les ecarts, le niveau de risque, le compteur, et la presence de preuves photographiques.

#### Etape C6 : Validation par l'ADMIN

L'ADMIN valide via `POST /inventory/{id}/validate` avec un `approvalReason` obligatoire :

**Regle compteur different du validateur** : Le systeme refuse categoriquement qu'une personne valide son propre comptage (`SELF_VALIDATION_FORBIDDEN`). En cas de tentative, un evenement de securite `ACCESS_DENIED` est enregistre dans l'audit.

**Double validation** :
- Pour les declarations `PENDING_DOUBLE_VALIDATION`, le premier ADMIN fournit sa validation (le statut passe a `PENDING_VALIDATION`).
- Un deuxieme ADMIN, different du premier et du compteur, effectue la validation finale.
- Le systeme verifie que `firstValidatorId != validatedById` (`SAME_VALIDATOR_FORBIDDEN`).

#### Etape C7 : Creation du mouvement d'ajustement

Apres approbation (auto ou manuelle), si l'ecart est non nul, le systeme cree :
- Un `StockMovement` de type `IN` (si le stock physique est superieur au theorique) ou `OUT` (si inferieur)
- Avec l'origine `INVENTAIRE` et la reference `INV-{declarationId}`
- Le champ `lastPhysicalStock` du produit est mis a jour avec la quantite declaree

#### Etape C8 : Rejet et recomptage

Si l'ADMIN rejette (`POST /inventory/{id}/reject`), le statut passe a `REJECTED` et un nouveau comptage est requis. L'ancien comptage n'a aucun impact sur le stock.

**Expiration** : Toute declaration non validee au-dela de 24 heures passe automatiquement en statut `EXPIRED`.

---

### Workflow D : Declaration de Pertes/Casses

**Objectif** : Enregistrer les pertes de stock de maniere tracee pour maintenir l'exactitude des stocks et la conformite reglementaire.

**Endpoint** : `POST /stock/loss`
**Role autorise** : `ADMIN` uniquement

**Important** : Le Responsable Stock (role `APPRO`) ne peut pas declarer lui-meme une perte dans le systeme. Il doit constater la perte, documenter la situation (photos, notes), et transmettre le dossier a l'ADMIN pour enregistrement.

#### Processus operationnel :

1. **Constatation terrain** : Le Responsable Stock identifie la perte (lot expire bloque, casse, contamination, defaut qualite).

2. **Documentation obligatoire** : Preparer un dossier incluant :
   - Le type de produit (`MP` ou `PF`)
   - L'identifiant du produit et si possible l'identifiant du lot specifique
   - La quantite perdue
   - La raison parmi les motifs autorises :
     - `DLC_EXPIRED` : Date limite depassee
     - `QUALITY_DEFECT` : Defaut qualite constate
     - `DAMAGE` : Casse ou dommage physique
     - `CONTAMINATION` : Contamination detectee
     - `INVENTORY_ADJUSTMENT` : Ajustement suite a inventaire
     - `OTHER` : Autre motif (justification detaillee obligatoire)
   - Une description d'au moins 20 caracteres (maximum 1 000) pour la tracabilite
   - Des photos preuves (URLs, optionnel mais fortement recommande)

3. **Saisie par l'ADMIN** :
```
POST /stock/loss
{
  "productType": "MP",
  "productId": 3,
  "lotId": 15,                 // Optionnel : lot specifique
  "quantity": 50,              // Entier positif, max 100 000
  "reason": "DLC_EXPIRED",
  "description": "Lot L260115-003 expire depuis 5 jours, odeur anormale detectee lors du controle du 24/02. Lot entierement bloque.",
  "evidencePhotos": ["https://storage.../photo_lot15.jpg"]
}
```

4. **Impact systeme** : Creation d'un mouvement `OUT` avec l'origine `PERTE`, enregistrement dans l'audit avec severite `WARNING` ou `CRITICAL`.

---

### Workflow E : Consultation et Analyse des Mouvements de Stock

**Objectif** : Exploiter l'historique complet des mouvements pour analyser les flux, identifier des anomalies, et piloter la performance.

#### Endpoints disponibles :

| Endpoint | Description | Limite par defaut |
|---|---|---|
| `GET /stock/mp/{id}/movements` | Historique mouvements d'une MP | 50 (max 200) |
| `GET /stock/pf/{id}/movements` | Historique mouvements d'un PF | 50 (max 200) |

Le parametre `?limit=100` permet d'ajuster le nombre de resultats (minimum 1, maximum 200, protection anti-DoS).

#### Types de mouvements traces :

| Origine (`origin`) | Type | Description |
|---|---|---|
| `RECEPTION` | `IN` | Entree de MP via reception fournisseur |
| `PRODUCTION_IN` | `IN` | Entree de PF apres production |
| `PRODUCTION_OUT` | `OUT` | Sortie de MP consommee en production |
| `PRODUCTION_CANCEL` | `IN` | Retour de MP suite a annulation de production |
| `VENTE` | `OUT` | Sortie de PF pour livraison client |
| `INVENTAIRE` | `IN`/`OUT` | Ajustement suite a inventaire physique |
| `RETOUR_CLIENT` | `IN` | Retour de PF par un client (exceptionnel) |
| `PERTE` | `OUT` | Declaration de perte ou casse |

#### Attributs d'un mouvement :

Chaque `StockMovement` inclut :
- `movementType` (`IN`/`OUT`) et `origin` (origine metier)
- `productType` (`MP`/`PF`) et lien vers le produit/lot
- `quantity` (toujours positif)
- `unitCost` (cout unitaire en centimes, pour valorisation)
- `reference` et `referenceType` (document source : reception, facture, OP)
- `userId` (operateur ayant cree le mouvement)
- `idempotencyKey` (protection anti-double-clic, cle unique)
- `lotSnapshot` (JSON : `{quantityBefore, quantityAfter, expiryDate}` au moment du mouvement)
- `isDeleted` / `deletedAt` / `deletedBy` / `deleteReason` (soft delete, jamais de suppression reelle)

---

### Workflow F : Alertes Stock (Ruptures, Sous-seuil, DLC Proche)

**Objectif** : Surveiller en continu l'etat du stock et reagir proactivement aux situations critiques.

#### Endpoint general : `GET /stock/alerts`
Retourne les alertes de rupture (stock = 0) et de stock sous seuil minimum.

#### Dashboard stock : `GET /stock/dashboard`
Le dashboard est structure en trois zones :

**Zone CRITIQUE (Rouge)** -- Action immediate requise :
- Lots expirant aujourd'hui (`LOT_EXPIRES_TODAY`) : non dismissable
- Produits en rupture totale (`PRODUCT_RUPTURE`) : pour les MP de criticite `BLOQUANTE` ou `HAUTE`, l'alerte est non dismissable
- Lots bloques a declarer en perte (`LOT_BLOCKED_PENDING_LOSS`) : non dismissable
- Inventaires a ecart critique en attente de validation (`INVENTORY_CRITICAL_PENDING`) : non dismissable

**Zone A TRAITER (Orange)** -- Action dans la journee :
- Produits sous seuil minimum (`PRODUCT_BELOW_MIN`) : stock > 0 mais < `minStock`
- Lots expirant dans 7, 3 ou 1 jour(s) (`LOT_EXPIRING_J7/J3/J1`)
- Inventaires non critiques en attente de validation
- Produits sans inventaire depuis plus de 30 jours (`INVENTORY_OVERDUE`)

**Zone SANTE (Vert)** -- Indicateurs de performance :
- `fifoCompliance` : taux de respect du FIFO (cible : >95%)
- `stockRotation` : nombre de jours de stock moyen
- `avgInventoryDrift` : ecart moyen des 30 derniers inventaires (cible : <2%)
- `inventoryFreshness` : pourcentage de produits inventories dans les 30 derniers jours

**Score de sante global** :
- Calcul : `100 - (criticalCount * 10) - (warningCount * 2)`, borne entre 0 et 100
- `>= 90` : Excellent
- `>= 70` : Bon
- `>= 50` : Attention
- `< 50` : Critique

#### Endpoints complementaires du dashboard :

| Endpoint | Description |
|---|---|
| `GET /stock/dashboard/critical` | Uniquement les alertes critiques aplaties |
| `GET /stock/dashboard/count` | Compteur pour le badge de notification (tout role) |
| `GET /stock/dashboard/health` | Metriques de sante (ADMIN uniquement) |
| `GET /stock/dashboard/expiry` | Statistiques detaillees d'expiration DLC |

---

### Workflow G : Valorisation du Stock

**Objectif** : Calculer la valeur monetaire du stock PF pour les besoins comptables, de gestion et de reporting.

#### Endpoint : `GET /stock/value`
**Roles autorises** : `ADMIN`, `APPRO`

Retourne la valeur totale du stock PF calculee comme la somme de `currentStock * priceHt` pour chaque produit fini actif.

#### Rapports disponibles :

| Endpoint | Description | Format |
|---|---|---|
| `GET /reports/stock/valorization` | Rapport de valorisation detaille par produit | JSON |
| `GET /reports/stock/movements` | Rapport des mouvements avec filtres | JSON |
| `GET /reports/export/excel` | Export Excel des donnees stock | `.xlsx` |
| `GET /reports/export/pdf` | Export PDF des rapports formalises | `.pdf` |

**Recommandation** : Effectuer un export mensuel de la valorisation pour le service comptable, et un export hebdomadaire des mouvements pour l'analyse des flux.

---

## 3. SCENARIOS REELS

### Scenario 1 : Lot de lait expire detecte en chambre froide

**Contexte** : Lors de la ronde matinale, le Responsable Stock decouvre que 3 seaux de lait (Lot `L260210-002`, MP-003, 150 litres) ont une DLC depassee depuis 2 jours. Le job automatique de blocage DLC a deja marque le lot comme `BLOCKED` avec le motif `DLC_EXPIRED_AUTO`.

**Actions dans le systeme** :
1. Le Responsable Stock verifie dans `GET /lots/mp?productId=3` que le lot est bien en statut `BLOCKED`.
2. Le dashboard stock (`GET /stock/dashboard`) affiche une alerte critique `LOT_BLOCKED_PENDING_LOSS` pour ce lot. L'alerte est non dismissable.
3. Le Responsable Stock photographie les seaux avec la date visible et transmet le dossier a l'ADMIN.
4. L'ADMIN effectue la declaration de perte :
   ```
   POST /stock/loss
   {
     "productType": "MP",
     "productId": 3,
     "lotId": 42,
     "quantity": 150,
     "reason": "DLC_EXPIRED",
     "description": "Lot L260210-002 : 3 seaux de lait expire depuis le 22/02/2026. Detecte lors de la ronde du 24/02. Odeur acide confirmant la peremption.",
     "evidencePhotos": ["https://storage.../perte_lait_240226.jpg"]
   }
   ```
5. Le stock de MP-003 est decremente de 150 unites via un mouvement `OUT / PERTE`.
6. L'alerte critique disparait du dashboard.

**Lecon** : Le Responsable Stock aurait du reagir a l'alerte J-3 envoyee 5 jours avant et prioriser la consommation de ce lot en production.

---

### Scenario 2 : Lot de fromage bloque pour defaut qualite

**Contexte** : L'operateur de production signale un gout anormal sur un lot de caille (Lot `L260218-005`, MP-007). Le lot n'est pas expire mais presente un defaut organoleptique.

**Actions** :
1. L'ADMIN bloque manuellement le lot via l'interface (`POST /lots/mp/5/adjust` avec quantite a 0 ou blocage manuel via interface d'administration), avec le motif `QUALITY`.
2. Le Responsable Stock isole physiquement les contenants dans la zone de quarantaine.
3. Un echantillon est envoye au laboratoire pour analyse.
4. **Si resultat negatif (lot conforme)** : L'ADMIN peut debloquer le lot (contrairement au blocage DLC automatique, le blocage QUALITY peut etre leve).
5. **Si resultat positif (lot non conforme)** : Declaration de perte avec motif `QUALITY_DEFECT` et description incluant les resultats d'analyse.

**Impact FIFO** : Le systeme contourne automatiquement le lot bloque dans le calcul FIFO. Les lots suivants du meme produit seront utilises a la place.

---

### Scenario 3 : Inventaire revele un ecart de 12% sur le sel

**Contexte** : Lors de l'inventaire mensuel, le comptage physique du sel (MP-002, non perissable) donne 440 kg alors que le stock theorique est de 500 kg. L'ecart de 12% depasse le seuil de 8% pour les MP non perissables.

**Deroulement** :
1. Le Responsable Stock declare l'inventaire :
   ```
   POST /inventory/declare
   {
     "productType": "MP",
     "productId": 2,
     "declaredQuantity": 440,
     "notes": "Comptage zone SEC magasin principal. Ecart probablement du aux pesees manuelles non enregistrees en production.",
     "evidencePhotos": ["https://storage.../inv_sel_fev26.jpg"]
   }
   ```
2. Le systeme analyse : ecart = -60, ecart% = 12%, valeur d'ecart > seuil. Le `riskLevel` est `CRITICAL`, le statut est `PENDING_DOUBLE_VALIDATION`.
3. Une alerte est generee dans le dashboard critique.
4. Le premier ADMIN valide avec raison : "Confirme : les pertes en production de sel ne sont pas systematiquement enregistrees. Formation equipe prevue."
5. Le deuxieme ADMIN (different du premier et du compteur) valide avec raison : "Double controle effectue. L'ecart est coherent avec les pertes estimees en production."
6. Un mouvement `OUT / INVENTAIRE` de 60 unites est cree. Le `lastPhysicalStock` du produit est mis a jour a 440.

**Lecon** : Un ecart de 12% declenche une investigation. Le Responsable Stock doit analyser les causes (pertes de production non enregistrees, vol, erreur de saisie reception) et mettre en place des actions correctives.

---

### Scenario 4 : Rupture de MP bloquante pour la production

**Contexte** : Le Gouda necessite du presure (MP-012, criticite `BLOQUANTE`). Le stock tombe a 0 alors qu'un ordre de production est planifie pour le lendemain.

**Detection** :
1. Le dashboard stock affiche une alerte critique `PRODUCT_RUPTURE` avec `severity: CRITICAL` (car criticite `BLOQUANTE`). L'alerte est non dismissable.
2. Une alerte APPRO `MP_CRITIQUE` de niveau `CRITICAL` est egalement creee dans le module Appro.
3. Le check de faisabilite production (`/check-production`) echoue et bloque le lancement de l'OP.

**Actions du Responsable Stock** :
1. Consulter `GET /stock/mp/12/movements` pour comprendre quand et pourquoi la rupture est survenue.
2. Verifier les bons de commande en cours aupres du fournisseur principal.
3. Si un BC est en statut `SENT` ou `CONFIRMED`, verifier la date de livraison prevue.
4. Si aucun BC n'est en cours, coordonner immediatement avec l'equipe APPRO pour generer un BC urgent.
5. Informer le responsable de production que l'OP doit etre replanifie.
6. Accuser reception de l'alerte critique (obligatoire pour tracabilite).

**Prevention** : Configurer correctement les champs `seuilSecurite` et `seuilCommande` de la MP. Le seuil de commande doit etre calibre en fonction du `leadTimeFournisseur` et de la `consommationMoyJour`.

---

### Scenario 5 : Reception erronee -- quantite saisie en double

**Contexte** : Un operateur saisit une reception de 200 kg de cheddar au lieu de 100 kg (erreur de double-saisie ou mauvaise lecture du BL).

**Detection** :
1. Lors de la verification post-reception, le Responsable Stock compare la quantite dans le systeme avec le BL physique et constate l'ecart.
2. Alternativement, la cle d'idempotence (`idempotencyKey`) empeche un envoi en double si le meme formulaire est soumis deux fois. Mais cela ne protege pas contre une saisie initiale erronee.

**Resolution** :
1. Le Responsable Stock signale immediatement l'erreur a l'ADMIN.
2. L'ADMIN peut :
   - **Option A** : Annuler la reception si elle est encore en statut `DRAFT` (avant validation).
   - **Option B** : Effectuer un ajustement inventaire (`POST /stock/mp/inventory`) avec le motif "Correction reception erronee REC-260224-003 : saisie de 200 au lieu de 100. Cf. BL-2026-00458."
   - **Option C** : Declarer une perte de la quantite excedentaire avec motif `INVENTORY_ADJUSTMENT`.
3. L'evenement est trace dans l'audit avec les etats avant/apres pour la piste d'investigation.

**Regle** : Les mouvements de stock ne sont JAMAIS supprimes physiquement (`isDeleted` avec soft delete). Toute correction passe par un mouvement d'ajustement compensatoire, garantissant la tracabilite complete.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Oubli de saisie du numero de lot fournisseur

**Description** : Le champ `lotNumber` dans la ligne de reception est optionnel. L'operateur omet de le renseigner, rendant impossible la tracabilite amont vers le fournisseur.

**Consequence** : En cas de rappel produit (alerte sanitaire), impossible d'identifier rapidement quels lots du fournisseur sont concernes.

**Prevention** : Imposer systematiquement la saisie du numero de lot fournisseur pour toutes les MP de categorie `RAW_MATERIAL`, meme si le systeme ne l'exige pas techniquement. Ajouter cette verification dans la procedure operationnelle.

### Erreur 2 : DLC non renseignee sur les matieres perissables

**Description** : L'operateur ne saisit pas le champ `expiryDate` pour une MP perissable. Le job de blocage DLC ne pourra pas bloquer automatiquement le lot.

**Consequence** : Un lot expire peut etre consomme en production sans declenchement d'alerte, compromettant la securite alimentaire.

**Prevention** : Pour tout produit dont `isPerishable = true`, verifier systematiquement que la DLC est renseignee dans la reception.

### Erreur 3 : Inventaire effectue sans comptage reel

**Description** : Le compteur saisit le stock theorique affiche par le systeme au lieu de compter physiquement, pensant "tout est correct".

**Consequence** : Les ecarts reels ne sont jamais detectes, les pertes s'accumulent silencieusement.

**Prevention** : La procedure impose de ne PAS consulter le stock theorique AVANT le comptage physique. Le comptage doit etre effectue sur papier ou tablette deconnectee, puis seulement compare au theorique lors de la saisie.

### Erreur 4 : Double reception pour la meme livraison

**Description** : La meme reception est saisie deux fois (par deux operateurs differents, ou par oubli d'enregistrement).

**Consequence** : Le stock est gonfle artificiellement, faussant les planifications de production et les commandes fournisseur.

**Prevention** : Le champ `blNumber` doit etre renseigne systematiquement et un controle de doublon doit etre effectue. La cle d'idempotence protege contre le double-clic, mais pas contre une saisie manuelle dupliquee.

### Erreur 5 : Validation d'inventaire par le compteur lui-meme

**Description** : La meme personne tente de compter et valider un inventaire.

**Consequence** : Fraude potentielle (dissimulation de vol, ajustement non autorise). Le systeme bloque cette tentative avec l'erreur `SELF_VALIDATION_FORBIDDEN` et enregistre un evenement de securite.

**Prevention** : Regle intrinseque au systeme. Sensibiliser les equipes au fait que cette tentative est enregistree dans l'audit de securite.

### Erreur 6 : Oubli de traitement des alertes critiques

**Description** : Le Responsable Stock ne consulte pas le dashboard quotidiennement. Des lots expires restent non declares en perte pendant des semaines.

**Consequence** : Les lots bloques occupent de l'espace de stockage, faussent les statistiques de stock, et constituent un risque sanitaire physique.

**Prevention** : Integrer la consultation du dashboard stock comme premiere tache de la journee (checklist quotidienne). Les alertes critiques sont non dismissables et persistent jusqu'a resolution.

### Erreur 7 : Confusion entre unites de mesure

**Description** : Saisie de "50" (pensant kg) alors que l'unite du produit est en litres, ou inversement.

**Consequence** : Ecart entre le stock physique et le stock systeme, potentiellement grave pour les ratios de production (recettes).

**Prevention** : Toujours verifier l'unite affichee dans la fiche produit (`unit` dans `ProductMp`). Lors de la reception, l'unite est indiquee sur chaque ligne.

### Erreur 8 : Utilisation de cout unitaire incorrect dans la reception

**Description** : Le champ `unitCost` est saisi en dinars au lieu de centimes (150 DA saisi comme 150 au lieu de 15000).

**Consequence** : La valorisation du stock est faussee par un facteur 100. Les rapports comptables sont incorrects.

**Prevention** : Rappeler que le systeme travaille en centimes. Exemple : 150,00 DA = 15000 centimes. Verifier systematiquement la coherence du montant TTC affiche apres saisie.

### Erreur 9 : Ignorer les patterns suspects detectes

**Description** : Le systeme detecte un pattern d'ecarts negatifs consecutifs pour un meme compteur/produit mais l'ADMIN valide sans investigation.

**Consequence** : Un schema de vol ou de negligence recurrente n'est pas detecte et corrige.

**Prevention** : Lorsqu'une declaration est marquee `suspiciousPattern: true`, une investigation systematique doit etre menee : comparaison avec les cameras de surveillance, entretien avec le compteur, verification croisee par un second compteur.

### Erreur 10 : Non-respect du cooldown entre inventaires

**Description** : Le compteur tente de re-declarer un inventaire dans les 4 heures suivant une precedente declaration (pour "corriger" un comptage).

**Consequence** : Le systeme bloque la tentative avec l'erreur `INVENTORY_COOLDOWN`. L'operateur pense que le systeme est defaillant.

**Prevention** : Former les equipes sur le cooldown de 4 heures. Si un recomptage est necessaire, il faut soit attendre le delai, soit demander a l'ADMIN de rejeter la declaration precedente (ce qui permet un nouveau comptage).

---

## 5. RISQUES METIER CRITIQUES

### Risque 1 : Rupture de production par manque de MP bloquante

| Attribut | Detail |
|---|---|
| **Probabilite** | Moyenne |
| **Impact** | Critique (arret de production, pertes de CA, penalites clients) |
| **Detection** | Dashboard stock zone critique, alertes APPRO `MP_CRITIQUE` |
| **Mitigation** | Configurer `seuilCommande` > `seuilSecurite` > `minStock`. Monitorer la `consommationMoyJour` et les `joursCouverture`. Diversifier les fournisseurs pour les MP de criticite `BLOQUANTE`. |

### Risque 2 : Non-conformite sanitaire (lots expires en production)

| Attribut | Detail |
|---|---|
| **Probabilite** | Faible (grace au blocage automatique) |
| **Impact** | Critique (rappel produit, sanctions reglementaires, atteinte a la reputation) |
| **Detection** | Job quotidien de blocage DLC (`Cron '5 0 * * *'`), alertes J-7/J-3/J-1 |
| **Mitigation** | Verifier chaque matin que le job a bien tourne. S'assurer que la DLC est renseignee sur tous les lots perissables. Exiger des preuves photographiques pour chaque declaration de perte DLC. |

### Risque 3 : Fraude interne (vol, detournement)

| Attribut | Detail |
|---|---|
| **Probabilite** | Faible (grace aux controles) |
| **Impact** | Eleve (pertes financieres directes, perte de confiance) |
| **Detection** | Pattern d'ecarts negatifs consecutifs (controle I5), ecarts inventaire > 10%, separation compteur/validateur |
| **Mitigation** | Activer les alertes `SUSPICIOUS_INVENTORY_PATTERN`. Rotation des compteurs entre les zones de stockage. Audit trimestriel des ecarts par produit et par compteur. Les mouvements sont immutables (soft delete uniquement). |

### Risque 4 : Perte de tracabilite lot (rappel produit impossible)

| Attribut | Detail |
|---|---|
| **Probabilite** | Faible |
| **Impact** | Critique (obligation legale de tracabilite agroalimentaire) |
| **Detection** | Champs `lotNumber`, `supplierId`, `receptionId` vides dans les lots. Absence de `lotSnapshot` dans les mouvements. |
| **Mitigation** | Rendre obligatoire la saisie du numero de lot fournisseur dans les procedures. Verifier periodiquement que tous les lots ont un lien reception. Le systeme trace chaque mouvement avec un snapshot JSON du lot. |

### Risque 5 : Valorisation incorrecte du stock (impact comptable)

| Attribut | Detail |
|---|---|
| **Probabilite** | Moyenne |
| **Impact** | Eleve (erreurs comptables, declarations fiscales incorrectes, taux TVA errones) |
| **Detection** | Rapport de valorisation `GET /stock/value`, comparaison avec les etats comptables |
| **Mitigation** | Saisir systematiquement le `unitCost` en centimes dans les receptions. Reconcilier mensuellement la valorisation stock avec la comptabilite. Verifier les taux de TVA appliques (0%, 9%, 19%). |

### Risque 6 : Corruption de donnees stock par defaillance systeme

| Attribut | Detail |
|---|---|
| **Probabilite** | Tres faible |
| **Impact** | Critique (perte d'integrite des donnees stock) |
| **Detection** | Ecart entre somme des mouvements et quantites de lots, hash chaine des audit_logs |
| **Mitigation** | Les transactions atomiques (reception, production, vente) garantissent la coherence. Les cles d'idempotence empechent les doublons. Le cache Redis est invalide apres 60 secondes. Les sauvegardes PostgreSQL sont automatisees. |

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist Quotidienne (chaque matin, avant 09h00)

| N | Action | Endpoint / Source | Statut attendu |
|---|---|---|---|
| Q1 | Consulter le dashboard stock complet | `GET /stock/dashboard` | Nombre d'alertes critiques = 0 |
| Q2 | Traiter les alertes critiques (zone rouge) | Dashboard zone Critique | Toutes les alertes traitees ou escaladees |
| Q3 | Verifier les lots expirant aujourd'hui | Dashboard `lotsExpiresToday` | Chaque lot : consomme, vendu ou perte declaree |
| Q4 | Verifier les lots bloques non declares en perte | Dashboard `lotsBlockedToDeclare` | Dossier de perte transmis a l'ADMIN |
| Q5 | Consulter les inventaires en attente de validation | `GET /inventory/pending` | Relancer l'ADMIN si > 12h d'attente |
| Q6 | Verifier les receptions prevues du jour | BL attendus vs BC en cours | Preparer zone de reception |
| Q7 | Controler les temperatures des zones de stockage | Releve physique | REFRIGERE 2-8C, FRAIS 0-4C, CONGELE -18C |
| Q8 | Verifier le compteur d'alertes critiques (badge) | `GET /stock/dashboard/count` | `criticalCount = 0` |

### 6.2 Checklist Hebdomadaire (chaque lundi)

| N | Action | Endpoint / Source | Statut attendu |
|---|---|---|---|
| H1 | Analyser les mouvements de la semaine precedente | `GET /stock/mp/{id}/movements` par produit cle | Aucun mouvement anormal ou non explique |
| H2 | Verifier la zone "A Traiter" du dashboard | Dashboard zone aTraiter | Toutes les alertes traitees |
| H3 | Reviser les lots expirant dans les 7 prochains jours | `GET /lots/expiring?days=7` | Plan de consommation defini pour chaque lot |
| H4 | Controler le taux de compliance FIFO | Dashboard zone Sante `fifoCompliance` | >= 95% |
| H5 | Exporter le rapport des mouvements hebdomadaires | `GET /reports/stock/movements` | Fichier archive |
| H6 | Verifier la coherence des stocks MP critiques | `GET /stock/mp` vs lots disponibles | Pas d'ecart inexplique |
| H7 | Reviser les produits sous seuil minimum | Dashboard `productsBelowMin` | BC genere ou en cours pour chaque produit |

### 6.3 Checklist Mensuelle (premier lundi du mois)

| N | Action | Endpoint / Source | Statut attendu |
|---|---|---|---|
| M1 | Realiser l'inventaire physique complet MP | `POST /inventory/declare` par produit | Toutes les MP inventoriees |
| M2 | Realiser l'inventaire physique complet PF | `POST /inventory/declare` par produit | Tous les PF inventories |
| M3 | Analyser les ecarts d'inventaire du mois | `GET /inventory/history/{type}/{productId}` | Ecart moyen < 2% |
| M4 | Exporter la valorisation du stock | `GET /reports/stock/valorization` + Excel | Transmis a la comptabilite |
| M5 | Calculer et communiquer la valeur totale du stock PF | `GET /stock/value` | Compare avec le mois precedent |
| M6 | Analyser les pertes du mois (quantite et valeur) | Mouvements `PERTE` du mois | Rapport de pertes au directeur |
| M7 | Verifier la fraicheur des inventaires | Dashboard `inventoryFreshness` | >= 80% |
| M8 | Reviser les parametres de seuils stock | Fiche produit : minStock, seuilSecurite, seuilCommande | Ajuster selon consommation reelle |
| M9 | Auditer les patterns suspects detectes | Alertes `SUSPICIOUS_INVENTORY_PATTERN` | Investigation documentee |
| M10 | Generer le rapport mensuel de performance stock | Dashboard summary + exports | Score sante > 70/100 |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : "Premiere connexion et navigation dans le module Stock" (Duree estimee : 8 minutes)

**Objectif pedagogique** : L'apprenant sait se connecter au systeme, naviguer dans le module stock, et comprend l'organisation des menus.

**Deroulement** :
- **[00:00 - 01:30] Introduction** : Presentation de Manchengo Smart ERP, explication du role APPRO et de ses droits d'acces. Mentionner que les donnees financieres sont visibles (contrairement au role PRODUCTION qui ne voit pas les prix).
- **[01:30 - 03:00] Connexion** : Demonstration de la connexion via l'interface web (Vercel). Explication du changement de mot de passe obligatoire a la premiere connexion (`mustChangePassword`). Presentation du systeme d'authentification JWT et des sessions.
- **[03:00 - 05:00] Navigation module Stock** : Presenter la vue "Stock MP" (`GET /stock/mp`) avec les colonnes : code, nom, unite, stock minimum, stock actuel, statut. Montrer la vue "Stock PF" et expliquer la difference de visibilite selon les roles.
- **[05:00 - 07:00] Dashboard stock** : Presenter les 3 zones (Critique, A Traiter, Sante). Expliquer le code couleur. Montrer le badge de notification (`GET /stock/dashboard/count`).
- **[07:00 - 08:00] Recapitulatif** : Les 3 reflexes du matin (dashboard, alertes critiques, lots expirants).

---

### Module 2 : "Enregistrer une reception fournisseur" (Duree estimee : 12 minutes)

**Objectif pedagogique** : L'apprenant sait creer une reception MP complete avec lots, DLC, couts et verification.

**Deroulement** :
- **[00:00 - 02:00] Contexte** : Qu'est-ce qu'une reception ? Quand la saisir (des reception physique de la marchandise) ? Quels documents preparer (BL fournisseur, BC interne) ?
- **[02:00 - 05:00] Saisie pas a pas** : Formulaire de reception avec selection du fournisseur, date, numero de BL. Ajout de lignes : selection de la MP, quantite, cout unitaire (rappel : en centimes !), numero de lot fournisseur, DLC, date de fabrication.
- **[05:00 - 07:00] Points d'attention** : Toujours renseigner la DLC pour les MP perissables. Toujours noter le numero de lot fournisseur. Verifier que la quantite correspond au BL physique.
- **[07:00 - 09:00] Validation et verification** : Soumettre la reception. Montrer la creation automatique des lots (numero `LYYMMDD-NNN`). Verifier dans la vue stock MP que les quantites sont mises a jour. Consulter les mouvements pour voir le mouvement `IN / RECEPTION`.
- **[09:00 - 11:00] Erreur et correction** : Que faire si une erreur est detectee apres validation ? Processus d'ajustement via l'ADMIN. Importance de signaler immediatement.
- **[11:00 - 12:00] Quiz rapide** : 3 questions de verification.

---

### Module 3 : "Realiser un inventaire physique" (Duree estimee : 15 minutes)

**Objectif pedagogique** : L'apprenant maitrise le processus complet d'inventaire, comprend les seuils de validation, et sait interpreter les ecarts.

**Deroulement** :
- **[00:00 - 03:00] Principes fondamentaux** : Qu'est-ce que le stock theorique vs le stock physique ? Pourquoi des ecarts existent (evaporation, casse non declaree, erreurs de pesee, vol) ? Presentation des seuils specifiques MP perissable, MP non perissable, et PF.
- **[03:00 - 06:00] Preparation du comptage** : Organiser par zone de stockage (REFRIGERE, FRAIS, SEC, CONGELE). NE PAS consulter le stock theorique avant de compter. Compter sur papier ou tablette deconnectee. Preparer l'appareil photo pour les preuves.
- **[06:00 - 09:00] Saisie dans le systeme** : Demonstration de la declaration (`POST /inventory/declare`). Saisir le type, le produit, la quantite physique, les notes explicatives, et les photos. Montrer la reponse du systeme : ecart calcule, niveau de risque, statut.
- **[09:00 - 12:00] Comprendre les resultats** : Cas d'auto-approbation (ecart < seuil). Cas de validation requise. Cas de double validation. Cas de pattern suspect. Expliquer le cooldown de 4 heures.
- **[12:00 - 14:00] Validation ADMIN** : Vue cote ADMIN. La regle compteur != validateur. Le processus de double validation. Le rejet et le recomptage.
- **[14:00 - 15:00] Bonnes pratiques** : Regularite (minimum mensuel par produit). Rotation des compteurs. Transparence sur les ecarts. Ne jamais "arranger" un comptage.

---

### Module 4 : "Gerer les lots et la DLC" (Duree estimee : 10 minutes)

**Objectif pedagogique** : L'apprenant comprend le systeme de lots, le FIFO automatique, les blocages DLC, et les alertes pre-expiration.

**Deroulement** :
- **[00:00 - 02:00] Structure d'un lot** : Numero de lot, quantites initiale/restante, dates, fournisseur, statut. Difference entre lot MP et lot PF.
- **[02:00 - 04:00] FIFO en pratique** : Comment le systeme choisit automatiquement le lot le plus ancien. Index de tri (`createdAt` puis `expiryDate`). Pourquoi le FIFO est critique en agroalimentaire.
- **[04:00 - 06:00] Blocage automatique DLC** : Le job de 00h05. Le statut `BLOCKED` avec motif `DLC_EXPIRED_AUTO`. L'impossibilite de debloquer un lot expire. Le seul recours : declaration de perte.
- **[06:00 - 08:00] Alertes pre-expiration** : J-7 (INFO), J-3 (WARNING), J-1 (CRITICAL). Comment les consulter dans le dashboard. Actions a entreprendre pour chaque horizon.
- **[08:00 - 09:30] Blocage qualite** : Difference avec le blocage DLC. Processus de quarantaine physique. Possibilite de deblocage apres analyse.
- **[09:30 - 10:00] Recapitulatif** : Les 3 statuts d'un lot (AVAILABLE, BLOCKED, CONSUMED). Les 3 raisons de blocage (DLC_EXPIRED_AUTO, QUALITY, MANUAL).

---

### Module 5 : "Lire le dashboard stock et piloter par les alertes" (Duree estimee : 10 minutes)

**Objectif pedagogique** : L'apprenant sait interpreter chaque zone du dashboard stock, prioriser les actions, et utiliser les indicateurs de sante.

**Deroulement** :
- **[00:00 - 02:00] Vue d'ensemble du dashboard** : Les 3 zones, le score de sante global, le badge de notification.
- **[02:00 - 04:00] Zone CRITIQUE** : Alertes non dismissables. Les 4 types d'alertes critiques (lots expires, ruptures bloquantes, lots bloques, inventaires critiques). Pour chaque type : quel est le lien d'action ? Quelle est la deadline ?
- **[04:00 - 06:00] Zone A TRAITER** : Alertes dismissables mais necessitant une action. Produits sous seuil minimum (declencher commande), lots expirant (prioriser consommation/vente), inventaires en attente, inventaires en retard (>30 jours).
- **[06:00 - 08:00] Zone SANTE** : Les 4 metriques. Comment interpreter chaque indicateur. Objectifs cibles : FIFO > 95%, ecart inventaire < 2%, fraicheur > 80%.
- **[08:00 - 09:00] Score de sante global** : Formule de calcul. Les 4 niveaux (Excellent, Bon, Attention, Critique). Impact concret sur les operations.
- **[09:00 - 10:00] Cas pratique** : Lecture d'un dashboard reel avec interpretation et plan d'action.

---

## 8. MATRICE RACI

**Legende** : R = Responsable (execute), A = Accountable (decideur final), C = Consulte, I = Informe

| Activite | Resp. Stock (APPRO) | ADMIN | Production | Commercial | Direction |
|---|---|---|---|---|---|
| **Reception fournisseur MP** | **R** | A | I | - | - |
| **Controle qualite a reception** | **R** | C | C | - | - |
| **Creation de lots (systeme)** | R | A | I | - | - |
| **Suivi FIFO** | **R** | A | C | - | - |
| **Blocage lot DLC (auto)** | I | A | I | - | - |
| **Blocage lot qualite (manuel)** | C | **R/A** | C | - | I |
| **Comptage inventaire physique** | **R** | C | R | - | - |
| **Declaration inventaire (systeme)** | **R** | C | R | - | - |
| **Validation inventaire** | I | **R/A** | - | - | I |
| **Double validation inventaire** | I | **R/A** | - | - | I |
| **Declaration de perte** | C | **R/A** | C | - | I |
| **Ajustement stock direct** | C | **R/A** | - | - | I |
| **Consultation alertes stock** | **R** | A | C | - | - |
| **Resolution alertes critiques** | **R** | A | C | C | I |
| **Export valorisation stock** | **R** | A | - | - | I |
| **Reporting mensuel stock** | **R** | A | C | C | I |
| **Configuration seuils stock** | C | **R/A** | C | - | I |
| **Investigation ecarts suspects** | C | **R/A** | C | - | I |
| **Planification commandes MP** | **R** | A | C | - | - |
| **Gestion zones de stockage physiques** | **R** | A | C | - | - |

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 : Initial (Reactif)

**Caracteristiques** :
- Les alertes stock sont traitees en mode reactif (quand un probleme survient en production ou en vente).
- Les inventaires sont realises sporadiquement, sans planning fixe.
- Les receptions sont saisies tardivement, souvent en fin de journee ou le lendemain.
- Le FIFO est respecte manuellement et de maniere approximative.
- Les DLC sont verifiees visuellement par les operateurs sans suivi systeme.
- Le score de sante stock est typiquement < 50.

**Actions pour passer au Niveau 2** :
- Mettre en place la checklist quotidienne.
- Planifier un inventaire mensuel systematique pour toutes les MP.
- Former les operateurs a la saisie immediate des receptions.
- Configurer les `minStock` pour les 10 MP les plus critiques.

---

### Niveau 2 : Defini (Structure)

**Caracteristiques** :
- La checklist quotidienne est appliquee. Le dashboard est consulte chaque matin.
- L'inventaire mensuel est realise pour toutes les MP et PF.
- Les receptions sont saisies le jour meme avec tous les champs obligatoires.
- Les seuils `minStock` sont configures pour toutes les MP actives.
- Les alertes J-7 sont consultees regulierement.
- L'ecart moyen d'inventaire est < 5%.
- Le score de sante stock est entre 50 et 70.

**Actions pour passer au Niveau 3** :
- Configurer `seuilSecurite` et `seuilCommande` pour toutes les MP.
- Reduire l'ecart moyen d'inventaire sous 3% via la formation des compteurs.
- Mettre en place la rotation des compteurs entre zones de stockage.
- Implementer les inventaires tournants (un produit par jour au lieu de tous le meme jour).
- Exiger les preuves photographiques pour tout ecart > 5%.

---

### Niveau 3 : Maitrise (Proactif)

**Caracteristiques** :
- Les alertes critiques sont a 0 la plupart des jours.
- L'ecart moyen d'inventaire est < 2%.
- La compliance FIFO est > 95%.
- La fraicheur des inventaires est > 80%.
- Les `seuilCommande` sont calibres en fonction du `leadTimeFournisseur` et de la `consommationMoyJour`.
- Les pertes representent < 1% de la valeur du stock.
- Le score de sante stock est entre 70 et 85.

**Actions pour passer au Niveau 4** :
- Analyser les tendances d'ecarts par famille de produit et par zone de stockage.
- Mettre en place des comptages de verification intermediaires (bi-mensuels) pour les produits a forte rotation.
- Automatiser la generation des bons de commande sur base des seuils.
- Reduire le delai de traitement des alertes critiques sous 2 heures.
- Integrer les indicateurs de performance fournisseur dans les decisions de commande.

---

### Niveau 4 : Optimise (Excellence operationnelle)

**Caracteristiques** :
- L'ecart moyen d'inventaire est < 1%.
- Aucune rupture de MP bloquante depuis plus de 90 jours.
- La compliance FIFO est > 98%.
- Les inventaires sont realises en mode tournant (continu) sans arreter les operations.
- Les commandes fournisseur sont declenchees automatiquement sur base des seuils.
- Les pertes representent < 0.5% de la valeur du stock.
- Le score de sante stock est > 85.
- Les rapports sont generes et distribues automatiquement chaque semaine et chaque mois.

**Indicateurs d'excellence** :
- Zero perte DLC (tous les lots consommes avant expiration).
- Rotation stock optimale (pas de surstock ni de sous-stock).
- Tracabilite lot complete de bout en bout (reception -> production -> vente -> livraison).
- Valorisation stock reconciliee avec la comptabilite chaque mois sans ecart.

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### Recommandation 1 : Inventaire tournant plutot que mensuel

**Probleme** : L'inventaire mensuel complet immobilise les equipes pendant une journee entiere et genere une surcharge de declarations a valider.

**Solution** : Planifier un inventaire tournant ou 2 a 3 produits sont comptes chaque jour ouvrable. En 20 jours ouvrables, tous les produits auront ete inventories. La `inventoryFreshness` du dashboard sera naturellement > 80%.

**Mise en oeuvre** : Creer un calendrier de comptage rotatif base sur la criticite des produits (les MP `BLOQUANTE` comptees plus frequemment).

### Recommandation 2 : Calibration dynamique des seuils de commande

**Probleme** : Les seuils `seuilCommande` et `seuilSecurite` sont configures une fois et jamais revises, meme si la consommation evolue.

**Solution** : Reviser trimestriellement les seuils en s'appuyant sur les metriques calculees : `consommationMoyJour` (consommation moyenne journaliere sur 30 jours) et `joursCouverture` (jours de stock restants). Formule recommandee :

```
seuilCommande = consommationMoyJour * (leadTimeFournisseur + margeSecurite)
seuilSecurite = consommationMoyJour * margeSecurite
```

Ou `margeSecurite` = 3 a 5 jours selon la criticite et la fiabilite du fournisseur (`grade` A/B/C).

### Recommandation 3 : Integration des scores fournisseur dans la gestion stock

**Probleme** : Les fournisseurs de grade `C` (taux de retard > 30%) ne sont pas pris en compte dans le calcul des seuils de securite.

**Solution** : Pour chaque MP liee a un fournisseur de grade `C`, augmenter automatiquement la marge de securite de 50%. Consulter les metriques fournisseur (`delaiReelMoyen`, `tauxRetard`, `tauxEcartQuantite`) avant de valider un bon de commande.

### Recommandation 4 : Alertes proactives de surconsommation

**Probleme** : Le systeme detecte les ruptures mais pas les surconsommations anormales qui presagent une rupture future.

**Solution** : Comparer la consommation hebdomadaire reelle avec la `consommationMoyJour * 7`. Si l'ecart depasse 20%, generer une alerte precoce. Cela permet d'anticiper les commandes avant d'atteindre le seuil de rupture.

### Recommandation 5 : Procedure de quarantaine formalisee

**Probleme** : Lorsqu'un lot est bloque manuellement pour qualite, la gestion physique (isolation, etiquetage, zone dediee) n'est pas toujours realisee de maniere systematique.

**Solution** : Definir une procedure physique obligatoire :
1. Isoler le lot dans la zone de quarantaine dediee.
2. Apposer une etiquette rouge avec le numero de lot, la date de blocage et le motif.
3. Prendre une photo et l'attacher a la declaration dans le systeme.
4. Fixer un delai maximum d'investigation (5 jours ouvrables).
5. A l'echeance, decision : deblocage (si analyse favorable) ou perte (si confirmation du defaut).

### Recommandation 6 : Export automatique hebdomadaire des rapports

**Probleme** : Les exports de valorisation et de mouvements sont realises manuellement et oublies certaines semaines.

**Solution** : Utiliser les endpoints d'export (`GET /reports/export/excel`, `GET /reports/export/pdf`) dans un processus planifie. Archiver les rapports de maniere systematique pour la tracabilite. Transmettre automatiquement le rapport de valorisation mensuel au service comptable.

### Recommandation 7 : Formation continue et evaluation

**Probleme** : Les operateurs formes initialement perdent progressivement les bonnes pratiques.

**Solution** : Programmer une session de rappel trimestrielle de 30 minutes, centree sur les erreurs constatees pendant le trimestre. Evaluer les compteurs sur la base de la precision de leurs inventaires (ecart moyen par compteur). Recompenser les compteurs ayant les ecarts les plus faibles.

---

## 11. GLOSSAIRE METIER

| Terme | Definition | Contexte systeme |
|---|---|---|
| **MP** | Matiere Premiere. Ingredient ou composant achete aupres des fournisseurs et consomme en production. | Modele `ProductMp`, type `MP` dans `ProductType` |
| **PF** | Produit Fini. Produit manufacture pret a la vente (fromage conditionne). | Modele `ProductPf`, type `PF` dans `ProductType` |
| **DLC** | Date Limite de Consommation. Date au-dela de laquelle un produit perissable ne doit plus etre consomme. | Champ `expiryDate` sur `LotMp` et `LotPf` |
| **FIFO** | First In, First Out. Principe de gestion des stocks ou les lots les plus anciens sont consommes en priorite. | Index `idx_lots_mp_fifo` (tri createdAt, expiryDate) |
| **Lot** | Ensemble de produits de meme reference, recus ou fabriques en meme temps, partageant les memes caracteristiques de tracabilite. | Modeles `LotMp` et `LotPf` |
| **BL** | Bon de Livraison. Document emis par le fournisseur accompagnant la livraison physique. | Champ `blNumber` dans `ReceptionMp` |
| **BC** | Bon de Commande. Document emis par l'entreprise pour commander des MP aupres d'un fournisseur. | Modele `PurchaseOrder`, reference `BC-YYYY-NNNNN` |
| **Reception** | Enregistrement de l'entree de MP dans le stock suite a une livraison fournisseur. | Modele `ReceptionMp`, endpoint `POST /stock/mp/receptions` |
| **Mouvement de stock** | Enregistrement unitaire d'une entree (`IN`) ou sortie (`OUT`) de stock, avec tracabilite complete. | Modele `StockMovement` |
| **Ajustement inventaire** | Correction du stock theorique pour le reconcilier avec le stock physique constate. | Origine `INVENTAIRE` dans `MovementOrigin` |
| **Perte** | Sortie de stock correspondant a un produit perdu, casse, contamine ou expire. | Origine `PERTE` dans `MovementOrigin` |
| **Seuil de securite** | Niveau de stock minimum en dessous duquel la production est menacee. | Champ `seuilSecurite` dans `ProductMp` |
| **Seuil de commande** | Niveau de stock declenchant une commande fournisseur. | Champ `seuilCommande` dans `ProductMp` |
| **Stock minimum** | Quantite minimale souhaitable en stock. Declenche une alerte si le stock descend en dessous. | Champ `minStock` dans `ProductMp` et `ProductPf` |
| **Criticite** | Niveau d'impact d'une MP sur la production. FAIBLE, MOYENNE, HAUTE, BLOQUANTE. | Champ `criticite` dans `ProductMp` (enum `MpCriticite`) |
| **Soft delete** | Suppression logique (marquage) sans destruction physique de la donnee, pour tracabilite. | Champs `isDeleted`, `deletedAt`, `deletedBy`, `deleteReason` |
| **Idempotence** | Propriete garantissant qu'une meme operation executee plusieurs fois produit le meme resultat qu'une execution unique. | Champ `idempotencyKey` dans `StockMovement` |
| **Cooldown** | Delai minimum obligatoire entre deux operations du meme type sur le meme objet. | 4 heures entre deux inventaires du meme produit |
| **Double validation** | Exigence de validation par deux ADMIN differents pour les operations a risque critique. | Statut `PENDING_DOUBLE_VALIDATION` |
| **Score de sante stock** | Indicateur composite (0-100) refletant l'etat global de la gestion stock. | `healthScore` dans le dashboard summary |
| **TVA** | Taxe sur la Valeur Ajoutee. Taux applicables en Algerie : 0%, 9%, 19%. | Champ `tvaRate` dans `ReceptionMpLine` |
| **DA** | Dinar Algerien. Devise de reference du systeme. | Les montants sont stockes en centimes (1 DA = 100 centimes) |
| **Centimes** | Unite de stockage des montants monetaires dans le systeme (1 DA = 100 centimes). | Champs `unitCost`, `priceHt`, `totalHt` |
| **Quarantaine** | Zone physique de stockage isolee pour les lots bloques en attente d'investigation qualite. | Statut `BLOCKED` avec `blockedReason = 'QUALITY'` |
| **Pattern suspect** | Detection automatique de comportements anormaux (ecarts negatifs consecutifs par le meme compteur). | Controle I5 dans `InventoryService` |

---

## 12. ANNEXES

### Annexe A : Architecture Technique du Module Stock

```
apps/backend/src/stock/
  stock.controller.ts        -- Endpoints REST principaux (MP, PF, receptions, pertes, alertes, valeur)
  stock.service.ts           -- Logique metier stock (calcul stock, receptions, ajustements, FIFO)
  stock.module.ts            -- Module NestJS avec injections de dependances
  inventory.controller.ts    -- Endpoints REST inventaire (declare, validate, reject, pending, history)
  inventory.service.ts       -- Logique metier inventaire (analyse ecarts, seuils, anti-fraude)
  stock-dashboard.controller.ts -- Endpoints dashboard stock (3 zones)
  stock-dashboard.service.ts -- Calcul des zones critique/aTraiter/sante, cache Redis 60s
  dto/
    create-reception.dto.ts  -- DTO reception (validation stricte)
    adjust-inventory.dto.ts  -- DTO ajustement inventaire
    declare-loss.dto.ts      -- DTO declaration de perte
    complete-production.dto.ts -- DTO completion production
    query.dto.ts             -- DTO pagination mouvements (protection anti-DoS, max 200)
    index.ts                 -- Re-exports centralises
  jobs/
    lot-expiry.job.ts        -- Jobs Cron : blocage DLC (00h05), alertes pre-expiration (08h00)
  business-rules.spec.ts     -- Tests unitaires des regles metier
  stock.service.spec.ts      -- Tests d'integration du service stock

apps/backend/src/lots/
  lots.controller.ts         -- Endpoints REST lots MP/PF (consultation, stock, ajustement ADMIN)
  lots.module.ts             -- Module NestJS
  lots.service.ts            -- Logique metier lots (FIFO, recherche, expiration)
```

### Annexe B : Diagramme des Statuts de Lot

```
                 [Creation]
                     |
                     v
              +-------------+
              |  AVAILABLE  |  <--- Lot cree via reception (MP) ou production (PF)
              +------+------+
                     |
          +----------+----------+
          |                     |
          v                     v
  +-------+-------+    +-------+-------+
  |    BLOCKED     |    |   CONSUMED    |  <--- quantityRemaining = 0
  | (DLC_EXPIRED_  |    +---------------+
  |  AUTO / QUALITY|
  |  / MANUAL)     |
  +-------+--------+
          |
          v
  Declaration de PERTE
  (mouvement OUT / PERTE)
```

### Annexe C : Diagramme des Statuts d'Inventaire

```
                [Declaration]
                     |
                     v
           +------------------+
           | PENDING_ANALYSIS |
           +--------+---------+
                    |
        +-----------+-----------+-----------+
        |           |           |           |
        v           v           v           v
  +-----------+ +----------+ +----------+ +-------------------+
  |AUTO_      | |PENDING_  | |PENDING_  | |PENDING_DOUBLE_    |
  |APPROVED   | |VALIDATION| |VALIDATION| |VALIDATION         |
  |(ecart     | |(ecart    | |(ecart    | |(ecart critique ou |
  | faible)   | | moyen)   | | eleve)   | | valeur > 50k DA)  |
  +-----+-----+ +----+-----+ +----+-----+ +--------+----------+
        |             |            |                 |
        v             |            |        1ere validation ADMIN
  [Mouvement cree     |            |                 |
   automatiquement]   |            |                 v
                      |            |         +-----------+
                      +-----+------+         |PENDING_   |
                            |                |VALIDATION  |
                            |                +-----+------+
                            |                      |
                   +--------+--------+             |
                   |                 |    2eme validation ADMIN
                   v                 v    (different du 1er)
            +-----------+     +-----------+        |
            | APPROVED  |     | REJECTED  |        v
            | (mouvement|     | (recomp-  |  +-----------+
            |  cree)    |     |  tage     |  | APPROVED  |
            +-----------+     |  requis)  |  +-----------+
                              +-----------+

            +-----------+
            | EXPIRED   |  <--- > 24h sans validation
            +-----------+
```

### Annexe D : Seuils de Tolerance Inventaire (Reference)

| Categorie | Auto-approbation | Validation simple | Double validation | Valeur critique |
|---|---|---|---|---|
| MP perissable | 0 - 2% | 2 - 5% | > 5% | > 50 000 DA |
| MP non perissable | 0 - 3% | 3 - 8% | > 8% | > 50 000 DA |
| Produit Fini (PF) | 0 - 1% | 1 - 3% | > 3% | > 50 000 DA |

### Annexe E : Types de Stockage et Temperatures

| Type | Plage de temperature | Produits concernes |
|---|---|---|
| `REFRIGERE` | 2 a 8 degres C | Fromages affinables, lait pasteurise |
| `FRAIS` | 0 a 4 degres C | Fromages frais, creme, yaourts |
| `SEC` | Temperature ambiante | Sel, emballages, additifs non perissables |
| `CONGELE` | -18 degres C | Fromages congeles, stocks tampons |

### Annexe F : Raisons de Perte Autorisees

| Code | Libelle | Precisions |
|---|---|---|
| `DLC_EXPIRED` | Date limite depassee | Obligatoirement apres blocage automatique du lot |
| `QUALITY_DEFECT` | Defaut qualite | Apres analyse laboratoire ou constat organoleptique |
| `DAMAGE` | Casse/dommage | Dommage physique (chute, ecrasement, emballage perce) |
| `CONTAMINATION` | Contamination | Contamination chimique, microbiologique ou par corps etranger |
| `INVENTORY_ADJUSTMENT` | Ajustement inventaire | Ecart constate et non attribuable a une cause identifiee |
| `OTHER` | Autre | Tout autre motif -- description detaillee obligatoire (min 20 caracteres) |

### Annexe G : Contacts et Escalade

| Situation | Premier contact | Escalade si non resolu sous |
|---|---|---|
| Alerte critique stock (rupture bloquante) | ADMIN + Responsable Production | 2 heures -> Direction Operations |
| Lot suspect (qualite) | ADMIN + Responsable Qualite | 4 heures -> Direction Qualite |
| Ecart inventaire CRITICAL (> 10%) | ADMIN (double validation) | 24 heures (expiration automatique) -> Investigation |
| Pattern suspect detecte | ADMIN + Direction | Immediat -> Investigation securite |
| Erreur de reception detectee | ADMIN | 4 heures -> Ajustement trace |
| Defaillance systeme (dashboard en erreur) | DSI / Support technique | 1 heure -> Maintenance d'urgence |

### Annexe H : Historique des Revisions du Document

| Version | Date | Auteur | Modifications |
|---|---|---|---|
| 1.0.0 | 15/01/2026 | DSI | Version initiale |
| 2.0.0 | 01/02/2026 | DSI | Ajout module inventaire, dashboard 3 zones |
| 3.0.0 | 24/02/2026 | DSI | Version complete 12 sections, alignement Phase 6 (score audit 92/100) |

---

*Fin du Manuel Utilisateur -- Responsable Stock*
*Document genere pour Manchengo Smart ERP -- Version 3.0.0*
*Tous droits reserves -- Usage interne uniquement*

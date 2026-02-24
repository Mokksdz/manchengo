# MANUEL-08 : RESPONSABLE QUALITE

> **Manchengo Smart ERP** -- Module Qualite & Tracabilite Sanitaire
> Version 2.0 | Fevrier 2026
> Classification : CONFIDENTIEL -- Usage interne uniquement
> Deploiement : Railway (NestJS) + Vercel (Next.js 14)

---

## TABLE DES MATIERES

1. [Fiche d'identite du role](#1-fiche-didentite-du-role)
2. [Workflow complet (Step-by-step)](#2-workflow-complet-step-by-step)
3. [Scenarios reels](#3-scenarios-reels)
4. [Erreurs humaines frequentes](#4-erreurs-humaines-frequentes)
5. [Risques metier critiques](#5-risques-metier-critiques)
6. [Checklists quotidienne / hebdomadaire / mensuelle](#6-checklists-quotidienne--hebdomadaire--mensuelle)
7. [Scripts de formation video](#7-scripts-de-formation-video)
8. [Matrice RACI](#8-matrice-raci)
9. [Niveaux de maturite](#9-niveaux-de-maturite)
10. [Recommandations d'optimisation](#10-recommandations-doptimisation)
11. [Glossaire metier](#11-glossaire-metier)
12. [Annexes](#12-annexes)

---

## 1. FICHE D'IDENTITE DU ROLE

### 1.1 Denomination et positionnement

| Champ | Valeur |
|---|---|
| **Intitule** | Responsable Qualite |
| **Roles RBAC ERP** | `ADMIN` ou `PRODUCTION` (selon perimetre) |
| **Rattachement hierarchique** | Direction Generale / Direction Technique |
| **Modules ERP principaux** | Lots, Production, Inventaire, Stock, Fournisseurs, Alertes, Audit |
| **Interactions transverses** | Responsable Production, Responsable Appro, Responsable Commercial, ADMIN |

### 1.2 Mission principale

Le Responsable Qualite garantit la securite alimentaire et la conformite reglementaire de l'ensemble de la chaine de production fromagere. Dans Manchengo Smart ERP, il est le gardien de la tracabilite lot-par-lot, du respect des DLC (Dates Limites de Consommation), du suivi des rendements de production, de la validation des ecarts d'inventaire et de l'evaluation continue des fournisseurs.

### 1.3 Perimetre fonctionnel dans l'ERP

**Acces en lecture obligatoire :**

- `GET /api/lots/mp` -- Liste complete des lots matieres premieres avec statut et DLC
- `GET /api/lots/pf` -- Liste complete des lots produits finis
- `GET /api/lots/expiring?days=N` -- Lots proches de l'expiration (configurable, defaut 7 jours)
- `GET /api/lots/expired` -- Lots expires (acces ADMIN uniquement)
- `GET /api/production` -- Liste des ordres de production
- `GET /api/production/:id` -- Detail d'un ordre avec qualityStatus et qualityNotes
- `GET /api/production/dashboard/analytics` -- Tendances rendement, taux defauts
- `GET /api/production/dashboard/kpis` -- KPIs production (rendement moyen, lowYieldCount)
- `GET /api/production/lots/search?q=&type=` -- Recherche tracabilite par numero de lot
- `GET /api/stock/alerts` -- Alertes stock (ruptures, sous-seuil, DLC)
- `GET /api/stock/mp` -- Etat du stock matieres premieres
- `GET /api/stock/pf` -- Etat du stock produits finis
- `GET /api/stock/mp/:id/movements` -- Historique mouvements d'une MP
- `GET /api/inventory/pending` -- Declarations inventaire en attente de validation
- `GET /api/inventory/:id` -- Detail d'une declaration d'inventaire
- `GET /api/inventory/history/:type/:productId` -- Historique inventaire par produit
- `GET /api/suppliers` -- Liste fournisseurs avec grades et metriques
- `GET /api/suppliers/:id` -- Detail fournisseur (scorePerformance, tauxEcartQuantite, grade)
- `GET /api/suppliers/:id/history` -- Historique receptions d'un fournisseur
- `GET /api/security/audit` -- Logs d'audit (ADMIN uniquement)
- `GET /api/security/audit/entity/:entityType/:entityId` -- Historique audit d'une entite

**Actions en ecriture :**

- `POST /api/production/:id/complete` -- Saisie du statut qualite lors de la cloture production (qualityStatus: OK / DEFAUT_MINEUR / DEFAUT_MAJEUR, qualityNotes)
- `POST /api/inventory/:id/validate` -- Validation d'une declaration inventaire (role ADMIN requis)
- `POST /api/inventory/:id/reject` -- Rejet d'une declaration inventaire (role ADMIN requis)
- `POST /api/inventory/declare` -- Declaration d'un comptage physique
- `POST /api/lots/mp/:id/adjust` -- Ajustement quantite lot MP (role ADMIN requis)
- `POST /api/lots/pf/:id/adjust` -- Ajustement quantite lot PF (role ADMIN requis)
- `POST /api/stock/loss` -- Declaration de perte (role ADMIN requis)
- `PUT /api/suppliers/:id/block` -- Blocage fournisseur (role ADMIN requis)
- `PUT /api/suppliers/:id/surveillance` -- Mise sous surveillance fournisseur (role ADMIN requis)

### 1.4 Indicateurs cles de performance (KPIs)

| KPI | Source ERP | Cible |
|---|---|---|
| Taux de lots conformes | `GET /api/lots/mp` + filtre status AVAILABLE | > 98% |
| Rendement moyen production | `GET /api/production/dashboard/kpis` (week.avgYield) | > 95% |
| Productions avec defaut | `GET /api/production/dashboard/kpis` (week.lowYieldCount) | < 2% |
| Ecart inventaire moyen | `GET /api/inventory/pending` (differencePercent) | < 2% |
| Taux de conformite DLC | `GET /api/lots/expiring` vs total lots | 100% action avant expiration |
| Score moyen fournisseurs | `GET /api/suppliers` (scorePerformance) | > 85/100 |
| Temps de resolution alertes CRITICAL | AuditLog (acknowledgedAt - createdAt) | < 4 heures |

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Controle qualite reception MP

**Declencheur :** Arrivee d'une livraison fournisseur. Le service Appro cree une reception via `POST /api/stock/mp/receptions`.

**Etapes detaillees :**

1. **Preparation du controle**
   - Consulter le bon de commande prevu : `GET /api/suppliers/:id/history` pour verifier les commandes attendues.
   - Preparer la fiche de controle reception (modele papier ou tablette).

2. **Verification documentaire**
   - Comparer le bon de livraison (BL) fournisseur avec la reception enregistree dans l'ERP : le champ `blNumber` de la reception (`ReceptionMp.blNumber`).
   - Verifier la correspondance entre les lignes de reception (`ReceptionMpLine`) : `productMpId`, `quantity`, `lotNumber`, `expiryDate`.

3. **Controle physique**
   - **Temperature** : Verifier que la temperature de transport respecte le type de stockage du produit :
     - `REFRIGERE` : 2-8 degres C
     - `FRAIS` : 0-4 degres C
     - `CONGELE` : -18 degres C
     - `SEC` : Temperature ambiante
   - **DLC** : Verifier que la `expiryDate` de chaque `ReceptionMpLine` offre un delai suffisant (minimum DLC residuelle selon politique interne -- generalement > 2/3 de la duree totale).
   - **Quantite** : Compter physiquement et comparer avec `ReceptionMpLine.quantity`.
   - **Aspect visuel** : Integrite des emballages, absence d'humidite, odeur normale.

4. **Saisie des resultats dans l'ERP**
   - Si tout est conforme : la reception peut etre validee par l'Appro (`ReceptionStatus.VALIDATED`). Le systeme cree automatiquement les lots MP (`LotMp`) avec statut `AVAILABLE` et genere les mouvements de stock (`StockMovement` avec `origin: RECEPTION`).
   - Si non-conforme : bloquer la reception, noter les anomalies. Le lot sera cree avec statut `BLOCKED` et `blockedReason: 'QUALITY'`.

5. **Traitement des ecarts**
   - Si ecart quantite : noter l'ecart. Cela impacte le `tauxEcartQuantite` du fournisseur dans ses metriques de performance.
   - Si DLC insuffisante : refuser le lot. Le lot n'est pas enregistre ou est enregistre en `BLOCKED`.
   - Si probleme temperature : refuser la totalite de la livraison. Documenter dans les notes de reception.

6. **Mise a jour metriques fournisseur**
   - Les metriques fournisseur (`scorePerformance`, `tauxEcartQuantite`, `tauxRetard`) sont recalculees automatiquement apres chaque reception. Le grade (`SupplierGrade: A/B/C`) est derive : A (>90%), B (70-90%), C (<70%).

---

### Workflow B : Suivi qualite production

**Declencheur :** Demarrage d'un ordre de production (`POST /api/production/:id/start`).

**Etapes detaillees :**

1. **Avant le demarrage**
   - Consulter l'ordre de production : `GET /api/production/:id`. Verifier le `targetQuantity`, le `batchCount`, et la recette associee (`recipeId`).
   - Verifier la disponibilite des MP via `GET /api/production/dashboard/supply-risks`. S'assurer qu'aucune MP n'est en rupture ou en risque.
   - Verifier qu'aucun lot MP prevu pour consommation n'a le statut `BLOCKED`.

2. **Pendant la production**
   - Le systeme consomme automatiquement les lots MP en FIFO (tri par `createdAt` puis `expiryDate`). Le Responsable Qualite verifie que les lots les plus anciens sont bien utilises en priorite.
   - Controles en cours de fabrication : temperature de cuisson, duree de process (`recipe.productionTime`), aspect du produit.
   - Consigner toute anomalie observee (equipement, MP, process).

3. **A la cloture de production**
   - L'operateur ou le chef de production complete l'ordre via `POST /api/production/:id/complete` avec :
     - `quantityProduced` : quantite reellement produite
     - `batchWeightReal` : poids reel du batch en grammes (optionnel)
     - `qualityStatus` : `'OK'`, `'DEFAUT_MINEUR'`, ou `'DEFAUT_MAJEUR'`
     - `qualityNotes` : description detaillee du controle
   - Le systeme calcule automatiquement le `yieldPercentage` : `(quantityProduced / targetQuantity) * 100`.

4. **Analyse du rendement**
   - Si le rendement est inferieur a `(1 - lossTolerance) * 100` (par defaut 98%, car `lossTolerance = 0.02`), un drapeau qualite est leve.
   - Consulter les tendances via `GET /api/production/dashboard/analytics?period=month` pour identifier des patterns de rendement faible.

5. **Gestion des defauts**
   - `DEFAUT_MINEUR` : documenter, suivre, actions correctives planifiees. Le lot PF est cree normalement.
   - `DEFAUT_MAJEUR` : le lot PF peut etre cree mais doit etre immediatement bloque (`LotPf.status = BLOCKED`, `blockedReason = 'QUALITY'`). Investigation requise avant liberation.

6. **Creation du lot PF**
   - Le systeme cree automatiquement un `LotPf` avec :
     - `lotNumber` genere automatiquement
     - `manufactureDate` = date de cloture
     - `expiryDate` = date de cloture + `shelfLifeDays` de la recette (defaut 90 jours)
     - `productionOrderId` liant le lot a l'ordre de production
     - `status: AVAILABLE` (ou `BLOCKED` si defaut majeur)

---

### Workflow C : Gestion des lots (tracabilite FIFO, blocage/deblocage, DLC)

**Objectif :** Assurer la tracabilite complete et le respect du FIFO a tout moment.

**Etapes detaillees :**

1. **Consultation de l'etat des lots**
   - Lots MP : `GET /api/lots/mp?productId=X` -- retourne tous les lots avec `lotNumber`, `quantityInitial`, `quantityRemaining`, `expiryDate`, `status`, `supplierId`.
   - Lots PF : `GET /api/lots/pf?productId=X` -- meme structure avec `productionOrderId`.
   - Verification FIFO : les lots sont indexes par `[productId, status, createdAt, expiryDate]` (index `idx_lots_mp_fifo`). Le systeme consomme automatiquement les plus anciens.

2. **Identification des lots problematiques**
   - `GET /api/lots/expiring?days=7` : lots qui expirent dans les 7 prochains jours (MP et PF).
   - `GET /api/lots/expired` : lots deja expires (ADMIN uniquement).
   - Filtrer par status `BLOCKED` pour identifier les lots bloques.

3. **Blocage d'un lot**
   - Le blocage automatique (`DLC_EXPIRED_AUTO`) est gere par le systeme quand la DLC est depassee. Le champ `blockedReason` est renseigne automatiquement.
   - Pour un blocage manuel qualite : l'operation se fait via ajustement lot (`POST /api/lots/mp/:id/adjust` pour mettre la quantite a 0) ou par une action directe dans la base de donnees par un ADMIN. Le `blockedReason` est `'QUALITY'` ou `'MANUAL'`.
   - Tout blocage est trace dans l'`AuditLog` avec `beforeState` et `afterState`.

4. **Deblocage d'un lot**
   - Uniquement apres investigation qualite documentee.
   - Le deblocage se fait par un ADMIN qui remet le statut a `AVAILABLE` avec une note justificative.
   - L'`AuditLog` enregistre l'action avec le motif de deblocage.

5. **Verification de la tracabilite complete**
   - Pour un lot MP donne : `GET /api/stock/mp/:id/movements` retourne tous les mouvements (RECEPTION, PRODUCTION_OUT, INVENTAIRE, PERTE).
   - Pour un lot PF donne : `GET /api/stock/pf/:id/movements` retourne les mouvements (PRODUCTION_IN, VENTE, INVENTAIRE).
   - Utiliser `GET /api/production/lots/search?q=L240101-001` pour retrouver un lot par son numero.

---

### Workflow D : Validation inventaire

**Declencheur :** Une declaration d'inventaire est creee par un compteur terrain (`POST /api/inventory/declare`).

**Etapes detaillees :**

1. **Reception de la declaration**
   - Le systeme calcule automatiquement :
     - Le stock theorique (somme des mouvements IN - OUT non supprimes)
     - L'ecart : `declaredStock - theoreticalStock`
     - Le pourcentage d'ecart : `abs(ecart) / theoreticalStock * 100`
     - La valeur de l'ecart : `abs(ecart) * cout unitaire`
   - Le niveau de risque est determine selon les seuils :

     | Type produit | AUTO (LOW) | VALIDATION (MEDIUM) | DOUBLE VALIDATION (HIGH/CRITICAL) |
     |---|---|---|---|
     | MP perissable | < 2% | 2% - 5% | > 5% ou > 50 000 DA |
     | MP non perissable | < 3% | 3% - 8% | > 8% ou > 50 000 DA |
     | PF | < 1% | 1% - 3% | > 3% ou > 50 000 DA |

2. **Triage des declarations a valider**
   - `GET /api/inventory/pending` retourne les declarations en attente, triees par risque decroissant puis date croissante.
   - Chaque declaration indique : `productType`, `productName`, `productCode`, `theoreticalStock`, `declaredStock`, `difference`, `differencePercent`, `riskLevel`, `status`, `countedBy`, `countedAt`, `notes`, `hasEvidence`.

3. **Analyse de l'ecart**
   - Verifier la coherence de la declaration avec l'historique : `GET /api/inventory/history/:type/:productId`.
   - Si des photos de preuve sont jointes (`evidencePhotos`), les examiner.
   - Verifier si un pattern suspect est detecte (le systeme marque `suspiciousPattern: true` si 3 ecarts negatifs consecutifs en 30 jours par le meme compteur).

4. **Decision : Approbation ou Rejet**
   - **Approbation** : `POST /api/inventory/:id/validate` avec `{ approvalReason: "..." }`.
     - REGLE OBLIGATOIRE : Le validateur ne peut pas etre la personne qui a compte (segregation des taches imposee par le systeme).
     - Pour les declarations `PENDING_DOUBLE_VALIDATION` : un premier ADMIN valide (passage a `PENDING_VALIDATION`), puis un second ADMIN different valide (passage a `APPROVED`).
     - Apres approbation, un mouvement d'ajustement (`StockMovement` avec `origin: INVENTAIRE`) est cree automatiquement.
   - **Rejet** : `POST /api/inventory/:id/reject` avec `{ rejectionReason: "..." }`.
     - Un nouveau comptage sera requis. Le cooldown de 4 heures entre inventaires du meme produit s'applique.

5. **Suivi post-validation**
   - Verifier que le mouvement d'ajustement a bien ete cree (reference `INV-{declarationId}`).
   - Le `lastPhysicalStock` et `lastPhysicalStockDate` du produit sont mis a jour automatiquement.

---

### Workflow E : Gestion des alertes DLC

**Declencheur :** Le systeme genere des alertes `DLC_PROCHE` via le scan automatique des alertes (`ApproAlertService.scanAndCreateAlerts`).

**Etapes detaillees :**

1. **Detection des lots proches expiration**
   - `GET /api/lots/expiring?days=7` : lots expirant dans les 7 prochains jours.
   - `GET /api/lots/expiring?days=14` : anticipation a 14 jours.
   - `GET /api/stock/alerts` : alertes stock consolidees incluant les alertes DLC.
   - Les alertes `ApproAlert` de type `DLC_PROCHE` sont creees avec `entityType: LOT` et `niveau: WARNING` ou `CRITICAL`.

2. **Evaluation du risque**
   - Verifier la `quantityRemaining` de chaque lot concerne.
   - Evaluer si le lot peut etre consomme avant la DLC : comparer avec la consommation moyenne journaliere (`consommationMoyJour`) de la MP ou le rythme de vente du PF.
   - Prioriser : un lot avec 500 kg restants expirant dans 3 jours est plus critique qu'un lot avec 5 kg expirant dans 5 jours.

3. **Actions correctives**
   - **Utilisation acceleree** : reprogrammer la production pour consommer les lots MP proches de l'expiration en priorite (le FIFO le fait naturellement, mais une acceleration peut etre decidee).
   - **Promotion commerciale** : pour les lots PF proches de la DLC, informer le service Commercial pour organiser des ventes rapides.
   - **Blocage preventif** : si le lot ne peut pas etre consomme a temps, le bloquer manuellement avec `blockedReason: 'QUALITY'` avant la date d'expiration.
   - **Declaration de perte** : `POST /api/stock/loss` avec motif et photos de preuve si necessaire.

4. **Accusee de reception des alertes**
   - Les alertes `CRITICAL` DOIVENT etre accusees (obligation de tracabilite). L'accuse de reception enregistre `acknowledgedAt`, `acknowledgedBy` dans l'`ApproAlert`.
   - Un audit trail complet est maintenu : qui a vu l'alerte, quand, quelle action a ete prise.

5. **Blocage automatique**
   - Quand la DLC est depassee, le systeme bloque automatiquement le lot : `status: BLOCKED`, `blockedReason: 'DLC_EXPIRED_AUTO'`, `blockedAt: now()`.
   - Le lot n'est plus disponible pour la consommation production ni pour la vente.

---

### Workflow F : Evaluation fournisseurs qualite

**Objectif :** Evaluer en continu la performance des fournisseurs et agir sur les non-conformites.

**Etapes detaillees :**

1. **Consultation du tableau de bord fournisseurs**
   - `GET /api/suppliers` : liste complete avec `grade`, `scorePerformance`, `tauxRetard`, `tauxEcartQuantite`, `tauxRupturesCausees`, `isBlocked`, `isUnderSurveillance`.
   - `GET /api/suppliers/:id` : detail complet d'un fournisseur.
   - `GET /api/suppliers/:id/history` : historique des receptions avec filtres temporels.
   - `GET /api/suppliers/:id/impact-chain` : chaine d'impact complete (MP fournies, recettes impactees, risque supply chain).

2. **Analyse des metriques**
   - **Grade A** (>90%) : fournisseur fiable. Maintenir la relation.
   - **Grade B** (70-90%) : fournisseur acceptable. Surveillance recommandee.
   - **Grade C** (<70%) : fournisseur a risque. Action corrective immediate requise.
   - Les seuils de declenchement d'alerte : taux de retard > 20% declenche une `ApproAlert` de type `FOURNISSEUR_RETARD` avec niveau `WARNING`. Au-dessus de 30%, le niveau passe a `CRITICAL`.

3. **Actions sur fournisseur non conforme**
   - **Mise sous surveillance** : `PUT /api/suppliers/:id/surveillance` avec motif, duree, et identifiant de l'operateur. Les champs `isUnderSurveillance`, `surveillanceReason`, `surveillanceAt`, `surveillanceUntil` sont renseignes.
   - **Blocage temporaire** : `PUT /api/suppliers/:id/block` avec motif obligatoire, duree optionnelle. Les champs `isBlocked`, `blockedReason`, `blockedAt`, `blockedUntil` sont renseignes. Un fournisseur bloque ne peut plus recevoir de commandes.
   - Chaque action est tracee dans l'`AuditLog` avec les actions `SUPPLIER_BLOCKED` ou `SUPPLIER_SURVEILLANCE`.

4. **Plan d'amelioration**
   - Pour un fournisseur grade C : etablir un plan d'amelioration avec objectifs mesurables.
   - Fixer une date de revue (utiliser `surveillanceUntil` ou `blockedUntil`).
   - Si pas d'amelioration apres la periode de surveillance : envisager le remplacement.

---

### Workflow G : Audit de tracabilite

**Objectif :** Reconstituer l'historique complet d'un lot depuis la reception MP jusqu'a la livraison client.

**Etapes detaillees :**

1. **Identification du lot cible**
   - Rechercher le lot par numero : `GET /api/production/lots/search?q=L240101-001`.
   - Identifier le type (MP ou PF) et le produit associe.

2. **Tracabilite ascendante (du PF vers la MP)**
   - Pour un lot PF : consulter `GET /api/production/:id` (via `productionOrderId` du lot PF). Cela donne :
     - La recette utilisee (`recipeId`)
     - Les consommations MP (`ProductionConsumption`) avec `lotMpId` -- identifiant exact du lot MP consomme
     - Le rendement (`yieldPercentage`)
     - Le statut qualite (`qualityStatus`, `qualityNotes`)
   - Pour chaque lot MP consomme : remonter au fournisseur via `LotMp.supplierId` et a la reception via `LotMp.receptionId`.

3. **Tracabilite descendante (de la MP vers le PF et le client)**
   - Pour un lot MP : consulter les `ProductionConsumption` qui referencent ce `lotMpId`.
   - Cela donne les ordres de production concernes et donc les lots PF produits.
   - Pour les lots PF : consulter les `StockMovement` de type `VENTE` pour identifier les factures et donc les clients (via `Invoice.clientId`).
   - Les livraisons (`Delivery`) associees aux factures donnent la destination finale.

4. **Consultation de l'audit trail**
   - `GET /api/security/audit/entity/LotMp/:lotId` : historique complet de toutes les actions sur ce lot.
   - `GET /api/security/audit/entity/ProductionOrder/:orderId` : historique de l'ordre de production.
   - L'`AuditLog` est append-only et hash-chained (`hash`, `previousHash`) : aucune falsification possible.

5. **Constitution du dossier de tracabilite**
   - Assembler chronologiquement :
     1. Reception MP (date, fournisseur, BL, lot fournisseur, DLC)
     2. Stockage (type stockage, mouvements)
     3. Production (date, recette, rendement, qualite)
     4. Stockage PF (lot, DLC calculee)
     5. Vente (facture, client)
     6. Livraison (date, preuve de livraison, QR validation)
   - Ce dossier est la base documentaire pour tout rappel produit ou audit HACCP.

---

## 3. SCENARIOS REELS

### Scenario 1 : Lot fromage avec DLC depassee decouvert en stock

**Contexte :** Lors d'une ronde qualite hebdomadaire, le Responsable Qualite constate qu'un lot de Cheddar MONTESA 2 kg est encore physiquement en rayon froid, mais sa DLC est depassee depuis 2 jours.

**Actions dans l'ERP :**

1. Consulter `GET /api/lots/expired` pour verifier si le systeme a bien detecte l'expiration.
2. Le systeme DOIT avoir automatiquement passe le lot en `status: BLOCKED` avec `blockedReason: 'DLC_EXPIRED_AUTO'`. Si ce n'est pas le cas, c'est une anomalie grave du systeme.
3. Verifier `GET /api/stock/pf/:productId/movements` pour s'assurer qu'aucune vente n'a ete effectuee apres la date d'expiration.
4. Declarer une perte via `POST /api/stock/loss` avec :
   - `productType: 'PF'`
   - `productId` du Cheddar
   - `lotId` du lot concerne
   - `quantity` : quantite restante
   - `reason: 'DLC depassee - lot L240215-003'`
   - `evidencePhotos` : photo du lot avec etiquette DLC visible
5. Ouvrir une investigation : pourquoi le lot n'a-t-il pas ete consomme/vendu avant la DLC ? Consulter `GET /api/lots/expiring` sur la periode concernee pour verifier si l'alerte avait ete generee.
6. Documenter l'incident et les actions correctives.

**Resultat attendu :** Le stock est ajuste, la perte est tracee, l'audit trail est complet, et des mesures preventives sont mises en place.

---

### Scenario 2 : Defaut majeur en production

**Contexte :** Pendant la production de fromage fondu en seau 400g, l'operateur constate une texture anormale (granuleuse au lieu de lisse). Le batch est termine mais le produit est non conforme.

**Actions dans l'ERP :**

1. L'operateur complete l'ordre de production via `POST /api/production/:id/complete` avec :
   - `quantityProduced` : quantite reellement produite
   - `qualityStatus: 'DEFAUT_MAJEUR'`
   - `qualityNotes: 'Texture granuleuse anormale - possible probleme temperature fusion ou qualite MP Cheddar lot L240110-002'`
2. Le Responsable Qualite consulte l'ordre : `GET /api/production/:id`.
3. Identifier les lots MP consommes dans les `ProductionConsumption` associees.
4. Bloquer le lot PF cree : il ne doit PAS etre disponible a la vente. Via `POST /api/lots/pf/:id/adjust` mettre la quantite disponible a 0, ou blocage par ADMIN.
5. Analyser les lots MP : consulter `GET /api/lots/mp?productId=X` pour les lots Cheddar utilises. Verifier si d'autres productions avec les memes lots ont presente des anomalies.
6. Si la MP est en cause : bloquer le lot MP restant. Informer le service Appro.
7. Consulter `GET /api/production/dashboard/analytics?period=month` pour verifier si c'est un incident isole ou une tendance.
8. Documenter dans les qualityNotes et dans un rapport d'investigation.

**Resultat attendu :** Lot PF bloque, lots MP suspects investigues, tracabilite complete documentee, actions correctives identifiees.

---

### Scenario 3 : Rappel produit / tracabilite

**Contexte :** Un client signale un probleme sanitaire sur un lot de Gouda MONTESA 800g. L'autorite sanitaire demande une tracabilite complete dans les 4 heures.

**Actions dans l'ERP :**

1. Identifier le lot PF : `GET /api/production/lots/search?q=LP260115-005&type=PF`.
2. Retrouver l'ordre de production : champ `productionOrderId` du lot PF. Consulter `GET /api/production/:orderId`.
3. **Tracabilite ascendante** : identifier toutes les MP utilisees via les `ProductionConsumption`. Pour chaque `lotMpId`, retrouver :
   - Le fournisseur (`supplierId`)
   - La reception (`receptionId`)
   - Le lot fournisseur (`lotNumber` du LotMp)
4. **Tracabilite descendante** : identifier toutes les ventes du lot PF concerne via `GET /api/stock/pf/:productId/movements`. Filtrer par `lotPfId` et `origin: VENTE`. Les `referenceId` pointent vers les factures, et de la vers les clients.
5. **Perimetre du rappel** : determiner si d'autres lots PF issus des memes lots MP sont concernes. Consulter les `ProductionConsumption` de tous les lots MP impliques.
6. Bloquer immediatement tous les lots PF concernes encore en stock.
7. Constituer le dossier de tracabilite complet (cf. Workflow G).
8. Consulter `GET /api/security/audit/entity/ProductionOrder/:orderId` pour l'audit trail complet.
9. Notifier l'autorite sanitaire avec le dossier.

**Resultat attendu :** Tracabilite complete en moins de 4 heures, tous les lots concernes identifies et bloques, clients impactes identifies pour le rappel.

---

### Scenario 4 : Ecart inventaire critique

**Contexte :** Lors de l'inventaire mensuel du sel (MP-003), le compteur declare 450 kg alors que le stock theorique est de 620 kg -- soit un ecart de -27.4%.

**Actions dans l'ERP :**

1. La declaration via `POST /api/inventory/declare` retourne :
   - `riskLevel: 'CRITICAL'`
   - `status: 'PENDING_DOUBLE_VALIDATION'`
   - `requiresDoubleValidation: true`
   - `requiresEvidence: true`
   - Le systeme verifie egalement le `suspiciousPattern` (3 ecarts negatifs consecutifs en 30 jours).

2. Le Responsable Qualite est notifie via `GET /api/inventory/pending`.

3. Investigation avant validation :
   - Consulter `GET /api/inventory/history/MP/3` pour les declarations precedentes du sel.
   - Consulter `GET /api/stock/mp/3/movements` pour identifier les mouvements de stock recents.
   - Verifier s'il y a eu des productions non enregistrees, des pertes non declarees, ou un vol potentiel.
   - Verifier les photos de preuve (`evidencePhotos`) jointes a la declaration.

4. Decision :
   - Si l'ecart est justifie (ex: perte lors d'un nettoyage non declaree) : premier ADMIN valide via `POST /api/inventory/:id/validate` avec `approvalReason` detaille. Puis un second ADMIN different valide.
   - Si l'ecart n'est pas justifie : rejeter via `POST /api/inventory/:id/reject` avec `rejectionReason`. Un nouveau comptage sera requis (avec le cooldown de 4h).

5. Si un pattern suspect est detecte : ouvrir une enquete formelle. L'alerte est automatiquement creee dans le systeme (`Alert` avec type `LOW_STOCK_MP`, metadata `alertSubType: 'SUSPICIOUS_INVENTORY_PATTERN'`).

**Resultat attendu :** Ecart investigue, double validation effectuee par deux ADMIN differents, mouvement d'ajustement cree, audit trail complet.

---

### Scenario 5 : Fournisseur grade C

**Contexte :** Le fournisseur FOUR-003 "Laiterie du Sud" a un taux de retard de 35% et un taux d'ecart quantite de 12%. Son score de performance est de 55/100, grade C.

**Actions dans l'ERP :**

1. Consulter le detail : `GET /api/suppliers/3`.
   - `grade: 'C'`
   - `scorePerformance: 55`
   - `tauxRetard: 0.35`
   - `tauxEcartQuantite: 0.12`
   - `totalLivraisons: 20`
   - `livraisonsRetard: 7`

2. Consulter la chaine d'impact : `GET /api/suppliers/3/impact-chain`.
   - Identifier quelles MP ce fournisseur est le principal (`fournisseurPrincipalId`).
   - Identifier quelles recettes sont impactees.
   - Evaluer le risque de blocage production si ce fournisseur est suspendu.

3. Verifier l'historique recent : `GET /api/suppliers/3/history?from=2026-01-01`.

4. Decision selon la gravite :
   - **Mise sous surveillance** : `PUT /api/suppliers/3/surveillance` avec `{ reason: "Score performance 55/100, taux retard 35%", until: "2026-04-01" }`.
   - **Blocage temporaire** : `PUT /api/suppliers/3/block` avec `{ reason: "Non-conformites repetees, investigation en cours", until: "2026-03-15" }`.

5. Verifier l'existence d'alertes non accusees : les alertes `FOURNISSEUR_RETARD` doivent etre accusees.

6. Planifier une revue avec le service Appro pour identifier un fournisseur alternatif pour les MP critiques.

**Resultat attendu :** Fournisseur mis sous surveillance ou bloque, plan d'amelioration etabli, fournisseur alternatif identifie si necessaire.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Ne pas accuser reception des alertes CRITICAL

**Description :** Les alertes `CRITICAL` non accusees s'accumulent. L'obligation d'accuse de reception existe pour garantir que quelqu'un a vu et pris en charge l'alerte.

**Consequence :** Perte de tracabilite. En cas d'audit, impossibilite de prouver que le personnel etait informe. Certaines actions peuvent etre bloquees par le systeme si des alertes critiques sont en attente.

**Prevention :** Integrer la verification des alertes dans la checklist quotidienne. Le dashboard affiche le compteur `criticalUnacknowledged`.

---

### Erreur 2 : Valider un inventaire sans investigation prealable

**Description :** Approuver mecaniquement une declaration inventaire avec un ecart MEDIUM ou HIGH sans verifier l'historique des mouvements ni les declarations precedentes.

**Consequence :** Ajustement de stock non justifie, masquage de pertes reelles ou de vols, degradation progressive de la fiabilite du stock theorique.

**Prevention :** Toujours consulter `GET /api/inventory/history/:type/:productId` et `GET /api/stock/:type/:id/movements` avant de valider. Exiger des photos de preuve pour les ecarts > 5%.

---

### Erreur 3 : Ignorer les lots proches DLC

**Description :** Ne pas consulter regulierement `GET /api/lots/expiring` et laisser des lots expirer sans action preventive.

**Consequence :** Pertes financieres (lots detruits), risque sanitaire si un lot expire est accidentellement utilise ou vendu, non-conformite HACCP.

**Prevention :** Consultation quotidienne obligatoire. Parametre de scan a 14 jours pour anticipation maximale.

---

### Erreur 4 : Saisir un qualityStatus incorrect lors de la cloture production

**Description :** L'operateur saisit `OK` alors qu'un defaut mineur a ete observe, ou omet de renseigner les `qualityNotes`.

**Consequence :** Perte d'information critique pour la tracabilite. En cas de reclamation client, impossibilite de retrouver l'historique qualite de la production.

**Prevention :** Former les operateurs a la rigueur de la saisie qualite. Le champ `qualityNotes` devrait toujours etre renseigne, meme quand le statut est `OK` (ex: "RAS, controle conforme").

---

### Erreur 5 : Tenter de valider un inventaire que l'on a soi-meme compte

**Description :** Le meme utilisateur declare un comptage physique puis tente de le valider.

**Consequence :** Le systeme BLOQUE cette action (`SELF_VALIDATION_FORBIDDEN`). Une tentative est logguee dans l'`AuditLog` avec `action: ACCESS_DENIED` et `severity: SECURITY`.

**Prevention :** Organiser les equipes pour que le compteur et le validateur soient toujours des personnes differentes. Pour les declarations CRITICAL en double validation, trois personnes distinctes sont necessaires (compteur + 2 validateurs).

---

### Erreur 6 : Ne pas verifier la temperature lors de la reception MP

**Description :** Accepter une livraison de MP refrigeree sans controle thermometrique.

**Consequence :** Rupture de la chaine du froid non detectee. Contamination microbiologique potentielle. L'ERP enregistre la reception comme conforme alors que le produit est compromis.

**Prevention :** Le controle temperature est une etape obligatoire du Workflow A. Utiliser un thermometre calibre et consigner le resultat.

---

### Erreur 7 : Oublier de bloquer un lot PF apres un DEFAUT_MAJEUR

**Description :** La production est cloturee avec `qualityStatus: 'DEFAUT_MAJEUR'` mais le lot PF resultant reste en statut `AVAILABLE`.

**Consequence :** Le lot defectueux peut etre vendu au client. Risque sanitaire et commercial majeur.

**Prevention :** Apres toute production avec `DEFAUT_MAJEUR`, verifier immediatement que le lot PF est bloque. Idealement, automatiser ce blocage.

---

### Erreur 8 : Declarer une perte sans photo de preuve

**Description :** Utiliser `POST /api/stock/loss` sans joindre de `evidencePhotos`.

**Consequence :** Perte de credibilite de la declaration. En cas d'audit, difficulte a justifier la perte. Pattern potentiellement suspect.

**Prevention :** Rendre les photos de preuve obligatoires pour toute declaration de perte superieure a un seuil defini.

---

### Erreur 9 : Ignorer un fournisseur en grade C

**Description :** Ne pas agir sur un fournisseur dont le grade est passe a C, continuant a commander normalement.

**Consequence :** Risque croissant de ruptures, d'ecarts quantite, et de qualite MP degradee impactant la production.

**Prevention :** Configurer le systeme pour generer des alertes `FOURNISSEUR_RETARD` automatiquement (seuil 20%). Revue mensuelle obligatoire des fournisseurs grade B et C.

---

### Erreur 10 : Ne pas documenter les actions correctives

**Description :** Identifier un probleme qualite, le resoudre operationnellement, mais ne pas enregistrer les actions correctives dans l'ERP (notes, audit trail).

**Consequence :** Perte d'historique. Lors d'un audit HACCP, impossibilite de demontrer que les problemes ont ete traites. Risque de recurrence.

**Prevention :** Toute action corrective doit etre documentee : dans les `qualityNotes` de production, dans les `notes` d'inventaire, dans les `approvalReason` ou `rejectionReason`, et dans les metadata de l'`AuditLog`.

---

## 5. RISQUES METIER CRITIQUES

### 5.1 Securite alimentaire

| Risque | Impact | Probabilite | Mitigation ERP |
|---|---|---|---|
| Lot DLC depassee vendu au client | CRITIQUE -- Sanitaire + Legal | Faible (blocage auto) | Blocage automatique `DLC_EXPIRED_AUTO`. Scan quotidien `GET /api/lots/expired`. |
| Rupture chaine du froid non detectee | CRITIQUE -- Contamination | Moyenne | Controle temperature obligatoire a la reception. Type de stockage (`StorageType`) par produit. |
| MP contaminee utilisee en production | CRITIQUE -- Rappel produit | Faible | Tracabilite lot-par-lot dans `ProductionConsumption`. Blocage lot avec `status: BLOCKED`. |
| Defaut majeur non bloque | ELEVE -- Produit non conforme vendu | Moyenne | `qualityStatus: DEFAUT_MAJEUR` doit declencher blocage automatique du lot PF. |
| Tracabilite incomplete | ELEVE -- Non-conformite audit | Faible | AuditLog append-only hash-chained. Tous les mouvements traces avec `lotSnapshot`. |

### 5.2 Conformite HACCP

Le systeme Manchengo Smart ERP adresse les exigences HACCP suivantes :

- **Principe 1 -- Analyse des dangers :** Le Responsable Qualite documente les points critiques via les champs qualite de production et les alertes DLC.
- **Principe 2 -- Points critiques de controle (CCP):** La reception MP (temperature, DLC) et la production (rendement, qualite) sont les CCP principaux couverts par l'ERP.
- **Principe 4 -- Surveillance :** Les alertes automatiques (`ApproAlert`, `Alert`) surveillent en continu les deviations.
- **Principe 5 -- Actions correctives :** Blocage lots, declaration pertes, rejet inventaire, blocage fournisseur.
- **Principe 6 -- Verification :** Audit trail hash-chained non falsifiable. `GET /api/security/audit` pour investigation.
- **Principe 7 -- Documentation :** Toutes les donnees sont immutables dans l'`AuditLog` et les `DomainEvent`.

### 5.3 Risque de rappel produit

**Capacite de tracabilite de l'ERP :** Le systeme permet de reconstituer la chaine complete en utilisant :
- `LotPf.productionOrderId` -> `ProductionOrder` -> `ProductionConsumption.lotMpId` -> `LotMp.supplierId` + `LotMp.receptionId`
- `StockMovement` (origin VENTE) -> `Invoice` -> `Client` + `Delivery`

**Delai cible :** Tracabilite complete en moins de 4 heures (exigence reglementaire).

**Test de rappel :** Effectuer un exercice de rappel trimestriel en utilisant le Workflow G pour verifier la capacite du systeme.

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist quotidienne (15-20 minutes)

| # | Action | Endpoint ERP | Fait |
|---|---|---|---|
| 1 | Verifier les alertes CRITICAL non accusees | Dashboard + `ApproAlert` (criticalUnacknowledged) | [ ] |
| 2 | Consulter les lots proches expiration (7 jours) | `GET /api/lots/expiring?days=7` | [ ] |
| 3 | Verifier les lots expires non traites | `GET /api/lots/expired` | [ ] |
| 4 | Consulter les declarations inventaire en attente | `GET /api/inventory/pending` | [ ] |
| 5 | Verifier les alertes stock (ruptures, DLC) | `GET /api/stock/alerts` | [ ] |
| 6 | Controler les productions du jour (qualityStatus) | `GET /api/production?status=COMPLETED` | [ ] |
| 7 | Verifier les receptions MP du jour | Suivi receptions via stock/mp/receptions | [ ] |

### 6.2 Checklist hebdomadaire (45-60 minutes)

| # | Action | Endpoint ERP | Fait |
|---|---|---|---|
| 1 | Analyser les KPIs production de la semaine | `GET /api/production/dashboard/kpis` | [ ] |
| 2 | Consulter les analytics production (rendement, defauts) | `GET /api/production/dashboard/analytics?period=week` | [ ] |
| 3 | Identifier les productions avec rendement faible | `lowYieldCount` dans les KPIs | [ ] |
| 4 | Revue des lots proches expiration (14 jours) | `GET /api/lots/expiring?days=14` | [ ] |
| 5 | Controle des ecarts inventaire valides cette semaine | `GET /api/inventory/history` par produit | [ ] |
| 6 | Verification des fournisseurs en grade B/C | `GET /api/suppliers` filtre grade | [ ] |
| 7 | Verification des fournisseurs sous surveillance | `isUnderSurveillance: true` | [ ] |
| 8 | Ronde physique des zones de stockage (temperatures) | Controle terrain | [ ] |

### 6.3 Checklist mensuelle (2-3 heures)

| # | Action | Endpoint ERP | Fait |
|---|---|---|---|
| 1 | Rapport mensuel qualite production | `GET /api/production/dashboard/analytics?period=month` | [ ] |
| 2 | Bilan des pertes du mois | `StockMovement` origin PERTE (filtre mensuel) | [ ] |
| 3 | Revue complete des grades fournisseurs | `GET /api/suppliers` + analyse tendances | [ ] |
| 4 | Audit des lots bloques non traites | Lots avec `status: BLOCKED` depuis > 7 jours | [ ] |
| 5 | Revue des ecarts inventaire (tendances par produit) | `GET /api/inventory/history` pour produits cles | [ ] |
| 6 | Verification de l'integrite de l'audit trail | `GET /api/security/audit/stats` | [ ] |
| 7 | Exercice de tracabilite (lot aleatoire) | Workflow G complet | [ ] |
| 8 | Revue des alertes CRITICAL du mois | `ApproAlert` filtre mensuel | [ ] |
| 9 | Mise a jour des seuils si necessaire | Configuration tolerances inventaire | [ ] |
| 10 | Rapport mensuel a la Direction | Compilation des indicateurs | [ ] |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Introduction a la qualite dans Manchengo Smart ERP (8 minutes)

**Plan :**

- 0:00-1:00 -- **Introduction** : Presentation du role de Responsable Qualite dans l'ERP. "Ce module couvre votre environnement de travail quotidien dans Manchengo Smart ERP."
- 1:00-3:00 -- **Navigation** : Connexion au systeme, presentation du dashboard principal, localisation des modules Lots, Production, Inventaire, Stock, Fournisseurs. Montrer les indicateurs qualite sur le dashboard (rendement moyen, alertes DLC, lots bloques).
- 3:00-5:00 -- **Les roles RBAC** : Expliquer que le Responsable Qualite utilise principalement le role ADMIN (pour les validations inventaire et blocages) ou PRODUCTION (pour le suivi production). Montrer les acces de chaque role.
- 5:00-7:00 -- **Les alertes** : Presenter les types d'alertes pertinentes pour la qualite : DLC_PROCHE, MP_CRITIQUE, FOURNISSEUR_RETARD. Montrer le compteur d'alertes CRITICAL non accusees.
- 7:00-8:00 -- **Resume et transition** : "Vous connaissez maintenant votre environnement. Dans le module suivant, nous verrons le controle qualite a la reception."

---

### Module 2 : Controle qualite reception MP (10 minutes)

**Plan :**

- 0:00-2:00 -- **Contexte** : Pourquoi le controle reception est le premier rempart qualite. Presenter les champs cles d'une reception : fournisseur, BL, lignes (produit, quantite, lot, DLC).
- 2:00-4:00 -- **Demonstration ecran** : Naviguer vers les receptions recentes. Montrer une reception avec ses lignes. Expliquer comment verifier la correspondance BL / ERP.
- 4:00-6:00 -- **Verification DLC** : Montrer comment consulter la DLC des lots MP crees. Expliquer le calcul de la DLC residuelle et le seuil d'acceptation.
- 6:00-8:00 -- **Gestion des ecarts** : Montrer un cas d'ecart quantite. Expliquer l'impact sur le `tauxEcartQuantite` du fournisseur. Montrer comment cela affecte le grade.
- 8:00-9:30 -- **Cas de non-conformite** : Montrer comment un lot est bloque a la reception. Expliquer le statut `BLOCKED` avec `blockedReason: 'QUALITY'`.
- 9:30-10:00 -- **Resume** : Points cles a retenir pour chaque reception.

---

### Module 3 : Suivi qualite production et gestion des lots (12 minutes)

**Plan :**

- 0:00-2:00 -- **Cycle de vie d'une production** : PENDING -> IN_PROGRESS -> COMPLETED. Expliquer la consommation FIFO automatique des lots MP.
- 2:00-4:00 -- **Controle en production** : Montrer l'ecran de l'ordre de production. Expliquer les champs `qualityStatus` et `qualityNotes`. Demonstration de la saisie `DEFAUT_MINEUR` et `DEFAUT_MAJEUR`.
- 4:00-6:00 -- **Rendement** : Montrer le calcul `yieldPercentage = quantityProduced / targetQuantity`. Expliquer le `lossTolerance` de la recette (defaut 2%). Montrer les analytics de rendement sur le dashboard.
- 6:00-8:00 -- **Gestion des lots** : Montrer la liste des lots MP et PF. Expliquer les statuts AVAILABLE, BLOCKED, CONSUMED. Montrer comment rechercher un lot par son numero.
- 8:00-10:00 -- **Tracabilite FIFO** : Expliquer l'index `idx_lots_mp_fifo` et le tri par `createdAt` puis `expiryDate`. Montrer comment le systeme consomme toujours les lots les plus anciens.
- 10:00-12:00 -- **Alertes DLC** : Montrer `GET /api/lots/expiring`. Expliquer les actions correctives possibles. Montrer le blocage automatique a l'expiration.

---

### Module 4 : Processus inventaire et validation des ecarts (10 minutes)

**Plan :**

- 0:00-2:00 -- **Le processus inventaire** : Expliquer le workflow complet : Declaration -> Analyse -> Validation -> Mouvement. Insister sur la segregation des taches (compteur != validateur).
- 2:00-4:00 -- **Les seuils de tolerance** : Montrer le tableau des seuils par type de produit (MP perissable, MP non perissable, PF). Expliquer les niveaux de risque LOW, MEDIUM, HIGH, CRITICAL.
- 4:00-6:00 -- **Demonstration : valider un inventaire** : Montrer la liste des declarations en attente (`GET /api/inventory/pending`). Selectionner une declaration, analyser l'ecart, valider avec un motif.
- 6:00-8:00 -- **Double validation** : Montrer le cas d'un ecart CRITICAL necessitant deux validateurs ADMIN differents. Expliquer le workflow en deux etapes.
- 8:00-9:00 -- **Rejet et recomptage** : Montrer comment rejeter une declaration suspecte. Expliquer le cooldown de 4 heures et l'obligation de recomptage.
- 9:00-10:00 -- **Detection de patterns suspects** : Expliquer la detection automatique de 3 ecarts negatifs consecutifs. Montrer l'alerte generee.

---

### Module 5 : Audit de tracabilite et exercice de rappel (10 minutes)

**Plan :**

- 0:00-2:00 -- **Pourquoi l'audit de tracabilite** : Obligations reglementaires, delai de 4 heures pour un rappel. Presenter l'AuditLog hash-chained.
- 2:00-5:00 -- **Exercice pratique : tracabilite ascendante** : Partir d'un lot PF. Remonter a l'ordre de production, identifier les lots MP consommes, retrouver le fournisseur et la reception d'origine.
- 5:00-7:00 -- **Exercice pratique : tracabilite descendante** : Partir d'un lot MP suspect. Identifier tous les ordres de production qui l'ont utilise, les lots PF resultants, les factures et clients concernes.
- 7:00-9:00 -- **Consultation de l'audit trail** : Montrer `GET /api/security/audit/entity/:entityType/:entityId`. Expliquer les champs WHO/WHAT/ON WHAT/WHEN. Montrer le hash chaining pour prouver l'integrite.
- 9:00-10:00 -- **Synthese** : Constitution du dossier de tracabilite. Delai cible < 4h. Importance de l'exercice trimestriel.

---

## 8. MATRICE RACI

| Activite | Resp. Qualite | Resp. Production | Resp. Appro | ADMIN | Commercial |
|---|---|---|---|---|---|
| **Controle reception MP (temperature, DLC, quantite)** | A | - | R | C | - |
| **Saisie qualityStatus production** | A | R | - | I | - |
| **Blocage lot non conforme** | R | I | I | A | I |
| **Validation inventaire (ecart MEDIUM/HIGH)** | C | I | C | R/A | - |
| **Double validation inventaire (CRITICAL)** | C | - | - | R/A (x2) | - |
| **Gestion alertes DLC** | R/A | I | C | I | I |
| **Declaration de perte** | R | C | C | A | - |
| **Evaluation fournisseur qualite** | R/A | C | C | I | - |
| **Blocage fournisseur** | R | I | C | A | I |
| **Mise sous surveillance fournisseur** | R | I | C | A | I |
| **Exercice de rappel / tracabilite** | R/A | C | C | I | C |
| **Audit trail investigation** | R | I | I | A | - |
| **Rapport mensuel qualite** | R/A | C | C | I | - |
| **Ajustement lot (quantite)** | C | I | I | R/A | - |

**Legende :** R = Responsable, A = Approbateur, C = Consulte, I = Informe

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 : Initial (Ad hoc)

- Les controles qualite sont effectues mais non systematiquement documentes dans l'ERP.
- Les alertes DLC ne sont pas consultees quotidiennement.
- Les declarations inventaire sont validees sans investigation.
- Les fournisseurs ne sont pas evalues formellement.
- Les exercices de tracabilite ne sont pas realises.
- **Score audit estimatif :** 30-45/100

### Niveau 2 : Defini (Processus documentees)

- Tous les controles reception sont effectues et documentes.
- Les alertes DLC sont consultees quotidiennement ; les lots expires sont traites dans les 24h.
- Les declarations inventaire sont analysees avant validation (historique consulte).
- Les fournisseurs sont evalues mensuellement. Les grade C sont identifies.
- Le `qualityStatus` est renseigne systematiquement a la cloture production.
- La checklist quotidienne est suivie.
- **Score audit estimatif :** 55-70/100

### Niveau 3 : Maitrise (Processus mesure)

- Les KPIs qualite sont suivis hebdomadairement (rendement, taux defauts, ecarts inventaire).
- Les exercices de tracabilite trimestriels sont realises (delai < 4h atteint).
- Les fournisseurs grade C ont des plans d'amelioration formalises avec dates de revue.
- Les patterns suspects sont investigues systematiquement.
- Les alertes CRITICAL sont accusees en moins de 4 heures.
- La double validation est effective pour tous les ecarts CRITICAL.
- **Score audit estimatif :** 75-85/100

### Niveau 4 : Optimise (Amelioration continue)

- Les tendances qualite sont analysees proactivement (analytics mensuels et annuels).
- Les seuils de tolerance inventaire sont ajustes par produit en fonction de l'historique.
- Les fournisseurs sont notes en temps reel et les decisions sont data-driven.
- Le delai de tracabilite est inferieur a 2 heures.
- Les non-conformites sont traitees en moins de 24h avec actions correctives documentees.
- Le taux de lots conformes depasse 99%.
- Les tests de rappel trimestriels sont automatises via les endpoints API.
- **Score audit estimatif :** 90-100/100

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Court terme (0-3 mois)

1. **Automatiser le blocage PF apres DEFAUT_MAJEUR :** Actuellement, le `qualityStatus: 'DEFAUT_MAJEUR'` est informatif. Modifier `ProductionService.complete()` pour que tout lot PF issu d'un ordre avec `qualityStatus: 'DEFAUT_MAJEUR'` soit automatiquement cree en `status: BLOCKED` avec `blockedReason: 'QUALITY_DEFECT_MAJOR'`.

2. **Ajouter un endpoint de recherche multi-lots :** Un endpoint `GET /api/lots/search` global (pas seulement via Production) permettrait au Responsable Qualite de chercher des lots MP et PF simultanement par numero, produit, ou statut.

3. **Alertes DLC configurables par produit :** Actuellement, le scan DLC utilise un seuil global (7 jours par defaut). Permettre un seuil personnalise par produit (ex: 14 jours pour les fromages frais, 7 jours pour les fromages a pate dure).

4. **Dashboard qualite dedie :** Creer une vue dashboard specifique au Responsable Qualite aggregeant : alertes DLC, lots bloques, productions avec defauts, inventaires en attente, fournisseurs grade C.

### 10.2 Moyen terme (3-6 mois)

5. **Module de non-conformite structure :** Ajouter un modele `NonConformity` dans le schema Prisma avec : type (reception, production, stockage, livraison), severite, description, actions correctives, date cloture, responsable, lien vers le lot/production concerne.

6. **Indicateur de rendement par recette :** Actuellement, le rendement est par ordre de production. Agreger le rendement moyen par recette sur une periode donnee pour identifier les recettes les moins performantes.

7. **Notifications temps reel :** Utiliser le systeme socket.io existant pour envoyer des notifications push au Responsable Qualite lors de : creation d'une alerte CRITICAL, production avec DEFAUT_MAJEUR, ecart inventaire CRITICAL, lot expire.

8. **Export PDF des rapports qualite :** Etendre le systeme d'export existant (`exports.controller.ts`) pour generer des rapports qualite mensuels en PDF avec graphiques de tendance.

### 10.3 Long terme (6-12 mois)

9. **Integration capteurs IoT temperature :** Connecter des capteurs de temperature des chambres froides au systeme. Alertes automatiques si la temperature sort de la plage autorisee (par `StorageType`).

10. **Module HACCP complet :** Implementer un module dedie avec : plan HACCP par produit, enregistrements CCP, arbres de decision, et generation automatique de la documentation pour les audits de certification.

11. **Intelligence artificielle predictive :** Utiliser l'historique des productions et des defauts pour predire les risques qualite. Identifier les correlations entre lots MP, fournisseurs, conditions de production et taux de defauts.

12. **Portail fournisseur :** Permettre aux fournisseurs de consulter leur grade, leurs metriques, et les non-conformites les concernant via un portail externe. Faciliter la communication et les plans d'amelioration.

---

## 11. GLOSSAIRE METIER

### Termes qualite alimentaire

| Terme | Definition |
|---|---|
| **DLC** | Date Limite de Consommation. Date au-dela de laquelle un produit perissable ne doit plus etre consomme. Champ `expiryDate` dans LotMp et LotPf. |
| **DDM** | Date de Durabilite Minimale (anciennement DLUO). Date indicative apres laquelle le produit peut perdre ses qualites sans danger. |
| **FIFO** | First In, First Out. Principe de gestion des stocks ou les lots les plus anciens sont consommes en premier. Implemente via l'index `idx_lots_mp_fifo` (tri par `createdAt` puis `expiryDate`). |
| **HACCP** | Hazard Analysis Critical Control Point. Methode de maitrise de la securite sanitaire des aliments. Les 7 principes sont partiellement couverts par l'ERP. |
| **CCP** | Critical Control Point. Point dans le processus ou un danger peut etre prevenu, elimine ou reduit a un niveau acceptable. |
| **BPH** | Bonnes Pratiques d'Hygiene. Prerequis a la mise en oeuvre du plan HACCP. |
| **Tracabilite ascendante** | Capacite a retrouver l'origine d'un produit fini (quelles MP, quel fournisseur, quelle reception). |
| **Tracabilite descendante** | Capacite a retrouver la destination d'une MP (quels PF, quels clients, quelles livraisons). |
| **Rappel produit** | Retrait du marche d'un lot de produits presentant un risque sanitaire. L'ERP permet de reconstituer le perimetre en < 4h. |
| **Rendement** | Rapport entre la quantite produite et la quantite cible. Champ `yieldPercentage` dans `ProductionOrder`. |
| **Tolerance de perte** | Pourcentage de perte acceptable en production. Champ `lossTolerance` dans `Recipe` (defaut 2%). |
| **Non-conformite** | Ecart par rapport a une specification, une norme ou une exigence. Captures via `qualityStatus: DEFAUT_MINEUR` ou `DEFAUT_MAJEUR`. |
| **Action corrective** | Action entreprise pour eliminer la cause d'une non-conformite detectee. Documentee dans `qualityNotes` et `AuditLog.metadata`. |
| **Chaine du froid** | Maintien continu de la temperature requise de la production au consommateur. Les types de stockage (`StorageType`) definissent les plages. |

### Termes ERP Manchengo

| Terme | Definition |
|---|---|
| **LotMp** | Lot de matiere premiere. Identifie par `lotNumber` (ex: L240101-001). Possede un statut AVAILABLE/BLOCKED/CONSUMED. |
| **LotPf** | Lot de produit fini. Cree automatiquement lors de la cloture de production. DLC calculee a partir de `shelfLifeDays`. |
| **ProductionOrder** | Ordre de production. Reference unique (ex: OP-240101-001). Suit le cycle PENDING -> IN_PROGRESS -> COMPLETED/CANCELLED. |
| **ProductionConsumption** | Enregistrement de la consommation reelle d'une MP lors d'une production. Lie un `ProductionOrder` a un `LotMp` specifique. |
| **StockMovement** | Mouvement de stock. Types : IN/OUT. Origines : RECEPTION, PRODUCTION_IN, PRODUCTION_OUT, VENTE, INVENTAIRE, PERTE. Jamais supprime (soft delete). |
| **InventoryDeclaration** | Declaration de comptage physique. Niveaux de risque : LOW, MEDIUM, HIGH, CRITICAL. Statuts : PENDING_ANALYSIS, AUTO_APPROVED, PENDING_VALIDATION, PENDING_DOUBLE_VALIDATION, APPROVED, REJECTED, EXPIRED. |
| **ApproAlert** | Alerte metier. Types : MP_CRITIQUE, RUPTURE, FOURNISSEUR_RETARD, PRODUCTION_BLOQUEE, DLC_PROCHE. Niveaux : INFO, WARNING, CRITICAL. |
| **AuditLog** | Journal d'audit immutable et hash-chained. Enregistre WHO (actorId, actorRole), WHAT (action), ON WHAT (entityType, entityId), WHEN (timestamp), et les etats avant/apres. |
| **SupplierGrade** | Grade de performance fournisseur. A (>90%), B (70-90%), C (<70%). Calcule a partir du `scorePerformance`. |
| **StorageType** | Type de stockage definissant la plage de temperature : REFRIGERE (2-8 degres C), FRAIS (0-4 degres C), SEC (ambiante), CONGELE (-18 degres C). |
| **Recipe** | Recette de production. Definit les ingredients (`RecipeItem`), le poids du batch, la quantite de sortie, la tolerance de perte, et la duree de vie. |
| **IdempotencyKey** | Cle d'idempotence protegeant contre les doubles soumissions (double-clic, refresh). TTL de 24h. |
| **DomainEvent** | Evenement metier immutable dans le store d'evenements. Numerotation sequentielle globale pour reconstruction d'etat. |

---

## 12. ANNEXES

### Annexe A : Plages de temperature par type de stockage

| Type de stockage | Code ERP | Plage temperature | Produits concernes |
|---|---|---|---|
| Refrigere | `REFRIGERE` | 2 degres C a 8 degres C | La plupart des fromages (Gouda, Edam, Cheddar), preparations fromageres |
| Frais | `FRAIS` | 0 degres C a 4 degres C | Fromages frais, pates a tartiner, produits laitiers frais |
| Sec | `SEC` | Temperature ambiante (15-25 degres C) | Emballages (seaux IML, barquettes, cartons, films), additifs secs, consommables |
| Congele | `CONGELE` | -18 degres C et en dessous | Produits surgeles, beurre de stockage longue duree |

### Annexe B : Seuils de tolerance inventaire

| Categorie | Auto-approbation (LOW) | Validation simple (MEDIUM) | Double validation (HIGH/CRITICAL) | Seuil valeur critique |
|---|---|---|---|---|
| MP perissable | < 2% | 2% - 5% | > 5% | > 50 000 DA |
| MP non perissable | < 3% | 3% - 8% | > 8% | > 50 000 DA |
| Produit fini (PF) | < 1% | 1% - 3% | > 3% | > 50 000 DA |

**Regles complementaires :**
- Cooldown entre inventaires du meme produit : 4 heures
- Detection pattern suspect : 3 ecarts negatifs consecutifs sur 30 jours par le meme compteur
- Compteur et validateur doivent etre des personnes differentes (segregation obligatoire)
- Double validation : 2 ADMIN differents + 1 compteur = 3 personnes distinctes minimum

### Annexe C : Seuils DLC et actions recommandees

| Delai avant DLC | Niveau alerte | Action recommandee |
|---|---|---|
| > 14 jours | Aucune | Gestion normale, FIFO suffit |
| 7 - 14 jours | INFO | Surveillance. Verifier les previsions de consommation/vente. |
| 3 - 7 jours | WARNING | Action requise. Planifier utilisation acceleree (MP) ou promotion (PF). |
| 1 - 3 jours | CRITICAL | Action immediate. Prioriser la consommation. Bloquer si non utilisable. |
| 0 jour (jour J) | CRITICAL | Dernier jour d'utilisation. Decision : utiliser ou detruire. |
| DLC depassee | Blocage auto | Lot automatiquement bloque (`DLC_EXPIRED_AUTO`). Declaration de perte obligatoire. |

### Annexe D : Grades fournisseurs et seuils

| Grade | Score performance | Taux retard | Action recommandee |
|---|---|---|---|
| **A** | > 90% | <= 10% | Fournisseur fiable. Relation privilegiee. |
| **B** | 70% - 90% | 10% - 20% | Fournisseur acceptable. Surveillance recommandee. Revue trimestrielle. |
| **C** | < 70% | > 20% | Fournisseur a risque. Plan d'amelioration obligatoire. Mise sous surveillance ou blocage temporaire. |

**Seuils d'alerte automatique :**
- Taux retard > 20% : Alerte `FOURNISSEUR_RETARD` niveau WARNING
- Taux retard > 30% : Alerte `FOURNISSEUR_RETARD` niveau CRITICAL
- Fournisseur bloque : `isBlocked: true`, aucune commande possible

### Annexe E : Statuts qualite production

| Statut qualite | Code ERP | Signification | Action requise |
|---|---|---|---|
| OK | `'OK'` | Production conforme aux specifications | Aucune. Lot PF disponible a la vente. |
| Defaut mineur | `'DEFAUT_MINEUR'` | Anomalie mineure sans impact sanitaire | Documentation obligatoire. Suivi des tendances. Lot PF disponible. |
| Defaut majeur | `'DEFAUT_MAJEUR'` | Anomalie significative impactant la qualite | Blocage lot PF. Investigation obligatoire. Deblocage apres validation qualite. |

### Annexe F : Codes de blocage lot

| Code blockedReason | Declencheur | Action pour deblocage |
|---|---|---|
| `DLC_EXPIRED_AUTO` | Systeme automatique a l'expiration de la DLC | Aucun deblocage possible. Declaration de perte obligatoire. |
| `QUALITY` | Decision du Responsable Qualite apres controle | Investigation documentee + validation ADMIN + notes justificatives. |
| `MANUAL` | Decision manuelle (divers motifs) | Justification ecrite + validation ADMIN. |

### Annexe G : Architecture audit trail

L'`AuditLog` de Manchengo Smart ERP est concu pour etre non-falsifiable :

- **Append-only :** Aucune modification, aucune suppression possible. Pas de champ `updatedAt` ni de soft delete.
- **Hash chaining :** Chaque entree contient un `hash` (SHA256 du payload + `previousHash`). Toute modification d'une entree invalide la chaine.
- **Champs captures :**
  - WHO : `actorId`, `actorRole`, `actorEmail`
  - WHAT : `action` (enum de 30+ types), `severity` (INFO/WARNING/CRITICAL/SECURITY)
  - ON WHAT : `entityType`, `entityId`
  - WHEN : `timestamp`
  - CONTEXT : `requestId` (correlation), `ipAddress`, `userAgent`
  - STATE : `beforeState`, `afterState` (JSON snapshots)
  - METADATA : donnees contextuelles additionnelles

### Annexe H : Contacts et references reglementaires

| Organisme | Role | Reference |
|---|---|---|
| Direction de la qualite et de la conformite (DQC) | Autorite nationale qualite alimentaire | Ministere du Commerce, Algerie |
| Centre Algerien du Controle de la Qualite et de l'Emballage (CACQE) | Laboratoire de reference | www.cacqe.org |
| Institut National de la Normalisation (IANOR) | Normes algeriennes | www.ianor.dz |
| Codex Alimentarius | Normes internationales alimentaires | www.fao.org/fao-who-codexalimentarius |
| ISO 22000 | Systeme de management de la securite alimentaire | Norme internationale |
| ISO 9001 | Systeme de management de la qualite | Norme internationale |
| Reglement sanitaire algerien | Decret executif n. 91-53 | Conditions d'hygiene lors du processus de mise a la consommation |
| HACCP (Codex Alimentarius) | 7 principes de maitrise sanitaire | CAC/RCP 1-1969, Rev. 4-2003 |

---

> **Document genere pour Manchengo Smart ERP v2.0**
> Derniere mise a jour : Fevrier 2026
> Auteur : Equipe Qualite & Conformite
> Validation : Direction Technique
> Prochaine revue : Mai 2026

# MANCHENGO SMART ERP -- MANUEL UTILISATEUR
# ROLE : DIRECTEUR / ADMINISTRATEUR (ADMIN)

**Version :** 3.0.0
**Date d'emission :** 24 fevrier 2026
**Classification :** CONFIDENTIEL -- Usage interne uniquement
**Destinataires :** Directeur General, Directeur Administratif et Financier, Directeur des Operations
**Redige par :** Cellule SI & Gouvernance -- Manchengo Smart ERP
**Plateforme :** Backend NestJS (Railway) + Frontend Next.js 14 (Vercel) + Mobile Flutter + Desktop Tauri 2.x

---

## TABLE DES MATIERES

1. [Fiche d'identite du role](#1-fiche-didentite-du-role)
2. [Workflow complet (Step-by-Step)](#2-workflow-complet-step-by-step)
3. [Scenarios reels](#3-scenarios-reels)
4. [Erreurs humaines frequentes](#4-erreurs-humaines-frequentes)
5. [Risques metier critiques](#5-risques-metier-critiques)
6. [Checklists quotidienne / hebdomadaire / mensuelle](#6-checklists-quotidienne--hebdomadaire--mensuelle)
7. [Scripts de formation video (5 modules)](#7-scripts-de-formation-video-5-modules)
8. [Matrice RACI](#8-matrice-raci)
9. [Niveaux de maturite](#9-niveaux-de-maturite)
10. [Recommandations d'optimisation](#10-recommandations-doptimisation)
11. [Glossaire metier](#11-glossaire-metier)
12. [Annexes](#12-annexes)

---

# 1. FICHE D'IDENTITE DU ROLE

## 1.1 Titre officiel

**Titre :** Directeur / Administrateur Systeme ERP
**Code role systeme :** `ADMIN`
**Code utilisateur attribue :** `USR-001` (premier utilisateur provisionne au deploiement)

## 1.2 Rattachement hierarchique

Le role ADMIN est le niveau hierarchique le plus eleve dans Manchengo Smart ERP. Il n'a aucun superieur dans le systeme. Le titulaire de ce role est typiquement :

- Le **Directeur General** (Gerant) de l'entreprise agroalimentaire
- Le **Directeur Administratif et Financier (DAF)** designe par la direction
- Le **Responsable SI** habilite par delegation ecrite du gerant

En cas de pluralite d'administrateurs, un seul est designe comme **administrateur principal** (premier USR-001). Les autres administrateurs recoivent le meme role ADMIN mais avec des codes utilisateurs sequentiels (USR-002, USR-003, etc.).

## 1.3 Niveau d'accreditation systeme

| Critere | Valeur |
|---------|--------|
| Niveau d'accreditation | **MAXIMUM** -- Niveau 4/4 |
| Perimetre fonctionnel | **TOUS les modules sans exception** |
| Perimetre de donnees | **TOUTES les donnees sans restriction** |
| Droits d'ecriture | **CRUD complet** sur toutes les entites |
| Droits de suppression | **OUI** -- Suppression logique et physique |
| Droits d'export | **OUI** -- Tous formats (PDF, Excel, CSV, Sage, PC Compta) |
| Droits de validation | **OUI** -- Validation inventaires, ajustements, annulations BC |
| Droits de securite | **OUI** -- Bloquer/debloquer utilisateurs, revoquer appareils |
| Acces logs audit | **OUI** -- Lecture complete du journal d'audit append-only |

## 1.4 Modules accessibles (TOUS)

Le role ADMIN a acces a **l'integralite** des modules du systeme :

| # | Module | Endpoint racine | Description |
|---|--------|----------------|-------------|
| 1 | **Administration** | `/api/admin/*` | CRUD produits MP/PF, clients, fournisseurs, utilisateurs, factures, ajustements stock, appareils, logs securite |
| 2 | **Authentification** | `/api/auth/*` | Connexion, deconnexion, creation utilisateurs, reset mot de passe, changement mot de passe, token CSRF, rafraichissement token |
| 3 | **Dashboard** | `/api/dashboard/*` | KPIs (CA, commandes, alertes stock), graphiques ventes, graphiques production, statut synchronisation, dashboard production |
| 4 | **Stock** | `/api/stock/*` | Vue d'ensemble MP/PF, mouvements, receptions, ajustements, declarations de pertes |
| 5 | **Production** | `/api/production/*` | CRUD ordres de production, demarrer/completer/annuler, KPIs, risques supply chain, calendrier, analytics, planification hebdomadaire, PDF |
| 6 | **Approvisionnement** | `/api/appro/*` | Dashboard APPRO, stock MP, MP critiques, suggestions, performance fournisseurs, alertes (accuser/reporter/scanner), bons de commande (creer/envoyer/confirmer/receptionner/annuler/verrouiller) |
| 7 | **Recettes** | `/api/recipes/*` | CRUD recettes, gestion items, calcul besoins, verification stock |
| 8 | **Comptabilite** | `/api/accounting/*` | Ecritures journal (ventes/achats/production), export PC Compta, export Sage, declaration TVA G50 |
| 9 | **Rapports** | `/api/reports/*` | Valorisation stock, mouvements stock, production, approvisionnement, fournisseurs, ventes + export Excel/PDF |
| 10 | **Inventaire** | `/api/inventory/*` | Declarer, valider, rejeter, inventaires en attente, historique par produit |
| 11 | **Livraisons** | `/api/deliveries/*` | Creer, valider QR, annuler, en attente, liste |
| 12 | **Factures** | `/api/invoices/*` | CRUD factures, changement statut, generation PDF fiscal |
| 13 | **Clients** | `/api/clients/*` | CRUD clients, historique facturation |
| 14 | **Fournisseurs** | `/api/suppliers/*` | CRUD fournisseurs, metriques performance |
| 15 | **Exports fiscaux** | `/api/exports/*` | Journal des ventes, journal TVA, journal timbre fiscal, etat des stocks, facture PDF, stocks MP, receptions MP, stocks PF, production PF |
| 16 | **Securite** | `/api/admin/security-logs`, `/api/security/audit/*` | Logs securite, piste d'audit, evenements securite, statistiques audit |
| 17 | **Synchronisation** | `/api/dashboard/sync/*` | Statut sync par appareil, evenements sync recents |
| 18 | **Monitoring** | `/api/monitoring/*` | Sante systeme, metriques, files d'attente |
| 19 | **Gouvernance** | `/api/governance/*` | Politiques et conformite |
| 20 | **Licences** | `/api/licensing/*` | Gestion des licences |

## 1.5 Responsabilites legales

### Conformite fiscale algerienne

Le titulaire du role ADMIN assume la **responsabilite legale** des operations suivantes :

1. **Declaration G50 (TVA)** -- Le systeme calcule automatiquement la TVA a 19% sur les factures. L'ADMIN est responsable de l'exactitude des donnees exportees via `GET /api/accounting/vat/declaration` et de leur soumission aux autorites fiscales dans les delais legaux.

2. **Timbre fiscal** -- Application du timbre fiscal de 50 DA sur les paiements en especes. Le systeme applique cette regle automatiquement ; l'ADMIN verifie la coherence.

3. **Registre de Commerce (RC)** -- Validation des numeros RC des clients et fournisseurs enregistres dans le systeme. Les champs `rc`, `nif`, `ai`, `nis` des entites `Client` et `Supplier` doivent etre renseignes conformement a la legislation algerienne.

4. **Tracabilite alimentaire** -- En tant qu'ERP d'une entreprise agroalimentaire (fromagerie), l'ADMIN est garant de la tracabilite lot par lot (FIFO, DLC, blocage qualite). Les modeles `LotMp` et `LotPf` avec leurs statuts `AVAILABLE`, `BLOCKED`, `CONSUMED` assurent cette tracabilite.

5. **Piste d'audit** -- Le modele `AuditLog` implemente une chaine de hash append-only (WHO/WHAT/ON WHAT/WHEN) non modifiable. L'ADMIN ne peut ni supprimer ni modifier les entrees d'audit. Cette piste est consultable mais **immuable**.

### Protection des donnees

Bien que l'Algerie ne dispose pas d'un equivalent strict du RGPD europeen, le systeme applique des principes de protection des donnees :

- Hachage des mots de passe (bcrypt)
- Tokens JWT avec expiration
- Cookies httpOnly securises
- Protection CSRF
- Rate limiting (5 tentatives de connexion par minute)
- Journalisation des acces et des modifications

---

# 2. WORKFLOW COMPLET (STEP-BY-STEP)

## 2.1 Gestion des utilisateurs

### Creer un nouvel utilisateur

| Etape | Action | Endpoint API | Resultat attendu |
|-------|--------|-------------|------------------|
| 1 | Se connecter en tant qu'ADMIN | `POST /api/auth/login` | Token JWT + cookies httpOnly |
| 2 | Preparer les donnees utilisateur (email, prenom, nom, role) | -- | DTO conforme |
| 3 | Creer l'utilisateur | `POST /api/admin/users` | Retour : objet User avec code auto-genere (USR-NNN) |
| 4 | Verifier la creation | `GET /api/admin/users?role=<ROLE>` | L'utilisateur apparait dans la liste |
| 5 | Communiquer les identifiants au nouvel utilisateur | -- | Email ou remise en main propre du mot de passe temporaire |

**Roles disponibles :** `ADMIN`, `APPRO`, `PRODUCTION`, `COMMERCIAL`

**Contraintes :**
- L'email doit etre unique dans le systeme
- Le code utilisateur est genere automatiquement (format `USR-NNN`)
- Le champ `mustChangePassword` est positionne a `true` pour forcer le changement au premier login

### Modifier un utilisateur

| Etape | Action | Endpoint API |
|-------|--------|-------------|
| 1 | Recuperer la liste des utilisateurs | `GET /api/admin/users?page=1&limit=25` |
| 2 | Identifier l'utilisateur cible par son ID | -- |
| 3 | Modifier les champs souhaites | `PUT /api/admin/users/:id` |
| 4 | Verifier la modification | `GET /api/admin/users` |

### Desactiver / Reactiver un utilisateur

| Etape | Action | Endpoint API | Resultat |
|-------|--------|-------------|----------|
| 1 | Identifier l'utilisateur | `GET /api/admin/users` | Liste paginee |
| 2 | Basculer le statut | `POST /api/admin/users/:id/toggle-status` | `isActive` bascule true/false |
| 3 | OU bloquer via la securite | `POST /api/admin/users/:id/block` | Utilisateur bloque, tokens invalides |
| 4 | Debloquer si necessaire | `POST /api/admin/users/:id/unblock` | `isActive` repasse a true |

**Impact du blocage :** Tous les `RefreshToken` de l'utilisateur sont supprimes immediatement. La prochaine requete de l'utilisateur echouera avec un HTTP 401.

### Reinitialiser un mot de passe

| Etape | Action | Endpoint API |
|-------|--------|-------------|
| 1 | Identifier l'utilisateur cible | `GET /api/admin/users` |
| 2 | Definir le nouveau mot de passe | `POST /api/admin/users/:id/reset-password` avec `{ newPassword: "..." }` |
| 3 | Le champ `mustChangePassword` est automatiquement positionne a `true` | -- |
| 4 | Communiquer le nouveau mot de passe au collaborateur | -- |

## 2.2 Gestion des referentiels

### Produits Matieres Premieres (MP)

**Creer un produit MP :**

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Definir code, nom, unite, categorie | -- |
| 2 | Creer le produit | `POST /api/admin/products/mp` |
| 3 | Parametrer les seuils APPRO | `PATCH /api/appro/stock-mp/:id` |

**Champs du DTO `CreateProductMpDto` :**
- `code` : Code unique (format MP-NNN)
- `name` : Nom de la matiere premiere
- `unit` : Unite de mesure (L, kg, unite)
- `category` : `RAW_MATERIAL`, `PACKAGING`, `ADDITIVE`, `CONSUMABLE`
- `minStock` : Stock minimum
- `criticite` : `FAIBLE`, `MOYENNE`, `HAUTE`, `BLOQUANTE`
- `seuilSecurite` : Stock de securite minimum
- `seuilCommande` : Seuil declenchant commande
- `leadTimeFournisseur` : Delai fournisseur en jours

**Modifier un produit MP :** `PUT /api/admin/products/mp/:id`

**Supprimer un produit MP :** `DELETE /api/admin/products/mp/:id`

### Produits Finis (PF)

**Creer un produit PF :**

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Definir code, nom, unite, prix HT | -- |
| 2 | Creer le produit | `POST /api/admin/products/pf` |
| 3 | Associer une marque et une famille | Via le DTO |

**Champs du DTO `CreateProductPfDto` :**
- `code` : Code unique (format PF-NNN)
- `name` : Nom complet (ex: "Gouda MONTESA 400g")
- `unit` : Unite (unite, kg)
- `priceHt` : Prix HT en **centimes** (ex: 45000 = 450,00 DA)
- `packagingType` : `SAC_THERMO`, `SEAU_IML`, `BARQUETTE_IML`, `PORTION`, `CARTON`
- `storageType` : `REFRIGERE` (2-8 C), `FRAIS` (0-4 C), `SEC`, `CONGELE` (-18 C)
- `shelfLifeDays` : Duree de vie en jours (DLC)
- `brandId` : ID de la marque (MONTESA, QUESA NOVA)
- `familyId` : ID de la famille produit

**Modifier :** `PUT /api/admin/products/pf/:id`

**Supprimer :** `DELETE /api/admin/products/pf/:id`

### Clients

**Creer un client :**

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Collecter les informations fiscales | -- |
| 2 | Creer le client | `POST /api/admin/clients` |
| 3 | Verifier dans la liste | `GET /api/admin/clients` |

**Champs obligatoires :**
- `code` : Format CLI-NNN
- `name` : Raison sociale
- `type` : `DISTRIBUTEUR`, `GROSSISTE`, `SUPERETTE`, `FAST_FOOD`
- `nif` : Numero d'Identification Fiscale (15 chiffres)
- `rc` : Registre de Commerce
- `ai` : Article d'Imposition

**Historique client :** `GET /api/admin/clients/:id/history?year=2026&month=2&page=1&limit=20`

### Fournisseurs

**Creer un fournisseur :**

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Collecter RC, NIF, AI, NIS | -- |
| 2 | Creer le fournisseur | `POST /api/admin/suppliers` |
| 3 | Parametrer les metriques | Via le systeme de performance automatique |

**Champs du fournisseur :**
- `code` : Format FOUR-NNN
- `rc` : Registre de Commerce (alphanum, min 1 lettre)
- `nif` : NIF (15 chiffres exactement)
- `ai` : Article d'Imposition (alphanum 3-20 caracteres)
- `nis` : NIS (optionnel, 15 chiffres si present)
- `phone` : Telephone algerien (05/06/07 + 8 chiffres)
- `email` : Email (utilise pour l'envoi automatique des BC)
- `grade` : `A` (Fiable >90%), `B` (Acceptable 70-90%), `C` (A risque <70%)

## 2.3 Supervision production + stock

### Consulter le dashboard production

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Afficher les KPIs production | `GET /api/production/dashboard/kpis` |
| 2 | Verifier les risques supply chain | `GET /api/production/dashboard/supply-risks` |
| 3 | Identifier les productions a risque | `GET /api/production/dashboard/at-risk` |
| 4 | Consulter les alertes | `GET /api/production/dashboard/alerts` |
| 5 | Visualiser le calendrier | `GET /api/production/dashboard/calendar?days=7` |
| 6 | Analyser les analytics | `GET /api/production/dashboard/analytics?period=month` |

### Creer et piloter un ordre de production

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Verifier la disponibilite MP | `GET /api/recipes/:id/check-stock?batchCount=5` |
| 2 | Creer l'ordre de production | `POST /api/production` avec `{ recipeId, batchCount, scheduledDate }` |
| 3 | Demarrer la production (consommation FIFO des MP) | `POST /api/production/:id/start` |
| 4 | Completer la production (creation lot PF) | `POST /api/production/:id/complete` avec `{ actualQuantity, qualityNotes }` |
| 5 | OU annuler si necessaire | `POST /api/production/:id/cancel` avec `{ reason }` |
| 6 | Telecharger le PDF de l'ordre | `GET /api/production/:id/pdf` |

**Workflow des statuts de production :**
```
PENDING --> IN_PROGRESS --> COMPLETED
                       \--> CANCELLED
```

**Reference de l'ordre :** Format `OP-YYMMDD-NNN` (ex: OP-260224-001)

### Consulter l'etat du stock

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Stock MP global | `GET /api/admin/stock/mp` |
| 2 | Stock PF global | `GET /api/admin/stock/pf` |
| 3 | Mouvements de stock (audit) | `GET /api/admin/stock/movements?page=1&limit=50&type=MP` |
| 4 | MP critiques | `GET /api/appro/stock-mp/critical` |
| 5 | Valorisation du stock | `GET /api/reports/stock/valorization` |

## 2.4 Facturation et comptabilite

### Creer une facture

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Selectionner le client | `GET /api/admin/clients` |
| 2 | Creer la facture | `POST /api/admin/invoices` avec les lignes de facture |
| 3 | Verifier la facture | `GET /api/admin/invoices/:id` |
| 4 | Modifier si necessaire (DRAFT uniquement) | `PUT /api/admin/invoices/:id` |
| 5 | Passer en PAID | `PUT /api/admin/invoices/:id/status` avec `{ status: "PAID" }` |
| 6 | OU annuler | `PUT /api/admin/invoices/:id/status` avec `{ status: "CANCELLED" }` |
| 7 | Generer le PDF fiscal | `GET /api/admin/invoices/:id/pdf` |

**Reference facture :** Format `F-YYMMDD-NNN` (ex: F-260224-001)

**TVA :** 19% appliquee automatiquement

**Timbre fiscal :** 50 DA ajoute automatiquement pour les paiements en especes

**Workflow des statuts facture :**
```
DRAFT --> PAID
      \--> CANCELLED
```

### Operations comptables

| Operation | Endpoint |
|-----------|---------|
| Journal des ventes | `GET /api/accounting/journal/sales?startDate=2026-01-01&endDate=2026-01-31` |
| Journal des achats | `GET /api/accounting/journal/purchases?startDate=...&endDate=...` |
| Journal de production | `GET /api/accounting/journal/production?startDate=...&endDate=...` |
| Export PC Compta (CSV) | `GET /api/accounting/export/pccompta?startDate=...&endDate=...&journalType=ALL` |
| Export Sage (CSV) | `GET /api/accounting/export/sage?startDate=...&endDate=...&journalType=ALL` |
| Declaration TVA G50 | `GET /api/accounting/vat/declaration?startDate=...&endDate=...` |

### Exports fiscaux detailles

| Export | Endpoint | Formats |
|--------|---------|---------|
| Journal des ventes | `GET /api/exports/sales` | PDF, XLSX |
| Journal TVA | `GET /api/exports/vat` | PDF, XLSX |
| Journal timbre fiscal | `GET /api/exports/stamp` | PDF, XLSX |
| Etat des stocks | `GET /api/exports/stock` | PDF, XLSX |
| Facture individuelle PDF | `GET /api/exports/invoice/:id/pdf` | PDF |
| Stocks MP | `GET /api/exports/mp/stocks` | PDF, XLSX |
| Receptions MP | `GET /api/exports/mp/receptions` | PDF, XLSX |
| Stocks PF | `GET /api/exports/pf/stocks` | PDF, XLSX |
| Production PF | `GET /api/exports/pf/production` | PDF, XLSX |

## 2.5 Inventaire

### Processus d'inventaire complet

| Etape | Action | Endpoint | Role executant |
|-------|--------|---------|----------------|
| 1 | Effectuer le comptage physique | -- | Terrain |
| 2 | Declarer l'inventaire dans le systeme | `POST /api/inventory/declare` | ADMIN, APPRO ou PRODUCTION |
| 3 | Le systeme calcule l'ecart et attribue un niveau de risque | -- | Automatique |
| 4 | **Si ecart faible** : auto-approbation | -- | Automatique |
| 5 | **Si ecart moyen** : en attente de validation ADMIN | `POST /api/inventory/:id/validate` | ADMIN |
| 6 | **Si ecart critique** : double validation requise | Deux ADMIN distincts doivent valider | ADMIN x2 |
| 7 | OU rejeter la declaration | `POST /api/inventory/:id/reject` | ADMIN |
| 8 | Consulter les inventaires en attente | `GET /api/inventory/pending` | ADMIN |
| 9 | Consulter l'historique par produit | `GET /api/inventory/history/:productType/:productId` | ADMIN |

**Niveaux de risque :** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**Contrainte de separation des taches :** Le compteur ne peut PAS etre le validateur (enforced cote service).

**DTO de declaration :**
```
{
  productType: "MP" | "PF",
  productId: <number>,
  declaredQuantity: <number>,
  notes: "Commentaire optionnel",
  evidencePhotos: ["url1", "url2"]
}
```

## 2.6 Securite

### Consulter les logs de securite

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Logs securite simples | `GET /api/admin/security-logs?action=LOGIN_FAILED&page=1&limit=25` |
| 2 | Piste d'audit complete | `GET /api/security/audit?severity=CRITICAL&from=2026-02-01&to=2026-02-24` |
| 3 | Historique d'une entite | `GET /api/security/audit/entity/:entityType/:entityId` |
| 4 | Correlation de requete | `GET /api/security/audit/request/:requestId` |
| 5 | Evenements securite recents | `GET /api/security/audit/security-events?hours=24&limit=100` |
| 6 | Statistiques audit | `GET /api/security/audit/stats` |

### Gestion des appareils

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Lister tous les appareils | `GET /api/admin/devices` |
| 2 | Detail d'un appareil | `GET /api/admin/devices/:id` |
| 3 | Revoquer un appareil | `POST /api/admin/devices/:id/revoke` avec `{ reason: "..." }` |
| 4 | Reactiver un appareil | `POST /api/admin/devices/:id/reactivate` |

**Impact de la revocation :** L'appareil est refuse a la prochaine tentative de connexion ou de synchronisation.

### Bloquer un utilisateur suspect

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Identifier l'utilisateur | `GET /api/admin/users` |
| 2 | Bloquer | `POST /api/admin/users/:id/block` avec `{ reason: "Tentatives de connexion suspectes" }` |
| 3 | Tous les refresh tokens sont invalides | Automatique |
| 4 | Analyser les logs | `GET /api/admin/security-logs?action=LOGIN_FAILED` |
| 5 | Debloquer apres investigation | `POST /api/admin/users/:id/unblock` |

## 2.7 Ajustements stock manuels

| Etape | Action | Endpoint |
|-------|--------|---------|
| 1 | Identifier le produit et la quantite a ajuster | -- |
| 2 | Effectuer l'ajustement | `POST /api/admin/stock/adjust` |
| 3 | Verifier le mouvement cree | `GET /api/admin/stock/movements` |

**DTO StockAdjustmentDto :**
```
{
  productType: "MP" | "PF",
  productId: <number>,
  quantity: <number>,   // positif = entree, negatif = sortie
  reason: "Motif de l'ajustement"
}
```

**Restriction :** Seul le role ADMIN peut effectuer des ajustements manuels. Chaque ajustement genere un `StockMovement` et une entree dans le journal d'audit.

---

# 3. SCENARIOS REELS

## Scenario 1 : Onboarding d'un nouvel employe

**Contexte :** Un nouveau responsable approvisionnement rejoint l'equipe. Il faut lui creer un acces au systeme avec le role APPRO.

**Deroulement step-by-step :**

1. **L'ADMIN se connecte** au systeme via `POST /api/auth/login` avec ses identifiants.

2. **Preparation des informations :**
   - Prenom : Mohamed
   - Nom : Benali
   - Email : m.benali@manchengo.dz
   - Role : APPRO
   - Mot de passe temporaire : genere par l'ADMIN (min 8 caracteres, 1 majuscule, 1 chiffre)

3. **Creation du compte :** `POST /api/admin/users`
   ```
   {
     "email": "m.benali@manchengo.dz",
     "firstName": "Mohamed",
     "lastName": "Benali",
     "role": "APPRO",
     "password": "TempPass2026!"
   }
   ```
   Le systeme retourne le code `USR-005` (auto-genere).

4. **Verification :** `GET /api/admin/users?role=APPRO` -- le nouvel utilisateur apparait avec `isActive: true` et `mustChangePassword: true`.

5. **Transmission des identifiants :** L'ADMIN remet en main propre (ou via canal securise) :
   - URL de l'application
   - Email de connexion
   - Mot de passe temporaire
   - Instruction de changer le mot de passe des la premiere connexion

6. **Premiere connexion du nouvel employe :** L'employe se connecte via `POST /api/auth/login`. Le systeme detecte `mustChangePassword: true` et redirige vers `POST /api/auth/change-password`.

7. **Verification par l'ADMIN :** L'ADMIN consulte les logs de securite pour confirmer la premiere connexion reussie : `GET /api/admin/security-logs?action=LOGIN_SUCCESS`.

## Scenario 2 : Rupture critique MP detectee

**Contexte :** Le systeme detecte que le lait en poudre (MP-003, criticite BLOQUANTE) est en rupture imminente. La production de Gouda est menacee.

**Deroulement step-by-step :**

1. **Detection automatique :** Le scan periodique des alertes (`POST /api/appro/alerts/scan`) detecte que le stock de MP-003 est sous le seuil de securite. Une alerte de niveau `CRITICAL` est creee.

2. **L'ADMIN consulte le dashboard :** `GET /api/dashboard/kpis` -- l'indicateur d'alertes stock est rouge.

3. **Analyse de la situation :** `GET /api/appro/stock-mp/critical` retourne la liste des MP critiques. MP-003 apparait avec `state: RUPTURE` et `criticite: BLOQUANTE`.

4. **Verification des productions impactees :** `GET /api/production/dashboard/at-risk` -- les ordres de production de Gouda apparaissent avec `riskLevel: CRITICAL`.

5. **Accuse reception de l'alerte :** `POST /api/appro/alerts/:id/acknowledge` -- obligatoire pour les alertes CRITICAL.

6. **Creation d'un BC urgent :**
   ```
   POST /api/appro/purchase-orders/create-direct
   {
     "supplierId": 3,
     "lines": [{ "productMpId": 3, "quantity": 500, "unitPrice": 28000 }],
     "expectedDelivery": "2026-02-26",
     "notes": "BC URGENT - Rupture imminente MP-003"
   }
   ```
   Le systeme genere la reference `BC-2026-00042`.

7. **Envoi au fournisseur :** `POST /api/appro/purchase-orders/:id/send` avec `{ markAsSentOnly: false }` pour envoi email automatique.

8. **Confirmation du fournisseur :** A la confirmation telephonique, l'ADMIN enregistre : `POST /api/appro/purchase-orders/:id/confirm`.

9. **Reception :** A l'arrivee de la marchandise :
   ```
   POST /api/appro/purchase-orders/:id/receive
   {
     "lines": [{ "productMpId": 3, "receivedQuantity": 500, "lotNumber": "L260226-001", "expiryDate": "2026-08-26" }]
   }
   ```
   Le systeme cree automatiquement le lot MP, les mouvements de stock (IN), et met a jour le stock.

10. **Relance de la production :** `POST /api/production/:id/start` -- la production de Gouda peut reprendre.

## Scenario 3 : Cloture comptable mensuelle

**Contexte :** Fin janvier 2026. L'ADMIN doit effectuer la cloture comptable mensuelle et preparer la declaration G50.

**Deroulement step-by-step :**

1. **Verification des factures en attente :** `GET /api/admin/invoices?status=DRAFT` -- s'assurer que toutes les factures du mois sont finalisees (PAID ou CANCELLED).

2. **Export du journal des ventes :**
   ```
   GET /api/accounting/journal/sales?startDate=2026-01-01&endDate=2026-01-31
   ```

3. **Export du journal des achats :**
   ```
   GET /api/accounting/journal/purchases?startDate=2026-01-01&endDate=2026-01-31
   ```

4. **Export du journal de production :**
   ```
   GET /api/accounting/journal/production?startDate=2026-01-01&endDate=2026-01-31
   ```

5. **Preparation de la declaration G50 :**
   ```
   GET /api/accounting/vat/declaration?startDate=2026-01-01&endDate=2026-01-31
   ```
   Le systeme retourne le total HT, la TVA collectee (19%), et le montant du timbre fiscal.

6. **Export format comptable :**
   - Pour PC Compta : `GET /api/accounting/export/pccompta?startDate=2026-01-01&endDate=2026-01-31&journalType=ALL`
   - Pour Sage : `GET /api/accounting/export/sage?startDate=2026-01-01&endDate=2026-01-31&journalType=ALL`

7. **Exports fiscaux complementaires :**
   - Journal TVA en PDF : `GET /api/exports/vat?startDate=2026-01-01&endDate=2026-01-31&format=PDF`
   - Journal timbre fiscal : `GET /api/exports/stamp?startDate=2026-01-01&endDate=2026-01-31&format=PDF`
   - Journal des ventes en Excel : `GET /api/exports/sales?startDate=2026-01-01&endDate=2026-01-31&format=XLSX`

8. **Rapport de valorisation du stock :**
   ```
   GET /api/reports/stock/valorization
   ```

9. **Archivage :** L'ADMIN telechargement tous les fichiers generes et les archive conformement aux obligations legales (10 ans de conservation des documents comptables en Algerie).

## Scenario 4 : Incident securite (tentatives de connexion echouees)

**Contexte :** Le systeme detecte 15 tentatives de connexion echouees en 5 minutes sur le compte de l'utilisateur USR-003 (Commercial).

**Deroulement step-by-step :**

1. **Detection :** Le rate limiter bloque automatiquement apres 5 tentatives par minute (`@Throttle({ default: { limit: 5, ttl: 60000 } })`). Le compteur `failedLoginAttempts` de l'utilisateur s'incremente.

2. **L'ADMIN est alerte :** Consultation des logs de securite :
   ```
   GET /api/admin/security-logs?action=LOGIN_FAILED&page=1&limit=50
   ```
   15 entrees pour USR-003 en 5 minutes.

3. **Analyse des evenements securite :**
   ```
   GET /api/security/audit/security-events?hours=1&limit=100
   ```
   Les logs montrent des tentatives depuis une adresse IP inconnue.

4. **Blocage immediat de l'utilisateur :**
   ```
   POST /api/admin/users/USR-003-UUID/block
   { "reason": "15 tentatives de connexion echouees en 5 min - IP suspecte" }
   ```
   Tous les refresh tokens de l'utilisateur sont supprimes. Les sessions actives sont invalidees.

5. **Revocation des appareils suspects :**
   ```
   GET /api/admin/devices?userId=USR-003-UUID
   ```
   Puis pour chaque appareil suspect :
   ```
   POST /api/admin/devices/:deviceId/revoke
   { "reason": "Incident securite - revocation preventive" }
   ```

6. **Investigation approfondie :**
   ```
   GET /api/security/audit?actorId=USR-003-UUID&from=2026-02-24T00:00:00Z&to=2026-02-24T23:59:59Z
   ```

7. **Resolution :** Apres verification avec le collaborateur concerne :
   - Si compromis confirme : reinitialiser le mot de passe via `POST /api/admin/users/:id/reset-password`
   - Debloquer l'utilisateur : `POST /api/admin/users/USR-003-UUID/unblock`
   - Reactiver les appareils legitimes : `POST /api/admin/devices/:deviceId/reactivate`

8. **Documentation :** L'ADMIN note l'incident dans un rapport interne et s'assure que les logs d'audit (immuables) preservent la piste de verification.

## Scenario 5 : Inventaire annuel

**Contexte :** Inventaire physique complet de fin d'exercice. Toutes les MP et tous les PF doivent etre comptes et valides.

**Deroulement step-by-step :**

1. **Preparation :** L'ADMIN extrait la liste de tous les produits :
   - `GET /api/admin/stock/mp` -- liste toutes les MP avec stock theorique
   - `GET /api/admin/stock/pf` -- liste tous les PF avec stock theorique

2. **Organisation des equipes :** Attribution des zones de comptage aux equipes (APPRO pour les MP, PRODUCTION pour les PF).

3. **Declarations d'inventaire :** Chaque equipe declare ses comptages :
   ```
   POST /api/inventory/declare
   {
     "productType": "MP",
     "productId": 1,
     "declaredQuantity": 247,
     "notes": "Zone A - Frigo 1",
     "evidencePhotos": ["photo_mp001_zone_a.jpg"]
   }
   ```

4. **Traitement automatique :** Le systeme calcule automatiquement :
   - L'ecart entre stock theorique et stock physique
   - Le pourcentage d'ecart
   - Le niveau de risque (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
   - Auto-approbation si ecart faible (LOW)

5. **Validation par l'ADMIN :** Consultation des inventaires en attente :
   ```
   GET /api/inventory/pending
   ```

6. **Pour chaque declaration a ecart moyen (MEDIUM/HIGH) :**
   ```
   POST /api/inventory/:id/validate
   { "approvalReason": "Ecart justifie par pertes de production du 15/02" }
   ```

7. **Pour les ecarts critiques (CRITICAL) :** Double validation requise.
   - Premier ADMIN valide : `POST /api/inventory/:id/validate`
   - Message retourne : "Premiere validation effectuee, en attente du 2eme validateur"
   - Deuxieme ADMIN distinct valide a son tour

8. **Rejets :** Si un comptage semble errone :
   ```
   POST /api/inventory/:id/reject
   { "rejectionReason": "Ecart trop important - recompter zone B" }
   ```
   L'equipe doit refaire un comptage et soumettre une nouvelle declaration.

9. **Ajustements finaux :** Une fois toutes les declarations validees, les stocks sont automatiquement ajustes. Les mouvements de stock sont crees avec tracabilite complete.

10. **Rapport d'inventaire :** Export du rapport de mouvements :
    ```
    GET /api/reports/stock/movements?startDate=2026-02-24&endDate=2026-02-24
    GET /api/reports/export/excel?type=stock-movements&startDate=2026-02-24&endDate=2026-02-24
    ```

---

# 4. ERREURS HUMAINES FREQUENTES

## Top 10 des erreurs identifiees

| # | Erreur | Impact | Detection | Correction |
|---|--------|--------|-----------|------------|
| 1 | **Oublier de finaliser les factures DRAFT avant la cloture mensuelle** | La declaration G50 sera incomplete. Les exports comptables ne refleteront pas toute l'activite du mois. | Verifier `GET /api/admin/invoices?status=DRAFT` en fin de mois. Le systeme n'empeche pas l'export meme si des DRAFT existent. | Passer en revue chaque facture DRAFT et la finaliser (PAID) ou l'annuler (CANCELLED) avant de lancer les exports comptables. |
| 2 | **Creer un produit PF avec le prix en DA au lieu de centimes** | Prix affiche 100x trop bas. Factures erronees. | Un Gouda a 450 DA au lieu de 45000 centimes generera des factures a 4,50 DA. Verifier le champ `priceHt` qui attend des **centimes**. | `PUT /api/admin/products/pf/:id` avec le prix corrige. Reverifier toutes les factures emises avec ce produit. |
| 3 | **Valider un inventaire critique seul (sans double validation)** | Non-conformite au processus de controle interne. Le systeme empeche cette erreur en imposant un second validateur distinct. | Le systeme retourne "Premiere validation effectuee, en attente du 2eme validateur" pour les ecarts critiques. | Attendre qu'un second administrateur effectue la deuxieme validation. |
| 4 | **Ne pas accuser reception des alertes CRITICAL** | Les alertes CRITICAL restent non traitees, provoquant potentiellement des ruptures de production. | `GET /api/appro/alerts/critical` retourne les alertes non accusees. | `POST /api/appro/alerts/:id/acknowledge` pour chaque alerte critique. |
| 5 | **Oublier de reinitialiser `mustChangePassword` apres un reset** | L'utilisateur peut se connecter avec le mot de passe temporaire sans etre force a le changer. | Le systeme positionne automatiquement `mustChangePassword: true` lors d'un reset. Verifier que l'utilisateur a bien change son mot de passe. | Ce champ est gere automatiquement. Si l'anomalie persiste, verifier le service `resetUserPassword` dans le backend. |
| 6 | **Annuler un BC qui a deja recu une reception partielle** | Le systeme empeche cette operation (HTTP 400). Le risque est de tenter sans verifier le statut du BC au prealable. | `GET /api/appro/purchase-orders/:id` -- verifier le statut. Un BC en `PARTIAL` ne peut plus etre annule. | Si des MP recues sont defectueuses, proceder par ajustement stock negatif (`POST /api/admin/stock/adjust`) plutot que par annulation du BC. |
| 7 | **Creer un fournisseur avec un NIF invalide (moins de 15 chiffres)** | Non-conformite fiscale. Les BC emis vers ce fournisseur seront invalides pour le fisc. | La validation DTO devrait rejeter le formulaire. Verifier manuellement les 15 chiffres du NIF. | `PUT /api/admin/suppliers/:id` avec le NIF corrige. |
| 8 | **Ne pas verifier le stock MP avant de demarrer une production** | La production demarre mais les MP sont insuffisantes. Le systeme consomme les lots en FIFO et peut echouer en cours de route. | Toujours appeler `GET /api/recipes/:id/check-stock?batchCount=N` avant `POST /api/production/:id/start`. | Si la production est bloquee, l'annuler (`POST /api/production/:id/cancel`) et creer un BC urgent pour les MP manquantes. |
| 9 | **Supprimer un produit MP reference dans des recettes actives** | Rupture des relations de donnees. Les recettes qui referencent ce produit deviendront invalides. | Le systeme devrait empecher la suppression si des references existent. Verifier les recettes avant suppression. | Desactiver le produit (`isActive: false`) plutot que le supprimer si des references existent. |
| 10 | **Ne pas exporter les logs de securite avant la rotation** | Perte potentielle d'informations pour les investigations futures. | Planifier un export mensuel des logs. La piste d'audit (`AuditLog`) est immuable mais les `SecurityLog` peuvent etre volumineux. | Mettre en place une procedure mensuelle d'archivage des logs via `GET /api/admin/security-logs` et `GET /api/security/audit`. |

---

# 5. RISQUES METIER CRITIQUES

## Matrice des risques (Probabilite x Impact)

| # | Risque | Probabilite | Impact | Score | Mitigation |
|---|--------|------------|--------|-------|-----------|
| R1 | **Rupture matiere premiere BLOQUANTE** | HAUTE (3/5) | CRITIQUE (5/5) | **15/25** | Configurer les seuils de securite (`seuilSecurite`) et les seuils de commande (`seuilCommande`) pour chaque MP BLOQUANTE. Activer les alertes automatiques via `POST /api/appro/alerts/scan`. Maintenir au moins 2 fournisseurs alternatifs par MP critique. |
| R2 | **Perte de donnees comptables** | FAIBLE (1/5) | CRITIQUE (5/5) | **5/25** | Backups automatiques PostgreSQL quotidiens. Exports mensuels systematiques (PC Compta + Sage). Piste d'audit immuable (hash chain). Infrastructure Railway avec redondance. |
| R3 | **Acces non autorise au systeme** | MOYENNE (2/5) | HAUTE (4/5) | **8/25** | Rate limiting sur les connexions (5/min). Tokens JWT avec expiration. Cookies httpOnly + CSRF. Blocage automatique apres tentatives echouees. Revocation d'appareils a distance. |
| R4 | **Erreur de facturation (prix, TVA)** | MOYENNE (2/5) | HAUTE (4/5) | **8/25** | Les prix sont en centimes pour eviter les erreurs d'arrondi. La TVA a 19% est calculee automatiquement. Le timbre fiscal de 50 DA est ajoute automatiquement. Double verification avant passage de DRAFT a PAID. |
| R5 | **DLC depassee non detectee** | MOYENNE (2/5) | CRITIQUE (5/5) | **10/25** | Le modele `LotMp` et `LotPf` tracent les DLC. Les lots expires sont automatiquement passes en statut `BLOCKED`. Le dashboard affiche les lots proches de l'expiration. |
| R6 | **Fournisseur defaillant** | HAUTE (3/5) | HAUTE (4/5) | **12/25** | Systeme de scoring automatique (`scorePerformance` de 0 a 100). Grades A/B/C. Alertes sur fournisseurs en retard. Possibilite de bloquer un fournisseur (`isBlocked`) ou de le mettre sous surveillance (`isUnderSurveillance`). |
| R7 | **Perte de synchronisation mobile** | MOYENNE (2/5) | MOYENNE (3/5) | **6/25** | Architecture offline-first avec `SyncEvent`. Detection de conflits. Dashboard sync (`GET /api/dashboard/sync/status`). Evenements avec hash d'integrite SHA256. |
| R8 | **Fraude interne (ajustement stock abusif)** | FAIBLE (1/5) | HAUTE (4/5) | **4/25** | Seul le role ADMIN peut effectuer des ajustements manuels. Chaque ajustement est trace dans le journal d'audit avec WHO/WHAT/WHEN. Double validation requise pour les ecarts critiques d'inventaire. Separation compteur/validateur. |
| R9 | **Non-conformite fiscale (G50)** | MOYENNE (2/5) | CRITIQUE (5/5) | **10/25** | Le systeme calcule automatiquement la TVA et le timbre fiscal. Export natif au format G50. Validation des champs fiscaux (RC, NIF, AI, NIS) a la creation des clients et fournisseurs. |
| R10 | **Surstock et immobilisation de tresorerie** | HAUTE (3/5) | MOYENNE (3/5) | **9/25** | Suggestions automatiques de commandes via `GET /api/appro/requisitions/suggested`. Metriques de consommation moyenne par jour (`consommationMoyJour`). Jours de couverture calcules (`joursCouverture`). |

### Echelle d'evaluation

- **Probabilite :** 1 (Tres faible) a 5 (Quasi-certaine)
- **Impact :** 1 (Negligeable) a 5 (Catastrophique)
- **Score :** Probabilite x Impact (1-25)
- **Zone rouge :** Score >= 12 -- Action corrective immediate requise
- **Zone orange :** Score 6-11 -- Plan de mitigation a suivre de pres
- **Zone verte :** Score 1-5 -- Risque acceptable, surveillance reguliere

---

# 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

## 6.1 Checklist QUOTIDIENNE (chaque matin, 15 minutes)

- [ ] **Consulter le dashboard KPIs** -- `GET /api/dashboard/kpis` -- Verifier CA du jour, nombre de commandes, alertes stock
- [ ] **Verifier les alertes critiques non accusees** -- `GET /api/appro/alerts/critical` -- OBLIGATION : accuser reception de toute alerte CRITICAL
- [ ] **Consulter les productions a risque** -- `GET /api/production/dashboard/at-risk` -- Identifier les productions menacees par les ruptures MP
- [ ] **Verifier les BC en retard** -- `GET /api/appro/purchase-orders/late` -- Relancer les fournisseurs si retard > 3 jours
- [ ] **Consulter les inventaires en attente** -- `GET /api/inventory/pending` -- Valider ou rejeter les declarations d'inventaire
- [ ] **Verifier les logs de securite** -- `GET /api/admin/security-logs?action=LOGIN_FAILED&limit=10` -- Identifier toute activite suspecte
- [ ] **Consulter le statut de synchronisation** -- `GET /api/dashboard/sync/status` -- S'assurer que tous les appareils sont synchronises
- [ ] **Verifier les factures DRAFT en attente** -- `GET /api/admin/invoices?status=DRAFT` -- Relancer les commerciaux si necessaire

## 6.2 Checklist HEBDOMADAIRE (chaque lundi, 45 minutes)

- [ ] **Revue des performances fournisseurs** -- `GET /api/appro/suppliers/performance` -- Identifier les fournisseurs en degradation (grade B vers C)
- [ ] **Analyse des graphiques de vente** -- `GET /api/dashboard/charts/sales?days=7` -- Comparer avec la semaine precedente
- [ ] **Analyse des graphiques de production** -- `GET /api/dashboard/charts/production?days=7` -- Identifier les ecarts de rendement
- [ ] **Revue du planning production** -- `GET /api/production/planning/week` -- Valider le planning de la semaine a venir
- [ ] **Verification des suggestions d'approvisionnement** -- `GET /api/appro/requisitions/suggested` -- Valider ou ajuster les BC suggeres
- [ ] **Rapport de mouvements de stock** -- `GET /api/reports/stock/movements?startDate=...&endDate=...` -- Identifier les anomalies
- [ ] **Revue des comptes utilisateurs** -- `GET /api/admin/users` -- Verifier les comptes inactifs ou suspects
- [ ] **Recalcul des metriques MP** -- `POST /api/appro/update-metrics` -- Forcer le recalcul des consommations moyennes et jours de couverture
- [ ] **Verification des BC verrouilles** -- Identifier les BC ayant un lock non libere (lock expire)
- [ ] **Sauvegarder les exports de la semaine** -- Exporter les rapports cles en Excel pour archivage

## 6.3 Checklist MENSUELLE (premier jour ouvrable, demi-journee)

- [ ] **Cloture des factures du mois precedent** -- Finaliser toutes les factures DRAFT (PAID ou CANCELLED)
- [ ] **Export journal des ventes** -- `GET /api/accounting/journal/sales?startDate=...&endDate=...`
- [ ] **Export journal des achats** -- `GET /api/accounting/journal/purchases?startDate=...&endDate=...`
- [ ] **Export journal de production** -- `GET /api/accounting/journal/production?startDate=...&endDate=...`
- [ ] **Preparation declaration G50** -- `GET /api/accounting/vat/declaration?startDate=...&endDate=...`
- [ ] **Export PC Compta** -- `GET /api/accounting/export/pccompta?...&journalType=ALL`
- [ ] **Export Sage** -- `GET /api/accounting/export/sage?...&journalType=ALL`
- [ ] **Export journal TVA en PDF** -- `GET /api/exports/vat?startDate=...&endDate=...&format=PDF`
- [ ] **Export journal timbre fiscal** -- `GET /api/exports/stamp?startDate=...&endDate=...&format=PDF`
- [ ] **Rapport de valorisation du stock** -- `GET /api/reports/stock/valorization`
- [ ] **Rapport de performance fournisseurs** -- `GET /api/reports/procurement/suppliers?startDate=...&endDate=...`
- [ ] **Rapport des ventes** -- `GET /api/reports/sales?startDate=...&endDate=...`
- [ ] **Rapport de production** -- `GET /api/reports/production?startDate=...&endDate=...`
- [ ] **Audit des comptes utilisateurs** -- Desactiver les comptes inutilises, verifier les roles
- [ ] **Archivage des logs de securite** -- Exporter et archiver les logs du mois
- [ ] **Verification de la coherence des stocks** -- Comparer stock theorique vs dernier inventaire physique
- [ ] **Mise a jour des seuils d'approvisionnement** -- Ajuster les `seuilSecurite` et `seuilCommande` selon la consommation reelle
- [ ] **Revue des fournisseurs bloques/sous surveillance** -- Evaluer les deblocages possibles
- [ ] **Verification des DLC proches** -- Identifier les lots MP/PF proche expiration pour action

---

# 7. SCRIPTS DE FORMATION VIDEO (5 MODULES)

## Module 1 : Premier demarrage et configuration initiale

**Duree estimee :** 25 minutes
**Public cible :** Nouvel administrateur systeme
**Prerequis :** Acces administrateur provisionne, URL de l'application communiquee

### Scene 1 -- Connexion initiale (3 min)

**Narrateur :** "Bienvenue dans Manchengo Smart ERP. Ce module vous guidera dans la configuration initiale de votre systeme de gestion. Commencez par acceder a l'application via votre navigateur web. L'URL vous a ete communiquee par l'equipe technique."

**Actions a montrer :**
- Ouvrir le navigateur et acceder a l'URL Vercel
- Saisir l'email et le mot de passe temporaire
- Le systeme detecte `mustChangePassword: true` et redirige
- Saisir le nouveau mot de passe (exigences : 8 caracteres minimum, 1 majuscule, 1 chiffre)
- Confirmation de la connexion reussie

### Scene 2 -- Decouverte du dashboard (5 min)

**Actions a montrer :**
- Vue d'ensemble des KPIs (chiffre d'affaires, commandes du jour, alertes stock)
- Navigation dans les graphiques de ventes (7 jours par defaut)
- Navigation dans les graphiques de production
- Consultation du statut de synchronisation des appareils mobiles
- Explication de chaque indicateur et de sa signification metier

### Scene 3 -- Configuration des referentiels produits (8 min)

**Actions a montrer :**
- Creation d'un produit MP (matiere premiere) avec tous les champs
- **Point d'attention :** Explication de la criticite (FAIBLE, MOYENNE, HAUTE, BLOQUANTE)
- **Point d'attention :** Configuration des seuils de securite et de commande
- Creation d'un produit PF (produit fini) avec prix en centimes
- **Point d'attention :** Le prix est en CENTIMES (ex: 45000 = 450,00 DA)
- Association a une marque et une famille de produits

### Scene 4 -- Creation des clients et fournisseurs (5 min)

**Actions a montrer :**
- Creation d'un client avec les champs fiscaux obligatoires (NIF, RC, AI)
- **Point d'attention :** Les 4 types de clients (DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD)
- Creation d'un fournisseur avec les informations fiscales (RC, NIF, AI, NIS)
- **Point d'attention :** Le NIF doit faire exactement 15 chiffres
- Explication du systeme de grade fournisseur (A, B, C)

### Scene 5 -- Creation du premier utilisateur (4 min)

**Actions a montrer :**
- Acceder au module administration des utilisateurs
- Creer un utilisateur avec le role APPRO
- Explication des 4 roles (ADMIN, APPRO, PRODUCTION, COMMERCIAL)
- Transmission securisee des identifiants
- Verification de la premiere connexion dans les logs

## Module 2 : Gestion quotidienne (dashboard, alertes, validation)

**Duree estimee :** 20 minutes
**Public cible :** Administrateur en fonction

### Scene 1 -- Routine du matin (5 min)

**Actions a montrer :**
- Consultation du dashboard KPIs
- Verification des alertes critiques non accusees
- Accuse reception des alertes CRITICAL
- Verification des productions a risque

### Scene 2 -- Gestion des alertes approvisionnement (5 min)

**Actions a montrer :**
- Consulter les alertes actives
- Accuser reception d'une alerte
- Reporter une alerte avec motif (demonstration du `POST /api/appro/alerts/mp/:mpId/postpone`)
- Scanner et creer de nouvelles alertes

### Scene 3 -- Validation des inventaires (5 min)

**Actions a montrer :**
- Consulter les inventaires en attente de validation
- Evaluer un ecart d'inventaire
- Valider une declaration avec motif
- Rejeter une declaration et demander un recomptage
- Cas de la double validation pour ecarts critiques

### Scene 4 -- Supervision de la production (5 min)

**Actions a montrer :**
- Consulter le calendrier de production
- Verifier la disponibilite des stocks avant lancement
- Demarrer une production
- Completer une production avec le rendement reel
- Telecharger le PDF de l'ordre de production

## Module 3 : Comptabilite et exports fiscaux

**Duree estimee :** 30 minutes
**Public cible :** Administrateur responsable de la comptabilite

### Scene 1 -- Comprendre la structure comptable (5 min)

**Narrateur :** "Le module comptabilite de Manchengo Smart ERP genere automatiquement les ecritures de journal a partir des operations quotidiennes. Les factures, les achats et les productions sont automatiquement refletees dans les journaux comptables."

**Actions a montrer :**
- Explication du journal des ventes (ecritures automatiques lors du passage PAID)
- Explication du journal des achats (ecritures lors des receptions BC)
- Explication du journal de production (ecritures lors de la completion des ordres)

### Scene 2 -- Declaration TVA G50 (10 min)

**Actions a montrer :**
- Acceder a la declaration TVA
- Selectionner la periode (mois civil)
- Analyser les montants : Total HT, TVA collectee (19%), Timbre fiscal
- Exporter les donnees au format exploitable
- **Point d'attention :** Verifier que TOUTES les factures du mois sont finalisees avant d'exporter

### Scene 3 -- Exports comptables (10 min)

**Actions a montrer :**
- Export format PC Compta (CSV) -- structure et champs
- Export format Sage (CSV) -- structure et champs
- Parametrage des filtres (dates, type de journal)
- **Point d'attention :** Les journaux disponibles sont SALES, PURCHASES, PRODUCTION, ALL
- Archivage des fichiers exportes

### Scene 4 -- Rapports et exports fiscaux detailles (5 min)

**Actions a montrer :**
- Generation du journal des ventes en PDF et Excel
- Generation du journal TVA
- Generation du journal du timbre fiscal
- Etat des stocks MP et PF
- Journal des receptions MP
- Journal de production PF
- Export de factures individuelles en PDF fiscal

## Module 4 : Gestion des incidents et securite

**Duree estimee :** 20 minutes
**Public cible :** Administrateur responsable de la securite

### Scene 1 -- Surveillance proactive (5 min)

**Actions a montrer :**
- Consultation quotidienne des logs de securite
- Filtrage par type d'action (LOGIN_FAILED, LOGIN_SUCCESS, etc.)
- Evenements securite des 24 dernieres heures
- Statistiques du journal d'audit

### Scene 2 -- Reagir a un incident (8 min)

**Actions a montrer :**
- Detecter des tentatives de connexion suspectes
- Bloquer un utilisateur compromis
- Revoquer les appareils suspects
- Analyser la piste d'audit (WHO/WHAT/ON WHAT/WHEN)
- Correlation de requete pour reconstituer la chaine d'evenements
- Debloquer et rehabiliter apres investigation

### Scene 3 -- Gestion des appareils (4 min)

**Actions a montrer :**
- Lister tous les appareils enregistres
- Identifier les appareils inactifs ou non synchronises
- Revoquer un appareil perdu ou vole
- Reactiver un appareil apres maintenance

### Scene 4 -- Bonnes pratiques de securite (3 min)

**Narrateur :** Points cles a retenir :
- Ne jamais partager les identifiants ADMIN
- Changer regulierement les mots de passe
- Toujours verifier les logs apres un incident
- Documenter chaque incident avec la reference de correlation (requestId)
- La piste d'audit est immuable : elle ne peut ni etre modifiee ni supprimee

## Module 5 : Inventaire et ajustements stock

**Duree estimee :** 25 minutes
**Public cible :** Administrateur supervisant les operations de stock

### Scene 1 -- Processus d'inventaire (8 min)

**Actions a montrer :**
- Organisation d'un inventaire (attribution des zones)
- Declaration d'un inventaire dans le systeme
- Explication des niveaux de risque (LOW, MEDIUM, HIGH, CRITICAL)
- Auto-approbation pour ecarts faibles
- Validation simple pour ecarts moyens
- Double validation pour ecarts critiques

### Scene 2 -- Validation et rejet (7 min)

**Actions a montrer :**
- Consulter les inventaires en attente
- Evaluer un ecart (stock theorique vs physique)
- Valider avec un motif d'approbation
- Rejeter avec un motif de rejet
- **Point d'attention :** Le compteur ne peut PAS etre le validateur (separation des taches)

### Scene 3 -- Ajustements manuels (5 min)

**Actions a montrer :**
- Quand effectuer un ajustement manuel (casse, pertes, erreurs de saisie)
- Effectuer un ajustement positif (entree)
- Effectuer un ajustement negatif (sortie)
- Verifier le mouvement de stock cree
- Consulter la tracabilite de l'ajustement dans le journal d'audit

### Scene 4 -- Rapports et analyse (5 min)

**Actions a montrer :**
- Rapport de valorisation du stock
- Rapport de mouvements de stock (par periode)
- Export en Excel et PDF
- Historique d'inventaire par produit
- Comparaison stock theorique vs physique

---

# 8. MATRICE RACI

## Legende

- **R** = Responsable (execute l'action)
- **A** = Approbateur (approuve et valide le resultat)
- **C** = Consulte (donne un avis avant ou pendant)
- **I** = Informe (est notifie du resultat apres coup)

## Matrice par processus

| Processus | ADMIN | APPRO | PRODUCTION | COMMERCIAL |
|-----------|-------|-------|------------|------------|
| **GESTION DES UTILISATEURS** | | | | |
| Creer un utilisateur | R/A | I | I | I |
| Modifier un utilisateur | R/A | -- | -- | -- |
| Desactiver/Bloquer un utilisateur | R/A | -- | -- | -- |
| Reinitialiser un mot de passe | R/A | -- | -- | -- |
| Changer un role | R/A | -- | -- | I |
| **REFERENTIELS** | | | | |
| Creer/modifier un produit MP | R/A | C | C | -- |
| Creer/modifier un produit PF | R/A | -- | C | I |
| Creer/modifier un client | R/A | -- | -- | C |
| Creer/modifier un fournisseur | R/A | C | -- | -- |
| Creer/modifier une recette | A | -- | R | -- |
| **APPROVISIONNEMENT** | | | | |
| Consulter le dashboard APPRO | I | R | -- | -- |
| Parametrer les seuils MP | A | R | C | -- |
| Creer un bon de commande | A | R | -- | -- |
| Envoyer un BC au fournisseur | A | R | -- | -- |
| Confirmer un BC | A | R | -- | -- |
| Receptionner un BC | I | R | -- | -- |
| Annuler un BC | R/A | C | I | -- |
| Accuser reception d'une alerte | A | R | -- | -- |
| **PRODUCTION** | | | | |
| Creer un ordre de production | A | -- | R | -- |
| Demarrer une production | I | -- | R | -- |
| Completer une production | I | -- | R | -- |
| Annuler une production | A | -- | R | -- |
| Planifier la semaine | A | C | R | -- |
| **FACTURATION** | | | | |
| Creer une facture | A | -- | -- | R |
| Finaliser une facture (PAID) | A | -- | -- | R |
| Annuler une facture | R/A | -- | -- | C |
| Generer un PDF fiscal | I | -- | -- | R |
| **LIVRAISONS** | | | | |
| Creer une livraison | I | -- | -- | R |
| Valider une livraison (QR) | I | -- | -- | R |
| Annuler une livraison | A | -- | -- | R |
| **INVENTAIRE** | | | | |
| Declarer un inventaire | R | R | R | -- |
| Valider un inventaire (simple) | R/A | -- | -- | -- |
| Valider un inventaire (critique) | R/A x2 | -- | -- | -- |
| Rejeter un inventaire | R/A | -- | -- | -- |
| **STOCK** | | | | |
| Ajustement stock manuel | R/A | -- | -- | -- |
| Consulter les mouvements | R | R | R | -- |
| **COMPTABILITE** | | | | |
| Consulter les journaux | R | -- | -- | -- |
| Exporter PC Compta / Sage | R | -- | -- | -- |
| Declaration TVA G50 | R/A | -- | -- | -- |
| Exports fiscaux (ventes, TVA, timbre) | R | -- | -- | -- |
| **RAPPORTS** | | | | |
| Valorisation stock | R | C | -- | -- |
| Mouvements stock | R | R | R | -- |
| Performance production | R | -- | R | -- |
| Performance fournisseurs | R | R | -- | -- |
| Ventes | R | -- | -- | R |
| **SECURITE** | | | | |
| Consulter les logs securite | R | -- | -- | -- |
| Piste d'audit | R | -- | -- | -- |
| Bloquer/Debloquer utilisateur | R/A | -- | -- | -- |
| Revoquer/Reactiver appareil | R/A | -- | -- | -- |
| **SYNCHRONISATION** | | | | |
| Statut sync | R | -- | -- | -- |
| Evenements sync | R | -- | -- | -- |

---

# 9. NIVEAUX DE MATURITE

## Niveau 1 -- DEBUTANT (Mois 1-2)

**Titre :** Administrateur Junior
**Competences requises :**

| Domaine | Capacite |
|---------|----------|
| Connexion | Sait se connecter, changer son mot de passe, naviguer dans l'interface |
| Dashboard | Consulte les KPIs sans les interpreter en profondeur |
| Utilisateurs | Cree des comptes utilisateurs avec les informations de base |
| Referentiels | Cree des produits MP/PF, clients, fournisseurs avec assistance |
| Factures | Consulte les factures, comprend les statuts (DRAFT, PAID, CANCELLED) |
| Securite | Sait ou trouver les logs de securite |

**Indicateurs de passage au niveau 2 :**
- A cree au moins 5 utilisateurs sans erreur
- A cree au moins 10 produits (MP + PF) sans erreur de prix
- Comprend la difference entre centimes et dinars pour les prix PF
- Sait consulter les alertes critiques

## Niveau 2 -- OPERATIONNEL (Mois 3-6)

**Titre :** Administrateur Confirme
**Competences requises :**

| Domaine | Capacite |
|---------|----------|
| Dashboard | Interprete les KPIs, identifie les tendances, reagit aux alertes |
| Appro | Cree des BC urgents, accuse reception des alertes, receptionne les BC |
| Production | Supervise les ordres de production, comprend les risques supply chain |
| Inventaire | Valide les declarations d'inventaire, gere les ecarts moyens |
| Comptabilite | Exporte les journaux mensuels, prepare la G50 |
| Securite | Reagit aux incidents basiques (blocage utilisateur, revocation appareil) |

**Indicateurs de passage au niveau 3 :**
- A gere au moins 3 clotures mensuelles completes
- A gere au moins 1 incident de securite
- A valide au moins 10 inventaires
- Maitrise le workflow complet des BC (creation -> reception)

## Niveau 3 -- AVANCE (Mois 7-12)

**Titre :** Administrateur Senior
**Competences requises :**

| Domaine | Capacite |
|---------|----------|
| Strategie | Utilise les analytics pour anticiper les besoins (production, appro) |
| Optimisation | Ajuste les seuils de securite et de commande MP en fonction des donnees reelles |
| Fournisseurs | Evalue les fournisseurs par le scoring automatique, prend des decisions de blocage/surveillance |
| Inventaire | Gere les ecarts critiques (double validation), analyse les causes racines |
| Comptabilite | Effectue les rapprochements comptables, detecte les anomalies |
| Securite | Mene des investigations completes a partir de la piste d'audit (correlation requestId) |

**Indicateurs de passage au niveau 4 :**
- A optimise les seuils d'au moins 20 produits MP en se basant sur les metriques calculees
- A bloque/debloque au moins 1 fournisseur apres analyse du scoring
- A gere un inventaire annuel complet
- Maitrise les exports vers PC Compta ET Sage

## Niveau 4 -- EXPERT (Annee 2+)

**Titre :** Directeur ERP / Super-Administrateur
**Competences requises :**

| Domaine | Capacite |
|---------|----------|
| Gouvernance | Definit les politiques d'acces, les procedures d'inventaire, les regles de validation |
| Audit | Mene des audits internes bases sur les pistes d'audit immuables |
| Formation | Forme les nouveaux administrateurs et les utilisateurs de chaque role |
| Pilotage | Utilise les rapports pour piloter la strategie d'approvisionnement et de production |
| Fiscalite | Maitrise parfaitement la conformite fiscale algerienne (G50, RC, NIF, AI, NIS, timbre) |
| Integration | Comprend l'architecture technique (API REST, JWT, Prisma, PostgreSQL) et dialogue avec l'equipe SI |

**Indicateurs de passage au niveau 5 :**
- A forme au moins 2 administrateurs au niveau 2+
- A pilote au moins 2 exercices annuels complets
- A contribue a l'amelioration des processus metier

## Niveau 5 -- MAITRE (Annee 3+)

**Titre :** Architecte Fonctionnel ERP
**Competences requises :**

| Domaine | Capacite |
|---------|----------|
| Vision | Definit la roadmap fonctionnelle de l'ERP |
| Benchmark | Compare les performances avec les standards du secteur agroalimentaire |
| Innovation | Propose des ameliorations fonctionnelles basees sur l'analyse des donnees historiques |
| Compliance | Anticipe les evolutions reglementaires et adapte les processus |
| Mentorat | Accompagne l'ensemble de l'organisation dans l'adoption de l'ERP |
| Technique | Capable de specifier des evolutions et de valider les livrables techniques |

---

# 10. RECOMMANDATIONS D'OPTIMISATION

## Top 10 recommandations pour ameliorer l'efficacite

### Recommandation 1 : Automatiser la checklist matinale

**Situation actuelle :** L'administrateur doit manuellement consulter 8 endpoints differents chaque matin.

**Recommandation :** Configurer un widget dashboard consolide qui agregue en une seule vue : alertes critiques non accusees, inventaires en attente, BC en retard, factures DRAFT, logs de securite suspects, et statut de synchronisation.

**Gain estime :** Reduire le temps de la checklist matinale de 15 minutes a 3 minutes.

### Recommandation 2 : Definir des seuils de commande bases sur les donnees reelles

**Situation actuelle :** Les seuils de securite et de commande des MP sont souvent configures de maniere empirique.

**Recommandation :** Utiliser les metriques calculees automatiquement (`consommationMoyJour` et `joursCouverture`) pour calibrer les seuils. Regles suggerees :
- `seuilSecurite` = `consommationMoyJour` x `leadTimeFournisseur` x 1.5 (facteur de securite)
- `seuilCommande` = `seuilSecurite` + (`consommationMoyJour` x 7) (couverture 1 semaine supplementaire)

**Gain estime :** Reduction de 40% des ruptures non anticipees.

### Recommandation 3 : Mettre en place un second compte ADMIN permanent

**Situation actuelle :** Si un seul ADMIN existe, les inventaires critiques ne peuvent pas etre valides (double validation impossible).

**Recommandation :** Maintenir au minimum 2 comptes ADMIN actifs en permanence. Le second ADMIN peut etre le DAF ou un responsable de confiance. Cela garantit egalement la continuite d'acces en cas d'absence.

**Gain estime :** Zero blocage sur les validations critiques.

### Recommandation 4 : Programmer les exports comptables automatiques

**Situation actuelle :** Les exports comptables sont realises manuellement en fin de mois.

**Recommandation :** Systematiser les exports le premier jour ouvrable de chaque mois. Creer un script d'archivage qui telecharge tous les exports necessaires (PC Compta, Sage, G50, journaux PDF) dans un dossier date.

**Gain estime :** Reduction du risque d'oubli et gain de 2 heures par mois.

### Recommandation 5 : Classifier les fournisseurs de maniere proactive

**Situation actuelle :** Le scoring fournisseur est calcule automatiquement mais rarement utilise pour prendre des decisions.

**Recommandation :** Definir des seuils d'action clairs :
- Score < 50 : Mise sous surveillance automatique
- Score < 30 : Blocage et recherche d'alternative
- 3 retards consecutifs : Alerte ADMIN

**Gain estime :** Reduction de 25% des retards fournisseurs.

### Recommandation 6 : Exploiter les analytics de production

**Situation actuelle :** Les analytics de production (`GET /api/production/dashboard/analytics`) sont disponibles mais sous-exploitees.

**Recommandation :** Analyser mensuellement :
- Le rendement reel vs theorique par recette
- Le taux de pertes par produit
- Les temps de production reels vs planifies
- Les causes d'annulation des ordres de production

Utiliser ces donnees pour ajuster les recettes (`lossTolerance`) et optimiser la planification.

**Gain estime :** Amelioration de 5-10% du rendement de production.

### Recommandation 7 : Renforcer la securite par la rotation des mots de passe

**Situation actuelle :** Le systeme force le changement au premier login mais pas de rotation periodique.

**Recommandation :** Imposer un changement de mot de passe tous les 90 jours pour les roles ADMIN. Mettre en place une procedure de verification trimestrielle des comptes actifs.

**Gain estime :** Reduction du risque de compromission de compte.

### Recommandation 8 : Utiliser la tracabilite des lots pour les rappels qualite

**Situation actuelle :** Les lots MP et PF sont traces (FIFO, DLC, statut) mais le processus de rappel qualite n'est pas formalise.

**Recommandation :** En cas de probleme qualite sur un lot MP, utiliser :
- `GET /api/production/lots/search?q=L260226-001` pour retrouver le lot
- Identifier toutes les productions qui ont consomme ce lot
- Identifier les lots PF produits a partir de ce lot
- Identifier les factures et livraisons contenant ces PF
- Bloquer les lots concernes (`status: BLOCKED`)

**Gain estime :** Capacite de rappel en moins de 30 minutes vs plusieurs heures manuellement.

### Recommandation 9 : Optimiser la gestion des inventaires physiques

**Situation actuelle :** Les inventaires sont declares individuellement par produit.

**Recommandation :** Organiser les inventaires par zone physique et par equipe. Utiliser les photos comme preuves (`evidencePhotos`). Planifier un mini-inventaire tournant mensuel (10-15 produits par mois) plutot qu'un seul inventaire annuel massif.

**Gain estime :** Meilleure precision du stock (ecart moyen < 2%) et moins de perturbation des operations.

### Recommandation 10 : Monitorer la synchronisation des appareils mobiles

**Situation actuelle :** Le statut de synchronisation est consultable mais rarement verifie.

**Recommandation :** Verifier quotidiennement le statut de sync via `GET /api/dashboard/sync/status`. Identifier les appareils dont la derniere synchronisation remonte a plus de 24 heures. Un appareil desynchronise peut causer des conflits de donnees (doublons de livraisons, factures manquantes).

**Gain estime :** Zero perte de donnees liee a la desynchronisation.

---

# 11. GLOSSAIRE METIER

## Termes agroalimentaire / fromagerie

| Terme | Definition |
|-------|-----------|
| **MP (Matiere Premiere)** | Ingredient ou composant utilise dans la fabrication. Exemples : lait en poudre, sel, presure, ferments, emballages. Modele Prisma : `ProductMp`, code format `MP-NNN`. |
| **PF (Produit Fini)** | Produit pret a la vente issu de la production. Exemples : Gouda MONTESA 400g, Fromage fondu QUESA NOVA. Modele Prisma : `ProductPf`, code format `PF-NNN`. |
| **DLC (Date Limite de Consommation)** | Date au-dela de laquelle un produit ne doit plus etre consomme. Tracee dans le champ `expiryDate` des lots MP et PF. Le `shelfLifeDays` du produit PF determine la DLC a la production. |
| **DDM (Date de Durabilite Minimale)** | Date indicative au-dela de laquelle le produit peut perdre certaines qualites sans presenter de danger sanitaire. |
| **FIFO (First In, First Out)** | Methode de gestion des stocks imposant de consommer en priorite les lots les plus anciens. Implementee dans le systeme via l'index `idx_lots_mp_fifo` (tri par `createdAt` puis `expiryDate`). |
| **Lot** | Unite de tracabilite. Chaque reception de MP cree un lot (`LotMp`) et chaque production cree un lot PF (`LotPf`). Format du numero : `L-YYMMDD-NNN`. |
| **Presure** | Enzyme utilisee dans la fabrication du fromage pour faire cailler le lait. Matiere premiere critique. |
| **Ferments** | Micro-organismes (bacteries lactiques) ajoutes au lait pour la fermentation. Matiere premiere critique. |
| **Affinage** | Processus de maturation du fromage dans des conditions controlees (temperature, humidite). |
| **Caillage** | Etape de transformation du lait liquide en masse solide (caille) par l'action de la presure. |
| **Rendement** | Rapport entre la quantite de produit fini obtenue et la quantite theorique. Trace dans `ProductionOrder` via `actualQuantity` vs `plannedQuantity`. |
| **Thermoretractable** | Type d'emballage plastique qui se retracte sous l'effet de la chaleur pour epouser la forme du produit (type `SAC_THERMO`). |
| **IML (In-Mold Labeling)** | Technique de decoration de seaux et barquettes plastiques. Types : `SEAU_IML`, `BARQUETTE_IML`. |

## Termes ERP / systeme

| Terme | Definition |
|-------|-----------|
| **BC (Bon de Commande)** | Document d'approvisionnement emis vers un fournisseur. Modele Prisma : `PurchaseOrder`, code format `BC-YYYY-NNNNN`. Workflow : `DRAFT -> SENT -> CONFIRMED -> PARTIAL -> RECEIVED` ou `CANCELLED`. |
| **OP (Ordre de Production)** | Instruction de fabrication d'un produit fini. Modele Prisma : `ProductionOrder`, code format `OP-YYMMDD-NNN`. Workflow : `PENDING -> IN_PROGRESS -> COMPLETED` ou `CANCELLED`. |
| **KPI (Key Performance Indicator)** | Indicateur cle de performance. Le dashboard expose les KPIs de CA, commandes, alertes stock, production. |
| **CRUD** | Create, Read, Update, Delete. Operations de base sur les entites du systeme. |
| **RBAC (Role-Based Access Control)** | Controle d'acces base sur les roles. 4 roles dans le systeme : ADMIN, APPRO, PRODUCTION, COMMERCIAL. |
| **JWT (JSON Web Token)** | Token d'authentification utilise pour securiser les requetes API. Stocke dans des cookies httpOnly. |
| **CSRF (Cross-Site Request Forgery)** | Attaque exploitant la session d'un utilisateur authentifie. Le systeme genere des tokens CSRF pour s'en proteger. |
| **Rate Limiting** | Limitation du nombre de requetes par unite de temps. 5 tentatives de connexion par minute. |
| **Piste d'audit** | Journal immuable (append-only) de toutes les operations critiques. Modele Prisma : `AuditLog` avec chaine de hash. |
| **Sync Event** | Evenement de synchronisation entre l'application mobile et le serveur. Architecture offline-first. |
| **IRS (Indice de Risque Supply)** | Indicateur agregé calcule dans le dashboard APPRO representant le risque global d'approvisionnement. |
| **Lock (BC)** | Mecanisme de verrouillage empechant les modifications concurrentes sur un bon de commande. Acquis via `POST /api/appro/purchase-orders/:id/lock`, libere via `unlock`. |

## Termes fiscaux algeriens

| Terme | Definition |
|-------|-----------|
| **NIF (Numero d'Identification Fiscale)** | Identifiant fiscal unique attribue par l'administration fiscale algerienne. Format : 15 chiffres. Obligatoire pour clients et fournisseurs. |
| **RC (Registre de Commerce)** | Numero d'inscription au registre de commerce. Obligatoire pour toute activite commerciale en Algerie. Format alphanum. |
| **AI (Article d'Imposition)** | Reference d'imposition attribuee par l'administration fiscale. Format alphanum 3-20 caracteres. |
| **NIS (Numero d'Identification Statistique)** | Numero attribue par l'ONS (Office National des Statistiques). Optionnel, 15 chiffres si present. |
| **G50** | Declaration mensuelle de la TVA aupres de l'administration fiscale algerienne. Le systeme genere les donnees via `GET /api/accounting/vat/declaration`. |
| **TVA (Taxe sur la Valeur Ajoutee)** | Taxe a 19% appliquee sur les ventes. Calculee automatiquement par le systeme. |
| **Timbre fiscal** | Droit de timbre de 50 DA (Dinars Algeriens) applicable aux paiements en especes. Ajoute automatiquement par le systeme. |
| **DA (Dinar Algerien)** | Monnaie nationale. Dans le systeme, les prix sont stockes en **centimes** pour eviter les problemes d'arrondi (1 DA = 100 centimes). |
| **PC Compta** | Logiciel de comptabilite algerien. Le systeme exporte les ecritures au format CSV compatible PC Compta. |
| **Sage** | Logiciel de comptabilite international utilise en Algerie. Le systeme exporte au format CSV compatible Sage. |

## Termes techniques (infrastructure)

| Terme | Definition |
|-------|-----------|
| **NestJS** | Framework backend Node.js utilise pour l'API REST. |
| **Next.js 14** | Framework frontend React utilise pour l'interface web. |
| **Prisma** | ORM (Object-Relational Mapping) utilise pour interagir avec PostgreSQL. |
| **PostgreSQL** | Base de donnees relationnelle principale du systeme (etat global consolide). |
| **Redis** | Cache en memoire utilise pour le rate limiting et la mise en cache des donnees frequemment accedees. |
| **BullMQ** | Gestionnaire de files d'attente pour les taches asynchrones (batch jobs, recalcul metriques). |
| **Railway** | Plateforme cloud hebergeant le backend NestJS et la base PostgreSQL. |
| **Vercel** | Plateforme cloud hebergeant le frontend Next.js. |
| **Tauri 2.x** | Framework desktop multiplateforme utilise pour l'application desktop. |
| **Flutter** | Framework mobile multiplateforme utilise pour l'application mobile. |
| **httpOnly Cookie** | Cookie accessible uniquement par le serveur (non lisible par JavaScript cote client). Utilise pour stocker les tokens JWT. |

---

# 12. ANNEXES

## 12.1 URLs API de reference

### Base URLs

| Environnement | Backend API | Frontend Web |
|---------------|------------|-------------|
| Production | `https://<backend>.railway.app/api` | `https://<frontend>.vercel.app` |
| Staging | Configure selon le deploiement | -- |

### Endpoints complets par module

#### Administration (`/api/admin`)

| Methode | Endpoint | Description | Roles |
|---------|---------|-------------|-------|
| GET | `/admin/stock/mp` | Stock MP | ADMIN, APPRO |
| GET | `/admin/stock/pf` | Stock PF | ADMIN, COMMERCIAL, PRODUCTION |
| GET | `/admin/stock/movements` | Mouvements stock (audit) | ADMIN |
| POST | `/admin/stock/adjust` | Ajustement manuel | ADMIN |
| GET | `/admin/invoices` | Liste factures | ADMIN, COMMERCIAL |
| GET | `/admin/invoices/:id` | Detail facture | ADMIN, COMMERCIAL |
| POST | `/admin/invoices` | Creer facture | ADMIN, COMMERCIAL |
| PUT | `/admin/invoices/:id` | Modifier facture DRAFT | ADMIN, COMMERCIAL |
| PUT | `/admin/invoices/:id/status` | Changer statut facture | ADMIN, COMMERCIAL |
| GET | `/admin/invoices/:id/pdf` | PDF fiscal facture | ADMIN, COMMERCIAL |
| GET | `/admin/production` | Ordres production | ADMIN, PRODUCTION |
| GET | `/admin/clients` | Liste clients | ADMIN, COMMERCIAL |
| GET | `/admin/clients/:id` | Detail client | ADMIN, COMMERCIAL |
| GET | `/admin/clients/:id/history` | Historique client | ADMIN, COMMERCIAL |
| POST | `/admin/clients` | Creer client | ADMIN |
| PUT | `/admin/clients/:id` | Modifier client | ADMIN |
| DELETE | `/admin/clients/:id` | Supprimer client | ADMIN |
| GET | `/admin/suppliers` | Liste fournisseurs | ADMIN, APPRO |
| POST | `/admin/suppliers` | Creer fournisseur | ADMIN |
| PUT | `/admin/suppliers/:id` | Modifier fournisseur | ADMIN |
| DELETE | `/admin/suppliers/:id` | Supprimer fournisseur | ADMIN |
| GET | `/admin/users` | Liste utilisateurs | ADMIN |
| POST | `/admin/users` | Creer utilisateur | ADMIN |
| PUT | `/admin/users/:id` | Modifier utilisateur | ADMIN |
| POST | `/admin/users/:id/reset-password` | Reset mot de passe | ADMIN |
| POST | `/admin/users/:id/toggle-status` | Basculer statut | ADMIN |
| POST | `/admin/products/mp` | Creer MP | ADMIN |
| PUT | `/admin/products/mp/:id` | Modifier MP | ADMIN |
| DELETE | `/admin/products/mp/:id` | Supprimer MP | ADMIN |
| POST | `/admin/products/pf` | Creer PF | ADMIN |
| PUT | `/admin/products/pf/:id` | Modifier PF | ADMIN |
| DELETE | `/admin/products/pf/:id` | Supprimer PF | ADMIN |
| GET | `/admin/devices` | Liste appareils | ADMIN |
| POST | `/admin/devices/:id/revoke` | Revoquer appareil | ADMIN |
| POST | `/admin/devices/:id/reactivate` | Reactiver appareil | ADMIN |
| GET | `/admin/security-logs` | Logs securite | ADMIN |

#### Authentification (`/api/auth`)

| Methode | Endpoint | Description |
|---------|---------|-------------|
| POST | `/auth/login` | Connexion (rate limited 5/min) |
| POST | `/auth/refresh` | Rafraichir token (rate limited 20/min) |
| POST | `/auth/logout` | Deconnexion |
| POST | `/auth/users` | Creer utilisateur (ADMIN) |
| GET | `/auth/csrf-token` | Token CSRF |
| GET | `/auth/me` | Info utilisateur courant |
| POST | `/auth/change-password` | Changer mot de passe (rate limited 5/min) |

#### Comptabilite (`/api/accounting`) -- ADMIN uniquement

| Methode | Endpoint | Description |
|---------|---------|-------------|
| GET | `/accounting/journal/sales` | Journal des ventes |
| GET | `/accounting/journal/purchases` | Journal des achats |
| GET | `/accounting/journal/production` | Journal de production |
| GET | `/accounting/export/pccompta` | Export PC Compta CSV |
| GET | `/accounting/export/sage` | Export Sage CSV |
| GET | `/accounting/vat/declaration` | Declaration TVA G50 |

#### Exports fiscaux (`/api/exports`) -- ADMIN uniquement

| Methode | Endpoint | Description |
|---------|---------|-------------|
| GET | `/exports/sales` | Journal des ventes (PDF/XLSX) |
| GET | `/exports/vat` | Journal TVA (PDF/XLSX) |
| GET | `/exports/stamp` | Journal timbre fiscal (PDF/XLSX) |
| GET | `/exports/stock` | Etat des stocks (PDF/XLSX) |
| GET | `/exports/invoice/:id/pdf` | Facture PDF (ADMIN, COMMERCIAL) |
| GET | `/exports/mp/stocks` | Stocks MP (PDF/XLSX) |
| GET | `/exports/mp/receptions` | Receptions MP (PDF/XLSX) |
| GET | `/exports/pf/stocks` | Stocks PF (PDF/XLSX) |
| GET | `/exports/pf/production` | Production PF (PDF/XLSX) |

#### Audit (`/api/security/audit`) -- ADMIN uniquement

| Methode | Endpoint | Description |
|---------|---------|-------------|
| GET | `/security/audit` | Requete filtree des logs d'audit |
| GET | `/security/audit/entity/:type/:id` | Historique d'une entite |
| GET | `/security/audit/request/:requestId` | Correlation de requete |
| GET | `/security/audit/security-events` | Evenements securite recents |
| GET | `/security/audit/stats` | Statistiques audit |

## 12.2 Codes d'erreur courants

| Code HTTP | Signification | Cause frequente | Action corrective |
|-----------|--------------|-----------------|-------------------|
| 400 | Bad Request | DTO invalide, champs manquants, transition de statut interdite | Verifier le corps de la requete. Verifier les regles de transition (ex: un BC PARTIAL ne peut pas etre annule). |
| 401 | Unauthorized | Token expire ou invalide, session terminee | Se reconnecter. Si le probleme persiste, verifier que le compte n'est pas bloque. |
| 403 | Forbidden | Role insuffisant pour l'operation | Verifier que votre role (ADMIN) est bien reconnu. Si l'erreur persiste, contacter le support technique. |
| 404 | Not Found | Entite inexistante (ID invalide) | Verifier l'ID de l'entite. L'entite a peut-etre ete supprimee. |
| 409 | Conflict | Email ou code deja existant | Utiliser un email ou code different. Pour les utilisateurs : verifier qu'un compte avec cet email n'existe pas deja. |
| 429 | Too Many Requests | Rate limiting declenche | Attendre 60 secondes avant de reessayer. Pour les connexions : 5 max par minute. |
| 500 | Internal Server Error | Erreur serveur inattendue | Reessayer. Si le probleme persiste, consulter les logs serveur (monitoring) et contacter le support technique. |

## 12.3 Raccourcis clavier (interface web)

**Note :** Les raccourcis clavier sont disponibles dans l'interface web Next.js et sont geres par le hook `useKeyboardShortcuts` defini dans `apps/web/src/lib/hooks/`.

| Raccourci | Action |
|-----------|--------|
| `Ctrl + K` / `Cmd + K` | Ouvrir la barre de recherche globale |
| `Ctrl + N` / `Cmd + N` | Nouvelle entite (selon le contexte) |
| `Esc` | Fermer le modal / panneau actif |
| `Tab` | Naviguer entre les champs de formulaire |
| `Enter` | Valider / Soumettre le formulaire actif |

## 12.4 Formats de reference

| Entite | Format | Exemple |
|--------|--------|---------|
| Utilisateur | `USR-NNN` | USR-001 |
| Produit MP | `MP-NNN` | MP-001 |
| Produit PF | `PF-NNN` | PF-001 |
| Client | `CLI-NNN` | CLI-001 |
| Fournisseur | `FOUR-NNN` | FOUR-001 |
| Facture | `F-YYMMDD-NNN` | F-260224-001 |
| Ordre de production | `OP-YYMMDD-NNN` | OP-260224-001 |
| Bon de commande | `BC-YYYY-NNNNN` | BC-2026-00042 |
| Lot MP | `LYYMMDD-NNN` | L260226-001 |
| Lot PF | `LYYMMDD-NNN` | L260226-001 |

## 12.5 Contacts support

| Niveau | Contact | Perimetre |
|--------|---------|-----------|
| Niveau 1 -- Support fonctionnel | Cellule SI interne | Questions d'utilisation, procedures, habilitations |
| Niveau 2 -- Support technique | Equipe developpement | Bugs, anomalies techniques, performances |
| Niveau 3 -- Infrastructure | Administrateur Railway / Vercel | Indisponibilite serveur, base de donnees, deploiement |
| Urgence securite | Directeur General + Responsable SI | Incident de securite majeur (compromission de compte, fuite de donnees) |

## 12.6 Diagramme des transitions de statut

### Facture (Invoice)

```
 +-------+         +---------+
 | DRAFT |-------->|  PAID   |
 +-------+         +---------+
     |
     +------------->+-----------+
                    | CANCELLED |
                    +-----------+
```

### Bon de Commande (PurchaseOrder)

```
 +-------+       +------+       +-----------+
 | DRAFT |------>| SENT |------>| CONFIRMED |
 +-------+       +------+       +-----------+
     |               |               |
     |               |               v
     |               |          +---------+
     |               +--------->| PARTIAL |
     |                          +---------+
     |                               |
     |                               v
     |                          +----------+
     +------------------------->| RECEIVED |
     |                          +----------+
     |
     +-----+------+------->+-----------+
     | SENT| CONFIRMED|    | CANCELLED |
     +-----+------+------->+-----------+
```

**Regles d'annulation BC :**
- Role ADMIN uniquement
- Motif obligatoire (minimum 10 caracteres)
- Interdit si reception partielle effectuee (statut PARTIAL avec ReceptionMp existante)
- Irreversible

### Ordre de Production (ProductionOrder)

```
 +---------+       +-------------+       +-----------+
 | PENDING |------>| IN_PROGRESS |------>| COMPLETED |
 +---------+       +-------------+       +-----------+
                         |
                         v
                   +-----------+
                   | CANCELLED |
                   +-----------+
```

### Lot (LotMp / LotPf)

```
 +-----------+       +----------+
 | AVAILABLE |------>| CONSUMED |
 +-----------+       +----------+
       |
       v
 +---------+
 | BLOCKED |
 +---------+
```

### Inventaire (InventoryDeclaration)

```
 +------------------+
 | DECLARE          |
 +------------------+
         |
         v
 +------------------+       +---+
 | Calcul ecart     |       |   |
 | automatique      |       |   |
 +------------------+       |   |
         |                  |   |
    +---------+             |   |
    | LOW     |----> AUTO_APPROVED
    +---------+             |
    | MEDIUM  |----> PENDING_VALIDATION --> APPROVED (1 ADMIN)
    +---------+             |
    | HIGH    |----> PENDING_VALIDATION --> APPROVED (1 ADMIN)
    +---------+             |
    | CRITICAL|----> PENDING_DOUBLE_VALIDATION --> 1er ADMIN --> 2eme ADMIN --> APPROVED
    +---------+
         |
         v
    REJECTED (a tout moment par un ADMIN)
```

## 12.7 Architecture des donnees de reference

### Hierarchie des produits finis

```
Brand (Marque)
  |-- MONTESA
  |-- QUESA NOVA
  |
  +-- ProductFamily (Famille)
       |-- FROMAGE_NOBLE (Fromages nobles - decoupe)
       |-- FROMAGE_FONDU (Fromages fondus)
       |-- PREPARATION (Preparations)
       |
       +-- ProductPf (Produit fini)
            |-- Code: PF-001
            |-- Nom: Gouda MONTESA 400g
            |-- Prix HT: 45000 centimes (= 450,00 DA)
            |-- Packaging: SAC_THERMO
            |-- Stockage: REFRIGERE (2-8 C)
            |-- DLC: 180 jours
```

### Hierarchie des matieres premieres

```
ProductMp (Matiere premiere)
  |-- Categorie: RAW_MATERIAL
  |     |-- MP-001: Lait en poudre (BLOQUANTE)
  |     |-- MP-002: Sel (FAIBLE)
  |     |-- MP-003: Presure (BLOQUANTE)
  |     |-- MP-004: Ferments (HAUTE)
  |
  |-- Categorie: PACKAGING
  |     |-- MP-010: Sacs thermoretractables (MOYENNE)
  |     |-- MP-011: Seaux IML (MOYENNE)
  |
  |-- Categorie: ADDITIVE
  |     |-- MP-020: Colorant annatto (FAIBLE)
  |
  |-- Categorie: CONSUMABLE
        |-- MP-030: Gants jetables (FAIBLE)
```

---

**FIN DU MANUEL -- VERSION 3.0.0**

**Historique des revisions :**

| Version | Date | Auteur | Description |
|---------|------|--------|-------------|
| 1.0.0 | 2025-06-01 | Cellule SI | Creation initiale |
| 2.0.0 | 2025-12-15 | Cellule SI | Ajout modules APPRO, inventaire, livraisons |
| 3.0.0 | 2026-02-24 | Cellule SI | Mise a jour complete Phase 6 -- 12 sections, exports fiscaux detailles, audit controller, supply chain risks |

**Classification :** Ce document est la propriete de Manchengo SPA. Toute reproduction ou diffusion non autorisee est interdite. Les informations contenues dans ce manuel sont strictement confidentielles et reservees aux titulaires du role ADMIN dument habilites.

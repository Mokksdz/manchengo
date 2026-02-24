# MANUEL UTILISATEUR -- ROLE COMMERCIAL / RELATION CLIENT

## Manchengo Smart ERP -- Fromagerie Industrielle Algerienne

**Version du document :** 6.0
**Date de derniere mise a jour :** 2026-02-24
**Classification :** INTERNE -- Usage restreint aux titulaires du role COMMERCIAL
**Plateforme :** Backend NestJS (Railway) + Frontend Next.js 14 (Vercel)
**Conformite :** Legislation fiscale algerienne (TVA 19%, timbre fiscal, NIF/RC/AI)

---

## TABLE DES MATIERES

1. [Fiche d'identite du role](#1-fiche-didentite-du-role)
2. [Workflow complet (Step-by-Step)](#2-workflow-complet-step-by-step)
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

### 1.1 Definition du role

Le **COMMERCIAL** est le role RBAC attribue aux collaborateurs responsables de la relation client, de la facturation et du suivi des livraisons au sein de Manchengo Smart ERP. Ce role constitue le lien operationnel entre la production fromagiere et le marche algerien.

### 1.2 Perimetre d'acces

| Module | Droits | Endpoints principaux |
|--------|--------|----------------------|
| **Clients** | Lecture complete, consultation fiscale, historique | `GET /admin/clients`, `GET /admin/clients/:id`, `GET /admin/clients/:id/history` |
| **Factures** | Lecture, creation, modification DRAFT, changement de statut, generation PDF | `GET /admin/invoices`, `POST /admin/invoices`, `PUT /admin/invoices/:id`, `PUT /admin/invoices/:id/status`, `GET /admin/invoices/:id/pdf` |
| **Livraisons** | Creation, consultation, validation QR, annulation | `POST /deliveries`, `GET /deliveries`, `POST /deliveries/validate`, `POST /deliveries/:id/cancel` |
| **Stock PF** | Lecture seule (avec donnees financieres visibles) | `GET /stock/pf`, `GET /stock/pf/:id/stock`, `GET /stock/pf/:id/movements`, `GET /admin/stock/pf` |
| **Dashboard** | KPIs (CA, alertes stock), graphique ventes | `GET /dashboard/kpis`, `GET /dashboard/charts/sales` |
| **Rapports** | Rapport ventes, exports Excel/PDF | `GET /reports/sales`, `GET /reports/export/excel`, `GET /reports/export/pdf` |

### 1.3 Restrictions du role

Le COMMERCIAL **n'a PAS acces** aux modules suivants :

- **Stock MP** (Matieres Premieres) : reserve aux roles ADMIN, APPRO, PRODUCTION
- **Production** : ordres de fabrication, recettes, consommations FIFO
- **Approvisionnement** : bons de commande fournisseurs, receptions
- **Administration** : gestion utilisateurs, devices, securite, logs d'audit
- **Sync** : evenements de synchronisation mobile
- **Graphique production** : reserve a ADMIN et PRODUCTION

### 1.4 Positionnement organisationnel

```
ADMIN (Directeur General)
  |
  +-- APPRO (Responsable Approvisionnement)
  |
  +-- PRODUCTION (Chef de Production)
  |
  +-- COMMERCIAL (Responsable Ventes) <-- CE ROLE
        |
        +-- Gestion portefeuille clients
        +-- Facturation & encaissement
        +-- Suivi livraisons terrain
        +-- Analyse performance commerciale
```

### 1.5 Indicateurs cles de performance (KPIs)

| KPI | Source | Frequence de suivi |
|-----|--------|--------------------|
| Chiffre d'affaires journalier | `GET /dashboard/kpis` → `sales.todayAmount` | Quotidienne |
| Nombre de factures du jour | `GET /dashboard/kpis` → `sales.todayInvoices` | Quotidienne |
| Alertes stock PF (ruptures) | `GET /dashboard/kpis` → `stock.pf.lowStock` | Quotidienne |
| CA par client | `GET /admin/clients/:id/history` | Hebdomadaire |
| Taux de livraisons validees | `GET /deliveries?status=VALIDATED` vs total | Hebdomadaire |
| Evolution ventes sur N jours | `GET /dashboard/charts/sales?days=30` | Mensuelle |

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Creer un nouveau client

**Objectif :** Enregistrer un nouveau partenaire commercial dans le referentiel client avec toutes les informations fiscales obligatoires pour la facturation legale en Algerie.

**Pre-requis :** Disposer des documents fiscaux du client (NIF, RC, AI).

> **Note importante :** Dans l'implementation actuelle, la creation de client via le endpoint `POST /clients` est restreinte au role ADMIN uniquement. Le COMMERCIAL doit soumettre la demande a l'ADMIN ou utiliser l'interface admin `POST /admin/clients` qui requiert egalement le role ADMIN. En pratique, le COMMERCIAL prepare le dossier et l'ADMIN effectue la saisie, ou bien l'ADMIN delegue temporairement l'acces.

**Etapes detaillees :**

1. **Collecte des informations** : Rassembler les documents fiscaux du client avant toute saisie.

2. **Identification du type de client** : Determiner la categorie commerciale parmi les quatre types disponibles :
   - `DISTRIBUTEUR` : Client volume -- reseau de distribution large, conditions tarifaires specifiques
   - `GROSSISTE` : Achat en gros -- quantites importantes, prix degressifs
   - `SUPERETTE` : Point de vente detail -- commandes regulieres mais volumes moderees
   - `FAST_FOOD` : Restauration rapide -- produits specifiques (fromage fondu, preparations)

3. **Saisie du formulaire** : Renseigner les champs obligatoires :
   - **Nom** : Raison sociale complete (minimum 2 caracteres, validation `@MinLength(2)`)
   - **Type** : Selection parmi `DISTRIBUTEUR`, `GROSSISTE`, `SUPERETTE`, `FAST_FOOD`
   - **NIF** : Numero d'Identification Fiscale (obligatoire pour facturation)
   - **RC** : Registre de Commerce (obligatoire pour facturation)
   - **AI** : Article d'Imposition (obligatoire pour facturation)
   - **NIS** : Numero d'Identification Statistique (optionnel)
   - **Telephone** : Format algerien obligatoire -- regex `^0[567]\d{8}$` (commence par 05, 06 ou 07 suivi de 8 chiffres)
   - **Adresse** : Adresse complete de livraison

4. **Validation automatique** : Le systeme genere automatiquement un code client sequentiel `CLI-001`, `CLI-002`, etc. Ce code est unique et ne peut pas etre modifie.

5. **Verification** : Apres creation, verifier la fiche client via `GET /admin/clients/:id` qui retourne les 10 dernieres factures et les 10 dernieres livraisons du client.

**Donnees techniques du modele Client :**

| Champ | Type | Obligatoire | Validation |
|-------|------|-------------|------------|
| `name` | String | Oui | MinLength(2) |
| `type` | Enum | Non (defaut: DISTRIBUTEUR) | DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD |
| `nif` | String | Oui (pour facturation) | -- |
| `rc` | String | Oui (pour facturation) | -- |
| `ai` | String | Oui (pour facturation) | -- |
| `nis` | String | Non | -- |
| `phone` | String | Non | `^0[567]\d{8}$` |
| `address` | String | Non | -- |

---

### Workflow B : Creer une facture complete

**Objectif :** Emettre une facture conforme a la legislation fiscale algerienne avec calcul automatique de la TVA a 19% et du timbre fiscal.

**Pre-requis :** Client existant avec informations fiscales completes. Stock PF disponible verifie.

**Etapes detaillees :**

1. **Verification du stock PF** : Avant toute prise de commande, consulter les disponibilites via `GET /stock/pf`. Le COMMERCIAL a acces aux donnees financieres (prix HT, valeur stock) contrairement au role PRODUCTION. Verifier chaque produit demande par le client :
   - `GET /stock/pf/:id/stock` pour le stock actuel d'un produit specifique
   - Verifier que `currentStock` est suffisant pour la quantite commandee

2. **Selection du client** : Identifier le client par son `clientId` (identifiant numerique interne). Utiliser `GET /admin/clients` pour rechercher le client dans la liste triee par nom alphabetique. Le filtre par type est disponible : `GET /admin/clients?type=DISTRIBUTEUR`.

3. **Composition des lignes de facture** : Pour chaque produit commande, renseigner :
   - `productPfId` : Identifiant du produit fini (ex: PF-001 "Gouda MONTESA(R) 400g")
   - `quantity` : Quantite commandee (entier, minimum 1)
   - `unitPriceHt` : Prix unitaire HT **en centimes** (ex: 85000 centimes = 850,00 DA)

   **Regle critique : Les montants sont TOUJOURS en centimes dans le systeme.** Un prix de 850,00 DA se saisit comme `85000`.

4. **Selection du mode de paiement** : Trois options disponibles :
   - `ESPECES` : Paiement en especes -- **declenche automatiquement le timbre fiscal de 50 DA** (5000 centimes)
   - `CHEQUE` : Paiement par cheque -- pas de timbre fiscal
   - `VIREMENT` : Virement bancaire -- pas de timbre fiscal

5. **Calcul automatique** : Le systeme effectue les calculs suivants dans une transaction atomique :
   - `lineHt` = `quantity` x `unitPriceHt` (par ligne)
   - `totalHt` = somme de tous les `lineHt`
   - `totalTva` = `totalHt` x 0.19 (arrondi a l'entier -- `Math.round`)
   - `totalTtc` = `totalHt` + `totalTva`
   - `timbreFiscal` = 5000 centimes si `ESPECES`, sinon 0
   - `netToPay` = `totalTtc` + `timbreFiscal`

6. **Generation de la reference** : Format automatique `F-YYMMDD-NNN` :
   - `F` : prefixe facture
   - `YYMMDD` : date au format annee-mois-jour sur 6 chiffres
   - `NNN` : numero sequentiel du jour sur 3 chiffres (001, 002, etc.)
   - Exemple : `F-260224-001` pour la premiere facture du 24 fevrier 2026

7. **Statut initial** : La facture est creee avec le statut `DRAFT` (brouillon). Elle peut encore etre modifiee.

8. **Verification** : Consulter la facture creee via `GET /admin/invoices/:id` qui inclut les details complets : client, lignes, paiements, livraisons.

**Corps de requete type pour la creation :**

```json
{
  "clientId": 1,
  "date": "2026-02-24",
  "paymentMethod": "ESPECES",
  "lines": [
    {
      "productPfId": 1,
      "quantity": 50,
      "unitPriceHt": 85000
    },
    {
      "productPfId": 3,
      "quantity": 30,
      "unitPriceHt": 120000
    }
  ]
}
```

---

### Workflow C : Gerer le cycle de vie de la facture

**Objectif :** Accompagner une facture de sa creation jusqu'a son paiement ou son annulation.

**Les trois etats possibles :**

```
DRAFT (Brouillon)
  |
  +---> PAID (Payee) [IRREVERSIBLE]
  |
  +---> CANCELLED (Annulee) [IRREVERSIBLE]
```

**Modification d'une facture DRAFT :**

- Endpoint : `PUT /admin/invoices/:id`
- **Uniquement possible tant que le statut est DRAFT**
- Permet de modifier les lignes, le client, la date, le mode de paiement
- Les totaux sont recalcules automatiquement

**Passage en PAID (Paiement) :**

- Endpoint : `PUT /admin/invoices/:id/status` avec `{ "status": "PAID" }`
- **Cette action est IRREVERSIBLE** : une fois payee, la facture ne peut plus revenir en DRAFT
- Le systeme cree un enregistrement `Payment` associe
- Le systeme verifie que le statut actuel est DRAFT (impossible de payer une facture annulee)

**Passage en CANCELLED (Annulation) :**

- Endpoint : `PUT /admin/invoices/:id/status` avec `{ "status": "CANCELLED" }`
- **Cette action est IRREVERSIBLE** : une facture annulee ne peut plus etre modifiee ni payee
- Le systeme verifie que le statut actuel est DRAFT (impossible d'annuler une facture deja payee)

**Regles de transition strictes implementees dans le code :**

| Etat actuel | Vers DRAFT | Vers PAID | Vers CANCELLED |
|-------------|------------|-----------|----------------|
| DRAFT | -- | Autorise | Autorise |
| PAID | **INTERDIT** ("Impossible de remettre en brouillon une facture payee") | -- | **INTERDIT** |
| CANCELLED | **INTERDIT** ("Impossible de modifier une facture annulee") | **INTERDIT** | -- |

**Generation du PDF fiscal :**

- Endpoint : `GET /admin/invoices/:id/pdf`
- Retourne les donnees structurees pour la generation d'un PDF conforme a la reglementation fiscale algerienne
- Inclut toutes les informations fiscales du client (NIF, RC, AI) et les calculs TVA

---

### Workflow D : Consulter l'historique client

**Objectif :** Analyser le chiffre d'affaires et l'activite commerciale d'un client sur une periode donnee.

**Endpoint principal :** `GET /admin/clients/:id/history`

**Filtres disponibles :**

| Parametre | Description | Exemple |
|-----------|-------------|---------|
| `year` | Filtrer par annee | `?year=2026` |
| `month` | Filtrer par mois (1-12) | `?month=2` |
| `from` | Date de debut (format ISO) | `?from=2026-01-01` |
| `to` | Date de fin (format ISO) | `?to=2026-02-28` |
| `page` | Numero de page (defaut: 1) | `?page=2` |
| `limit` | Nombre de resultats par page (defaut: 20) | `?limit=50` |

**Cas d'usage typiques :**

1. **CA mensuel d'un client** : `GET /admin/clients/5/history?year=2026&month=1`
2. **Historique complet sur une periode** : `GET /admin/clients/5/history?from=2026-01-01&to=2026-06-30`
3. **Pagination des resultats** : `GET /admin/clients/5/history?page=1&limit=20`

**Donnees retournees :** Liste des factures du client avec references, dates, montants TTC, statuts et details des lignes de produits.

**Fiche client detaillee :** `GET /admin/clients/:id` retourne :
- Informations fiscales completes (NIF, RC, AI, NIS)
- Les 10 dernieres factures (triees par date decroissante)
- Les 10 dernieres livraisons (triees par date decroissante)
- Compteurs : nombre total de factures et de livraisons (`_count`)

---

### Workflow E : Creer et suivre une livraison

**Objectif :** Generer un bon de livraison avec QR code securise a partir d'une facture, planifier la livraison et valider la reception chez le client.

> **Note :** Le module livraisons est marque **WIP (Work In Progress)** et n'est pas encore integre dans le frontend web. Les endpoints API sont operationnels et destines a l'application mobile future.

**Etape 1 -- Creation de la livraison :**

- Endpoint : `POST /deliveries`
- Corps de requete :
  ```json
  {
    "invoiceId": 42,
    "scheduledDate": "2026-02-25",
    "deliveryAddress": "Zone industrielle Oued Smar, Alger",
    "deliveryNotes": "Livrer entre 8h et 12h - demander M. Benali"
  }
  ```
- Le systeme verifie que la facture existe et recupere les informations client
- Generation automatique de la reference : `LIV-YYMMDD-NNN` (ex: `LIV-260225-001`)
- Generation du QR code securise :
  - Format : `MCG:DLV:{UUID}:{REFERENCE}:{CHECKSUM}`
  - Le checksum est un hash SHA256 des 16 premiers caracteres de : `{UUID}:{REFERENCE}:{QR_SECRET_KEY}`
  - Le QR code et son checksum sont stockes en base

**Etape 2 -- Suivi des livraisons en attente :**

- `GET /deliveries/pending` : Liste des livraisons PENDING triees par date de livraison prevue
- `GET /deliveries` : Liste complete avec filtres (status, clientId, dateFrom, dateTo, page, limit)
- `GET /deliveries/:id` : Detail complet incluant client, facture et lignes de produits

**Etape 3 -- Validation sur le terrain (application mobile) :**

- Endpoint : `POST /deliveries/validate`
- Le livreur scanne le QR code imprime sur le bon de livraison
- Le systeme effectue les verifications suivantes dans une transaction atomique avec isolation `Serializable` :
  1. Parsing du QR code (format MCG:DLV:UUID:REF:CHECKSUM -- 5 segments)
  2. Verification du type d'entite (doit etre `DLV`)
  3. Verification du checksum SHA256 (comparaison en temps constant pour eviter les attaques timing)
  4. Verification que l'utilisateur est actif
  5. Verification que l'appareil est actif (si deviceId fourni)
  6. Verification anti-double validation (le statut doit etre PENDING)
  7. Mise a jour atomique du statut vers VALIDATED
  8. Creation d'un log d'audit immutable dans `DeliveryValidationLog`

- **Rate limiting** : 30 scans maximum par minute pour empecher le brute force
- Donnees optionnelles de preuve : nom du receptionnaire, signature numerique, photo de preuve, coordonnees GPS

**Etape 4 -- Annulation d'une livraison :**

- Endpoint : `POST /deliveries/:id/cancel`
- Corps : `{ "reason": "Client absent - reprogrammer livraison" }` (minimum 5 caracteres)
- **Seules les livraisons PENDING peuvent etre annulees**
- Impossible d'annuler une livraison deja validee
- L'annulation est tracee dans le `DeliveryValidationLog` avec la raison

---

### Workflow F : Consultation du stock PF disponible

**Objectif :** Verifier la disponibilite des produits finis avant toute prise de commande pour eviter de facturer des produits en rupture.

**Acces stock PF :**

1. **Liste complete** : `GET /stock/pf`
   - Retourne tous les produits PF actifs avec :
     - `productId`, `code` (PF-001), `name` ("Gouda MONTESA(R) 400g")
     - `unit` (unite), `minStock` (seuil d'alerte)
     - `currentStock` (stock calcule en temps reel par sommation des mouvements IN - OUT)
     - `status` (NORMAL, ALERTE, RUPTURE)
     - `lastMovementAt` (date du dernier mouvement)
     - **`priceHt`** et **`stockValue`** : donnees financieres **visibles pour le COMMERCIAL** (masquees pour PRODUCTION)

2. **Stock d'un produit specifique** : `GET /stock/pf/:id/stock`
   - Retourne `{ productId, productType: "PF", currentStock }`

3. **Historique des mouvements** : `GET /stock/pf/:id/movements?limit=50`
   - Permet de comprendre l'evolution du stock (entrees production, sorties ventes, ajustements inventaire)

4. **Vue admin du stock PF** : `GET /admin/stock/pf`
   - Vue complementaire accessible au COMMERCIAL via le controller admin

**Regles d'interpretation :**
- `currentStock` = somme des mouvements IN - somme des mouvements OUT (sans compter les mouvements soft-deleted)
- Si `currentStock` < `minStock` : le produit est en **alerte**
- Si `currentStock` = 0 : le produit est en **rupture**

**Bonnes pratiques :**
- Toujours verifier le stock **avant** de confirmer une commande au client
- En cas de stock faible, consulter les mouvements recents pour anticiper les reapprovisionnements
- Utiliser le dashboard KPIs (`GET /dashboard/kpis` → `stock.pf.lowStock`) pour un apercu rapide des alertes

---

### Workflow G : Analyse des ventes (Dashboard, Rapports, Exports)

**Objectif :** Exploiter les outils d'analyse pour piloter la performance commerciale.

**1. Dashboard KPIs :**

Endpoint : `GET /dashboard/kpis`

Donnees retournees :
```json
{
  "stock": {
    "mp": { "total": 15000, "lowStock": 2 },
    "pf": { "total": 8500, "lowStock": 1 }
  },
  "sales": {
    "todayAmount": 4250000,
    "todayInvoices": 12
  },
  "sync": {
    "devicesOffline": 0,
    "pendingEvents": 3
  },
  "_meta": {
    "cachedAt": "2026-02-24T10:30:00Z",
    "computedInMs": 45
  }
}
```

Le montant `todayAmount` est en centimes. Pour obtenir le CA en DA : diviser par 100. Exemple : 4 250 000 centimes = 42 500,00 DA.

Les KPIs sont mis en cache via Redis pour des temps de reponse optimaux.

**2. Graphique des ventes :**

Endpoint : `GET /dashboard/charts/sales?days=30`

- Parametre `days` : nombre de jours a afficher (defaut 7, maximum 365)
- Retourne un tableau date/montant pour chaque jour de la periode
- Seules les factures avec statut `PAID` sont comptabilisees

**3. Rapport des ventes :**

Endpoint : `GET /reports/sales?startDate=2026-01-01&endDate=2026-01-31`

- Les deux dates sont obligatoires (format ISO)
- Retourne un rapport synthetique des ventes sur la periode

**4. Exports :**

- **Excel** : `GET /reports/export/excel?type=sales&startDate=2026-01-01&endDate=2026-01-31`
  - Genere un fichier `.xlsx` telechareable
- **PDF** : `GET /reports/export/pdf?type=sales&startDate=2026-01-01&endDate=2026-01-31`
  - Genere un fichier PDF pour impression

Types de rapports exportables par le COMMERCIAL : `sales` (ventes), ainsi que les autres types si accessibles via les roles attribues.

---

## 3. SCENARIOS REELS

### Scenario 1 : Nouveau client DISTRIBUTEUR avec premiere commande

**Contexte :** Sarl "Distribution Fromages du Centre" souhaite devenir distributeur MONTESA(R) pour la region de Blida. Le commercial M. Karim a negocie un premier essai de 200 unites de Gouda 400g.

**Deroulement :**

1. M. Karim collecte les documents fiscaux : NIF 001234567890123, RC 01B0012345, AI IMP-2024-00456, telephone 0555123456.

2. Il transmet les informations a l'ADMIN pour creation du client. L'ADMIN cree le client via l'interface admin :
   - Nom : "Sarl Distribution Fromages du Centre"
   - Type : DISTRIBUTEUR
   - NIF/RC/AI renseignes
   - Telephone : 0555123456
   - Adresse : "Zone commerciale, Route de Blida, Lot 12"

3. Le systeme genere le code `CLI-015` (quinzieme client).

4. M. Karim verifie le stock PF : `GET /stock/pf` -- le Gouda MONTESA(R) 400g (PF-001) affiche `currentStock: 450`. Stock suffisant.

5. Il cree la facture :
   ```
   POST /admin/invoices
   {
     "clientId": 15,
     "date": "2026-02-24",
     "paymentMethod": "CHEQUE",
     "lines": [
       { "productPfId": 1, "quantity": 200, "unitPriceHt": 85000 }
     ]
   }
   ```

6. Calculs automatiques :
   - lineHt = 200 x 85 000 = 17 000 000 centimes (170 000,00 DA)
   - totalTva = 17 000 000 x 0.19 = 3 230 000 centimes (32 300,00 DA)
   - totalTtc = 20 230 000 centimes (202 300,00 DA)
   - timbreFiscal = 0 (paiement par cheque)
   - netToPay = 20 230 000 centimes (202 300,00 DA)

7. Reference generee : `F-260224-003`

8. M. Karim genere le PDF fiscal : `GET /admin/invoices/42/pdf`

9. Apres encaissement du cheque, il passe la facture en PAID : `PUT /admin/invoices/42/status` avec `{ "status": "PAID" }`

---

### Scenario 2 : Livraison validee par QR sur le terrain

**Contexte :** La livraison LIV-260224-001 pour le client "Superette El Baraka" doit etre effectuee ce matin. Le livreur utilise l'application mobile.

**Deroulement :**

1. Le commercial a cree la livraison la veille :
   ```
   POST /deliveries
   {
     "invoiceId": 38,
     "scheduledDate": "2026-02-24",
     "deliveryAddress": "12 Rue Didouche Mourad, Alger Centre",
     "deliveryNotes": "Sonner au 2eme etage - demander Mme Fatima"
   }
   ```

2. Le systeme a genere le QR code : `MCG:DLV:a1b2c3d4-e5f6-7890-abcd-ef1234567890:LIV-260224-001:8f4e2a1b9c3d7e5f`

3. Le QR est imprime sur le bon de livraison papier.

4. Sur place, le livreur ouvre l'application mobile et scanne le QR.

5. L'application envoie :
   ```
   POST /deliveries/validate
   {
     "qrCode": "MCG:DLV:a1b2c3d4-e5f6-7890-abcd-ef1234567890:LIV-260224-001:8f4e2a1b9c3d7e5f",
     "deviceId": "device-uuid-123",
     "gpsCoordinates": "36.7538,3.0588",
     "recipientName": "Fatima Benali",
     "proofPhoto": "base64_encoded_photo..."
   }
   ```

6. Le systeme valide en moins de 500ms : checksum OK, livraison PENDING, utilisateur actif, appareil actif.

7. Reponse : `{ "success": true, "message": "Livraison validee avec succes" }`

8. Le log immutable `DeliveryValidationLog` enregistre : ID livraison, QR scanne, userId, deviceId, IP, user-agent, coordonnees GPS, temps de traitement.

---

### Scenario 3 : Facture erronee a annuler

**Contexte :** Le commercial a cree la facture F-260224-005 pour le client CLI-008 avec une erreur : le mauvais produit a ete facture (Edam au lieu de Gouda).

**Deroulement :**

1. Verification du statut : `GET /admin/invoices/45` -- statut `DRAFT`. La correction est possible.

2. **Option A -- Modification** (si le statut est toujours DRAFT) :
   ```
   PUT /admin/invoices/45
   {
     "lines": [
       { "productPfId": 1, "quantity": 100, "unitPriceHt": 85000 }
     ]
   }
   ```
   Le systeme recalcule tous les totaux automatiquement.

3. **Option B -- Annulation et recreation** (si la modification est trop complexe) :
   ```
   PUT /admin/invoices/45/status
   { "status": "CANCELLED" }
   ```
   Puis creation d'une nouvelle facture avec les bonnes donnees.

4. **Cas critique** : Si la facture avait deja ete passee en `PAID`, il est **IMPOSSIBLE** de l'annuler ou de la modifier. Il faut alors creer une facture d'avoir (procedure manuelle hors systeme actuellement) et signaler l'erreur a l'ADMIN.

5. Verification : la facture annulee apparait avec le statut `CANCELLED` dans la liste des factures. Elle reste visible pour la tracabilite mais ne peut plus etre modifiee.

---

### Scenario 4 : Analyse top clients mensuel

**Contexte :** En fin de mois, le directeur commercial doit presenter un rapport des 5 meilleurs clients par CA pour janvier 2026.

**Deroulement :**

1. Lister tous les clients : `GET /admin/clients`

2. Pour chaque client, recuperer l'historique janvier :
   ```
   GET /admin/clients/1/history?year=2026&month=1
   GET /admin/clients/2/history?year=2026&month=1
   GET /admin/clients/3/history?year=2026&month=1
   ...
   ```

3. Agreger les montants `netToPay` des factures PAID pour chaque client.

4. Completer avec le rapport de ventes global :
   ```
   GET /reports/sales?startDate=2026-01-01&endDate=2026-01-31
   ```

5. Exporter en Excel pour presentation :
   ```
   GET /reports/export/excel?type=sales&startDate=2026-01-01&endDate=2026-01-31
   ```

6. Visualiser la tendance sur le graphique :
   ```
   GET /dashboard/charts/sales?days=31
   ```

7. Presenter les resultats lors de la reunion commerciale mensuelle avec le classement par CA decroissant, evolution par rapport au mois precedent, et objectifs pour le mois suivant.

---

### Scenario 5 : Rupture PF -- Informer le client et gerer la situation

**Contexte :** Le client "Grossiste El Hayet" (CLI-003) passe commande de 500 unites de Fromage fondu MONTESA(R) 800g, mais le stock est insuffisant.

**Deroulement :**

1. Verification stock : `GET /stock/pf/3/stock` -- retourne `currentStock: 120`

2. Consultation des mouvements recents : `GET /stock/pf/3/movements?limit=10`
   - Le commercial constate que les dernieres entrees datent de 5 jours (production)
   - Pas de production planifiee visible dans son perimetre

3. Verification globale des alertes : `GET /dashboard/kpis` confirme `stock.pf.lowStock: 3` (3 produits en alerte)

4. Le commercial contacte le client pour l'informer :
   - Proposition de livraison partielle de 120 unites disponibles
   - Engagement de livrer le complement des reception de la prochaine production
   - Alternative : proposer un produit de substitution si disponible

5. Si le client accepte la livraison partielle :
   - Creation de la facture pour 120 unites (pas 500)
   - Note interne pour le suivi du complement

6. Le commercial signale la situation a l'ADMIN et au responsable PRODUCTION pour anticiper la planification de la prochaine production.

7. Suivi : consulter regulierement `GET /stock/pf/3/movements` pour detecter les nouvelles entrees production et relancer la commande complementaire.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Montants saisis en DA au lieu de centimes

**Description :** Le commercial saisit `850` comme prix unitaire HT pensant indiquer 850 DA, alors que le systeme attend 85 000 centimes. Resultat : une facture a 8,50 DA au lieu de 850 DA.

**Prevention :** Toujours multiplier le prix en DA par 100. Verifier le `netToPay` avant de valider.

**Detection :** Montant total anormalement bas sur la facture generee.

### Erreur 2 : Passage premature en PAID

**Description :** Le commercial passe une facture en PAID avant d'avoir reellement encaisse le paiement.

**Prevention :** Ne passer en PAID qu'apres confirmation physique du paiement (cheque remis, virement recu, especes comptees).

**Impact :** Action irreversible. Impossible de revenir en DRAFT pour corriger.

### Erreur 3 : Oubli du timbre fiscal pour paiement especes

**Description :** Le commercial ne remarque pas que le timbre fiscal de 50 DA a ete automatiquement ajoute pour un paiement en especes, et facture le montant TTC sans le timbre au client.

**Prevention :** Toujours verifier le champ `timbreFiscal` et le `netToPay` final. Le systeme ajoute automatiquement 5 000 centimes (50 DA) lorsque le mode de paiement est ESPECES.

### Erreur 4 : Telephone au mauvais format

**Description :** Saisie d'un numero de telephone au format international (+213) ou avec des espaces, provoquant un rejet de validation.

**Prevention :** Le format attendu est strictement `0[567]XXXXXXXX` -- 10 chiffres, sans espaces, commencant par 05, 06 ou 07.

### Erreur 5 : Facture sans verification prealable du stock

**Description :** Le commercial cree une facture pour 500 unites d'un produit dont seules 120 sont en stock, sans avoir verifie au prealable.

**Prevention :** Systeme d'alerte : consulter `GET /stock/pf` avant chaque prise de commande. Le systeme ne bloque pas la creation de facture en cas de stock insuffisant (la verification est de la responsabilite du commercial).

### Erreur 6 : Champs fiscaux client incomplets

**Description :** Le client est cree sans NIF, RC ou AI. La facture generee ne sera pas conforme a la reglementation fiscale algerienne.

**Prevention :** Verifier la completude des champs fiscaux via `GET /admin/clients/:id` avant toute facturation. Les champs NIF, RC et AI sont definis par defaut a une chaine vide, ce qui ne declenche pas d'erreur a la creation mais rend la facture non conforme.

### Erreur 7 : Annulation d'une facture deja payee

**Description :** Le commercial tente d'annuler une facture deja passee en PAID. Le systeme retourne une erreur 400.

**Prevention :** Toujours verifier le statut avant toute action. Si la facture est payee, la seule option est de creer une facture d'avoir.

### Erreur 8 : Scan QR d'une livraison deja validee

**Description :** Le livreur tente de rescanner un QR code deja valide, causant un rejet `DELIVERY_ALREADY_VALIDATED` (HTTP 409 Conflict).

**Prevention :** Verifier le statut de la livraison avant deplacement. L'application mobile doit afficher clairement le statut.

### Erreur 9 : Confusion entre client ID et client code

**Description :** Le commercial utilise le numero de code `CLI-015` comme `clientId` dans la creation de facture, au lieu de l'identifiant numerique interne `15`.

**Prevention :** Le `clientId` dans les appels API est toujours l'identifiant numerique (`id`), pas le code metier (`code`). Utiliser la liste clients pour recuperer l'ID correct.

### Erreur 10 : Suppression d'un client ayant des factures

**Description :** Tentative de suppression d'un client qui a des factures ou livraisons associees. Le systeme retourne une erreur `ConflictException` : "Impossible de supprimer: client a X facture(s) et Y livraison(s)".

**Prevention :** Verifier via `GET /admin/clients/:id` que le compteur `_count.invoices` et `_count.deliveries` sont a zero avant toute demande de suppression. Si le client a un historique, il ne peut pas etre supprime -- seule la desactivation est possible (via ADMIN).

---

## 5. RISQUES METIER CRITIQUES

### Risque 1 : Non-conformite fiscale (CRITIQUE)

**Description :** Emission de factures sans les informations fiscales obligatoires (NIF, RC, AI) du client, en violation de la reglementation algerienne.

**Impact :** Amendes fiscales, risque de controle, invalidation des factures emises.

**Mitigation :** Controler systematiquement la completude des champs fiscaux client avant toute facturation. Mettre en place un processus de validation des fiches clients par l'ADMIN avant la premiere facture.

### Risque 2 : Erreur de facturation irreversible (ELEVE)

**Description :** Passage premature en PAID d'une facture erronee. L'action etant irreversible, aucune correction n'est possible dans le systeme.

**Impact :** Ecart comptable, necessite d'avoir correctif, risque de litige client.

**Mitigation :** Double verification avant tout changement de statut. Instaurer une regle de revue a quatre yeux pour les factures depassant un seuil (ex: 500 000 DA).

### Risque 3 : Vente sur stock inexistant (ELEVE)

**Description :** Facturation de quantites superieures au stock reel disponible, le systeme n'effectuant pas de verification automatique lors de la creation de facture.

**Impact :** Impossibilite de livrer, perte de credibilite client, penalites contractuelles.

**Mitigation :** Consultation obligatoire du stock PF avant prise de commande. Alerter le responsable PRODUCTION pour toute commande depassant 50% du stock disponible.

### Risque 4 : Fraude au QR code livraison (MOYEN)

**Description :** Tentative de validation de livraison avec un QR code falsifie ou rejeu d'un QR deja utilise.

**Impact :** Fausse preuve de livraison, perte de marchandise.

**Mitigation :** Le systeme implemente : checksum SHA256, comparaison en temps constant, anti-double validation atomique, rate limiting 30 scans/minute, audit trail immutable complet avec IP, user-agent et coordonnees GPS.

### Risque 5 : Perte de tracabilite livraison (MOYEN)

**Description :** Livraisons effectuees sans passage par le systeme (livraison "au noir"), ou bon de livraison sans validation QR.

**Impact :** Ecart entre stock physique et stock systeme, perte de marchandise non tracee.

**Mitigation :** Instaurer une politique de tolerance zero : toute livraison doit etre creee dans le systeme et validee par QR. Audit regulier des livraisons PENDING non validees.

### Risque 6 : Fuite de donnees financieres (MOYEN)

**Description :** Le COMMERCIAL a acces aux prix HT et valeurs de stock PF, contrairement au role PRODUCTION. Diffusion non autorisee de ces informations.

**Impact :** Perte d'avantage concurrentiel, pression sur les marges.

**Mitigation :** Sensibilisation a la confidentialite, clause de non-divulgation, logs d'acces consultes regulierement par l'ADMIN.

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist quotidienne (debut de journee)

| # | Action | Endpoint/Ecran | Fait |
|---|--------|----------------|------|
| 1 | Consulter le dashboard KPIs | `GET /dashboard/kpis` | [ ] |
| 2 | Verifier le CA de la veille | `sales.todayAmount` (date J-1 via chart) | [ ] |
| 3 | Controler les alertes stock PF | `stock.pf.lowStock` | [ ] |
| 4 | Lister les factures DRAFT en attente | `GET /admin/invoices?status=DRAFT` | [ ] |
| 5 | Verifier les livraisons PENDING du jour | `GET /deliveries/pending` | [ ] |
| 6 | Traiter les commandes du jour | Processus de facturation | [ ] |

### 6.2 Checklist quotidienne (fin de journee)

| # | Action | Endpoint/Ecran | Fait |
|---|--------|----------------|------|
| 1 | Verifier que toutes les factures du jour sont passees en PAID ou CANCELLED | `GET /admin/invoices?status=DRAFT` (doit etre vide pour le jour) | [ ] |
| 2 | Confirmer les livraisons validees du jour | `GET /deliveries?status=VALIDATED&dateFrom=today` | [ ] |
| 3 | Identifier les livraisons non effectuees | `GET /deliveries/pending` (filtrer par date du jour) | [ ] |
| 4 | Sauvegarder les references des factures emises | Registre interne | [ ] |

### 6.3 Checklist hebdomadaire (vendredi)

| # | Action | Endpoint/Ecran | Fait |
|---|--------|----------------|------|
| 1 | Rapport des ventes de la semaine | `GET /reports/sales?startDate=...&endDate=...` | [ ] |
| 2 | Graphique des ventes 7 jours | `GET /dashboard/charts/sales?days=7` | [ ] |
| 3 | Revue des clients sans activite | Comparaison historiques clients | [ ] |
| 4 | Verification des factures DRAFT anciennes (> 3 jours) | `GET /admin/invoices?status=DRAFT` + analyse dates | [ ] |
| 5 | Export Excel hebdomadaire | `GET /reports/export/excel?type=sales&...` | [ ] |
| 6 | Analyse des livraisons annulees | `GET /deliveries?status=CANCELLED` | [ ] |
| 7 | Communication des previsions a la PRODUCTION | Email/reunion interne | [ ] |

### 6.4 Checklist mensuelle (dernier jour ouvrable)

| # | Action | Endpoint/Ecran | Fait |
|---|--------|----------------|------|
| 1 | Rapport de ventes mensuel complet | `GET /reports/sales?startDate=...&endDate=...` | [ ] |
| 2 | Export PDF du rapport mensuel | `GET /reports/export/pdf?type=sales&...` | [ ] |
| 3 | Classement des clients par CA | Historiques clients compares | [ ] |
| 4 | Verification conformite fiscale des factures | Audit NIF/RC/AI clients | [ ] |
| 5 | Analyse graphique 30 jours | `GET /dashboard/charts/sales?days=30` | [ ] |
| 6 | Revue des factures annulees du mois | `GET /admin/invoices?status=CANCELLED` | [ ] |
| 7 | Bilan des livraisons (taux de validation) | Comparaison VALIDATED vs TOTAL | [ ] |
| 8 | Presentation des resultats a la direction | Reunion mensuelle | [ ] |
| 9 | Mise a jour des fiches clients (adresses, contacts) | `GET /admin/clients` + verifications terrain | [ ] |
| 10 | Objectifs commerciaux mois suivant | Planification | [ ] |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Prise en main de l'interface commerciale (15 minutes)

**Titre :** "Decouverte du tableau de bord commercial Manchengo"

**Sequence :**
- **00:00-02:00** -- Introduction : Presentation du role COMMERCIAL dans Manchengo Smart ERP. Explication du perimetre d'acces et des modules disponibles.
- **02:00-05:00** -- Connexion et navigation : Demonstration de l'authentification JWT, explication du dashboard principal. Lecture des KPIs : CA journalier, nombre de factures, alertes stock PF.
- **05:00-08:00** -- Liste des clients : Navigation dans la liste clients, utilisation du filtre par type (DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD). Consultation d'une fiche client avec ses informations fiscales.
- **08:00-11:00** -- Consultation du stock PF : Acces au module stock, lecture des quantites disponibles, interpretation des statuts (NORMAL, ALERTE, RUPTURE). Explication de la visibilite des prix HT pour le commercial.
- **11:00-14:00** -- Graphique des ventes : Visualisation de l'evolution du CA sur 7, 30 et 90 jours. Interpretation des tendances.
- **14:00-15:00** -- Resume : Recap des points cles, quiz rapide.

**Exercice pratique :** Identifier les 3 produits PF avec le stock le plus bas et les 2 clients avec le plus de factures.

---

### Module 2 : Maitrise de la facturation (20 minutes)

**Titre :** "Creer et gerer les factures -- conformite fiscale algerienne"

**Sequence :**
- **00:00-03:00** -- Theorie fiscale : TVA 19% Algerie, timbre fiscal 50 DA pour paiement especes, champs obligatoires NIF/RC/AI. Importance de la conformite.
- **03:00-06:00** -- Systeme de centimes : Pourquoi les montants sont en centimes. Exercices de conversion : 850 DA = 85 000 centimes, 1 250,50 DA = 125 050 centimes. Verification mentale rapide.
- **06:00-10:00** -- Creation pas a pas : Demonstration complete de la creation d'une facture : selection client, ajout de 3 lignes de produits, choix du mode de paiement, verification des calculs automatiques.
- **10:00-13:00** -- Cycle de vie : Demonstration des transitions DRAFT → PAID et DRAFT → CANCELLED. Explication du caractere irreversible. Cas d'erreur : que faire si la facture est deja payee.
- **13:00-16:00** -- Generation PDF : Demonstration de la generation des donnees PDF fiscales. Verification des informations fiscales client sur le document.
- **16:00-18:00** -- Modification d'un DRAFT : Ajout/suppression de lignes, changement de mode de paiement, recalcul automatique.
- **18:00-20:00** -- Cas d'erreur et resolution : Scenario de facture erronee, procedure d'annulation, creation de la facture corrigee.

**Exercice pratique :** Creer une facture de 3 produits pour un client GROSSISTE en paiement especes, verifier le calcul du timbre fiscal, passer en PAID.

---

### Module 3 : Gestion du portefeuille clients (15 minutes)

**Titre :** "Gerer et analyser votre portefeuille clients"

**Sequence :**
- **00:00-03:00** -- Types de clients : Presentation des 4 categories (DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD) et leurs implications commerciales.
- **03:00-06:00** -- Fiche client complete : Navigation dans le detail client, lecture des 10 dernieres factures et 10 dernieres livraisons, interpretation des compteurs.
- **06:00-09:00** -- Historique et filtres : Utilisation des filtres de l'historique client : par annee, par mois, par plage de dates. Pagination des resultats.
- **09:00-12:00** -- Analyse du CA par client : Calcul du CA mensuel a partir de l'historique. Comparaison entre clients. Identification des clients inactifs.
- **12:00-14:00** -- Protection des donnees : Explication de la protection contre la suppression (si factures existantes). Procedure de mise a jour des informations client.
- **14:00-15:00** -- Bonnes pratiques : Mise a jour reguliere des fiches, verification terrain des adresses, relance des clients inactifs.

**Exercice pratique :** Determiner le client avec le CA le plus eleve sur les 3 derniers mois et identifier un client inactif depuis plus de 30 jours.

---

### Module 4 : Livraisons et preuve QR (15 minutes)

**Titre :** "Maitriser le circuit de livraison et la validation QR"

**Sequence :**
- **00:00-03:00** -- Principe du QR code securise : Explication du format MCG:DLV:UUID:REF:CHECKSUM, role du SHA256, anti-falsification.
- **03:00-06:00** -- Creation d'une livraison : Demonstration de la creation a partir d'une facture, choix de la date planifiee, adresse de livraison, notes au livreur.
- **06:00-09:00** -- Suivi des livraisons en attente : Consultation de la liste PENDING, filtrage par client et par date, detail d'une livraison.
- **09:00-12:00** -- Validation terrain (simulation) : Demonstration du processus de scan QR, donnees de preuve (signature, photo, GPS), reponse du systeme.
- **12:00-14:00** -- Annulation et cas d'erreur : Procedure d'annulation avec motif obligatoire, erreurs courantes (double scan, QR invalide), interpretation des codes d'erreur.
- **14:00-15:00** -- Securite : Rate limiting, audit trail, importance de ne jamais partager les QR codes.

**Exercice pratique :** Creer une livraison, consulter son QR code, simuler une validation puis verifier le log d'audit.

---

### Module 5 : Rapports et pilotage commercial (15 minutes)

**Titre :** "Piloter votre activite commerciale avec les rapports"

**Sequence :**
- **00:00-03:00** -- Dashboard KPIs : Lecture et interpretation de chaque indicateur. Seuils d'alerte. Frequence de rafraichissement du cache Redis.
- **03:00-06:00** -- Graphique des ventes : Parametrage de la periode (7, 30, 90, 365 jours). Identification des tendances, saisonnalite, pics d'activite.
- **06:00-09:00** -- Rapport de ventes detaille : Generation d'un rapport sur une periode personnalisee. Lecture des indicateurs de synthese.
- **09:00-12:00** -- Exports Excel et PDF : Generation d'un export Excel pour analyse approfondie dans un tableur. Generation du PDF pour archivage et presentation.
- **12:00-14:00** -- Tableau de bord personnel : Comment combiner les differentes sources de donnees (KPIs + historiques clients + stock PF) pour construire une vision 360 de l'activite.
- **14:00-15:00** -- Rituels d'analyse : Checklists quotidienne, hebdomadaire et mensuelle. Automatisation du suivi.

**Exercice pratique :** Generer un rapport de ventes du mois en cours, l'exporter en Excel, et identifier le jour avec le CA le plus eleve.

---

## 8. MATRICE RACI

La matrice RACI definit les responsabilites pour chaque processus commercial. **R** = Responsable (execute), **A** = Approbateur (valide), **C** = Consulte, **I** = Informe.

| Processus | COMMERCIAL | ADMIN | APPRO | PRODUCTION |
|-----------|------------|-------|-------|------------|
| **Prospection / Acquisition client** | R | A | I | I |
| **Creation fiche client** | C | R/A | I | -- |
| **Mise a jour fiche client** | C | R/A | -- | -- |
| **Suppression fiche client** | C | R/A | -- | -- |
| **Verification stock PF avant commande** | R | I | I | C |
| **Creation facture** | R | A | -- | I |
| **Modification facture DRAFT** | R | A | -- | -- |
| **Passage facture PAID** | R | A | -- | -- |
| **Annulation facture** | R | A | -- | -- |
| **Generation PDF fiscal** | R | I | -- | -- |
| **Creation bon de livraison** | R | I | -- | -- |
| **Planification livraison** | R | A | -- | I |
| **Validation QR terrain** | R | I | -- | -- |
| **Annulation livraison** | R | A | -- | -- |
| **Consultation stock PF** | R | I | I | C |
| **Analyse dashboard ventes** | R | A | I | I |
| **Generation rapports ventes** | R | A | I | -- |
| **Export Excel / PDF** | R | I | -- | -- |
| **Signalement rupture PF** | R | A | C | C |
| **Definition politique tarifaire** | C | R/A | -- | -- |
| **Gestion utilisateurs** | -- | R/A | -- | -- |
| **Ajustement stock (inventaire)** | -- | R/A | -- | -- |
| **Production PF** | -- | I | C | R/A |
| **Approvisionnement MP** | -- | I | R/A | C |

**Legende des interactions cles :**
- Le COMMERCIAL est **R** sur tous les processus de vente et livraison
- L'ADMIN est **A** (approbateur) sur les actions irreversibles et la creation de clients
- Le COMMERCIAL **consulte** la PRODUCTION pour les previsions de disponibilite
- L'APPRO est **informe** des tendances de vente pour ajuster les approvisionnements

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 : Debutant (Semaines 1-2)

**Objectifs :**
- Naviguer dans l'interface sans assistance
- Consulter la liste clients et le stock PF
- Comprendre le systeme de centimes
- Lire le dashboard KPIs

**Competences validees :**
- [ ] Connexion autonome au systeme
- [ ] Consultation d'une fiche client avec informations fiscales
- [ ] Verification du stock PF d'un produit
- [ ] Lecture des KPIs : CA journalier, alertes stock
- [ ] Identification des types de clients et de leur signification

**Indicateur de passage :** Capable de repondre sans erreur a 5 questions sur la lecture du dashboard et des fiches clients.

---

### Niveau 2 : Operationnel (Semaines 3-4)

**Objectifs :**
- Creer des factures conformes de bout en bout
- Gerer le cycle de vie complet d'une facture
- Utiliser les filtres de l'historique client

**Competences validees :**
- [ ] Creation d'une facture multi-lignes sans erreur de montant
- [ ] Verification systematique du stock avant facturation
- [ ] Passage DRAFT → PAID apres encaissement confirme
- [ ] Annulation propre d'une facture erronee
- [ ] Consultation de l'historique client avec filtres date
- [ ] Generation du PDF fiscal d'une facture

**Indicateur de passage :** 10 factures creees sans erreur de calcul ni d'information fiscale.

---

### Niveau 3 : Autonome (Mois 2-3)

**Objectifs :**
- Gerer les livraisons avec QR code
- Analyser les performances commerciales
- Anticiper les ruptures de stock

**Competences validees :**
- [ ] Creation et suivi des livraisons
- [ ] Comprehension du processus de validation QR
- [ ] Utilisation des rapports de ventes
- [ ] Export Excel et PDF
- [ ] Analyse comparative des clients par CA
- [ ] Anticipation des ruptures via le suivi des mouvements stock PF
- [ ] Application rigoureuse des checklists quotidiennes

**Indicateur de passage :** Gestion autonome d'un portefeuille de 20+ clients avec rapports hebdomadaires.

---

### Niveau 4 : Expert (Mois 4-6)

**Objectifs :**
- Piloter la strategie commerciale avec les donnees
- Former les nouveaux commerciaux
- Proposer des ameliorations de processus

**Competences validees :**
- [ ] Analyse avancee des tendances de vente (saisonnalite, cycles)
- [ ] Recommandations basees sur les donnees (top clients, produits phares)
- [ ] Detection proactive des anomalies (factures en DRAFT trop longtemps, clients inactifs)
- [ ] Capacite a former un commercial debutant
- [ ] Maitrise de tous les endpoints API et de leurs filtres
- [ ] Comprehension du schema de donnees (relations client-facture-livraison)
- [ ] Proposition documentee d'ameliorations processus

**Indicateur de passage :** Presentation trimestrielle des resultats commerciaux avec recommandations strategiques approuvees par la direction.

---

### Niveau 5 : Reference (6+ mois)

**Objectifs :**
- Devenir le referent commercial du systeme
- Contribuer a l'evolution fonctionnelle de l'ERP
- Optimiser les processus transversaux

**Competences validees :**
- [ ] Redaction de procedures operationnelles standard
- [ ] Participation aux specifications des evolutions ERP
- [ ] Audit interne des pratiques commerciales
- [ ] Gestion de crise (rupture majeure, litige client, erreur de facturation en masse)
- [ ] Coordination inter-departements (commercial-production-appro)

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Optimisations processus immediates

**R1 -- Verification automatique du stock a la facturation**

Actuellement, le systeme ne verifie pas automatiquement la disponibilite du stock PF lors de la creation d'une facture. Il est recommande d'implementer un controle bloquant ou un avertissement dans le frontend :
- Si `quantity > currentStock` : afficher un avertissement avec la quantite disponible
- Option : permettre la facturation avec un flag "commande partielle" trace en base

**R2 -- Alertes client inactif**

Mettre en place un mecanisme d'alerte automatique lorsqu'un client n'a pas eu de facture depuis N jours (configurable, defaut 30 jours). Le commercial recevrait une notification pour relancer le client.

**R3 -- Workflow d'approbation des factures**

Pour les factures depassant un montant seuil (ex: 500 000 DA TTC), implementer un workflow de double validation : le COMMERCIAL cree la facture, l'ADMIN (ou un superviseur commercial) approuve avant le passage en PAID.

### 10.2 Optimisations techniques

**R4 -- Cache des listes clients**

Les appels `GET /admin/clients` sont frequents. Mettre en cache Redis avec invalidation a chaque creation/modification de client (TTL 5 minutes).

**R5 -- Recherche full-text sur les clients**

L'endpoint `GET /admin/invoices` supporte un parametre `search` pour la recherche. Etendre cette fonctionnalite aux clients avec recherche full-text sur nom, code, NIF, telephone.

**R6 -- Pagination coherente**

Standardiser la pagination sur tous les endpoints avec le format `{ data: [], meta: { total, page, limit, totalPages } }` deja utilise par les livraisons. Appliquer ce pattern aux clients et factures.

### 10.3 Optimisations analytiques

**R7 -- Tableau de bord commercial dedie**

Creer un dashboard specifique au role COMMERCIAL avec :
- Top 10 clients par CA (mois en cours vs mois precedent)
- Produits PF les plus vendus (classement par quantite et par CA)
- Taux de conversion commande/livraison
- Delai moyen entre facturation et livraison
- Objectifs vs realise avec barre de progression

**R8 -- Rapport automatique hebdomadaire**

Programmer l'envoi automatique d'un rapport PDF par email chaque lundi contenant :
- CA de la semaine precedente
- Comparaison S-1 / S-2
- Top 5 clients et top 5 produits
- Alertes stock PF

**R9 -- Segmentation client avancee**

Au-dela des 4 types actuels (DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD), ajouter des dimensions d'analyse :
- Zone geographique (wilaya)
- Frequence d'achat (mensuelle, bi-mensuelle, hebdomadaire)
- Panier moyen
- Anciennete

### 10.4 Optimisations mobiles (module livraison)

**R10 -- Integration frontend du module livraison**

Le module livraison est actuellement WIP (API-only, pas d'interface frontend). Priorite haute pour l'integration :
- Interface web de gestion des livraisons (creation, suivi, annulation)
- Application mobile de validation QR (scan, preuve photo, signature)
- Tableau de bord des livraisons en temps reel

**R11 -- Geolocalisation des livraisons**

Exploiter les coordonnees GPS capturees lors de la validation pour :
- Cartographie des livraisons
- Optimisation des tournees
- Verification de la coherence localisation/adresse client

---

## 11. GLOSSAIRE METIER

| Terme | Definition |
|-------|-----------|
| **AI** | Article d'Imposition -- identifiant fiscal algerien obligatoire pour la facturation legale. |
| **CA** | Chiffre d'Affaires -- somme des ventes HT ou TTC sur une periode donnee. |
| **Centimes** | Unite monetaire de base dans le systeme. 1 DA = 100 centimes. Tous les montants sont stockes en centimes pour eviter les erreurs d'arrondi en virgule flottante. |
| **CLI-XXX** | Code client auto-genere (ex: CLI-001, CLI-015). Identifiant metier unique, non modifiable. |
| **DA** | Dinar Algerien -- devise officielle. |
| **DISTRIBUTEUR** | Type de client : reseau de distribution a large couverture geographique, volumes importants, conditions tarifaires negociees. |
| **DRAFT** | Statut de facture "Brouillon" : la facture peut encore etre modifiee ou annulee. |
| **DLC** | Date Limite de Consommation -- date au-dela de laquelle le produit ne doit plus etre consomme. Critique pour les produits fromagers. |
| **F-YYMMDD-NNN** | Format de reference de facture auto-genere. Exemple : F-260224-001. |
| **FAST_FOOD** | Type de client : restauration rapide, commandes de produits specifiques (fromage fondu, preparations). |
| **FIFO** | First In, First Out -- methode de gestion des stocks ou les lots les plus anciens sont consommes en premier. |
| **GROSSISTE** | Type de client : acheteur en gros, volumes importants, prix degressifs. |
| **HT** | Hors Taxes -- montant avant application de la TVA. |
| **JWT** | JSON Web Token -- mecanisme d'authentification securise utilise pour les appels API. |
| **KPI** | Key Performance Indicator -- indicateur cle de performance mesure via le dashboard. |
| **LIV-YYMMDD-NNN** | Format de reference de livraison auto-genere. Exemple : LIV-260224-001. |
| **MCG:DLV:...** | Format de QR code securise pour la validation de livraison. MCG = Manchengo, DLV = Delivery. |
| **NIF** | Numero d'Identification Fiscale -- identifiant fiscal principal en Algerie, obligatoire pour toute transaction commerciale. |
| **NIS** | Numero d'Identification Statistique -- identifiant complementaire optionnel. |
| **netToPay** | Montant net a payer : TTC + timbre fiscal si applicable. C'est le montant final que le client doit regler. |
| **PAID** | Statut de facture "Payee" -- irreversible, l'encaissement est confirme. |
| **PF** | Produit Fini -- produit fromager pret a la vente (ex: Gouda MONTESA(R) 400g). |
| **QR Code** | Quick Response Code -- code-barres 2D utilise pour la validation des livraisons terrain. |
| **Rate Limiting** | Limitation du nombre de requetes par minute (30 scans/minute pour la validation QR) pour empecher les abus. |
| **RBAC** | Role-Based Access Control -- controle d'acces base sur les roles (ADMIN, APPRO, PRODUCTION, COMMERCIAL). |
| **RC** | Registre de Commerce -- numero d'immatriculation commercial obligatoire en Algerie. |
| **SHA256** | Algorithme de hashage cryptographique utilise pour securiser les checksums des QR codes de livraison. |
| **SUPERETTE** | Type de client : magasin de detail, commandes regulieres mais volumes moderes. |
| **Timbre fiscal** | Taxe de 50 DA appliquee automatiquement sur les factures payees en especes, conformement a la legislation algerienne. En centimes : 5 000. |
| **TTC** | Toutes Taxes Comprises -- montant incluant la TVA (HT + TVA). |
| **TVA** | Taxe sur la Valeur Ajoutee -- taux standard de 19% en Algerie, applique automatiquement sur toutes les factures. |
| **UUID** | Universally Unique Identifier -- identifiant unique universel utilise pour les livraisons et les entites securisees. |
| **WIP** | Work In Progress -- fonctionnalite en cours de developpement (actuellement : module livraison frontend). |

---

## 12. ANNEXES

### Annexe A : Cartographie des endpoints API du COMMERCIAL

```
CLIENTS (Lecture seule pour COMMERCIAL)
  GET  /api/admin/clients                    Liste des clients
  GET  /api/admin/clients/:id                Detail client + 10 dernieres factures/livraisons
  GET  /api/admin/clients/:id/history        Historique factures avec filtres

  GET  /api/clients                          Liste clients (controller clients)
  GET  /api/clients/:id                      Detail client (controller clients)

FACTURES (CRUD complet pour COMMERCIAL)
  GET  /api/admin/invoices                   Liste factures (page, limit, status, search)
  GET  /api/admin/invoices/:id               Detail facture complet
  POST /api/admin/invoices                   Creer une facture
  PUT  /api/admin/invoices/:id               Modifier une facture DRAFT
  PUT  /api/admin/invoices/:id/status        Changer statut (DRAFT->PAID, DRAFT->CANCELLED)
  GET  /api/admin/invoices/:id/pdf           Donnees PDF fiscal

  GET  /api/invoices                         Liste factures (controller invoices)
  GET  /api/invoices/:id                     Detail facture
  POST /api/invoices                         Creer une facture

LIVRAISONS (CRUD complet pour COMMERCIAL)
  POST /api/deliveries                       Creer une livraison (a partir d'une facture)
  POST /api/deliveries/validate              Valider une livraison via QR (rate limited)
  GET  /api/deliveries/pending               Livraisons en attente
  GET  /api/deliveries                       Liste avec filtres
  GET  /api/deliveries/:id                   Detail livraison
  POST /api/deliveries/:id/cancel            Annuler une livraison PENDING

STOCK PF (Lecture seule pour COMMERCIAL)
  GET  /api/stock/pf                         Liste stock PF (avec donnees financieres)
  GET  /api/stock/pf/:id/stock               Stock actuel d'un PF
  GET  /api/stock/pf/:id/movements           Historique mouvements PF
  GET  /api/admin/stock/pf                   Vue admin stock PF

DASHBOARD (Lecture seule pour COMMERCIAL)
  GET  /api/dashboard/kpis                   KPIs principaux (CA, alertes stock)
  GET  /api/dashboard/charts/sales           Graphique ventes (parametre: days)

RAPPORTS (Lecture + Export pour COMMERCIAL)
  GET  /api/reports/sales                    Rapport ventes (startDate, endDate)
  GET  /api/reports/export/excel             Export Excel (type, startDate, endDate)
  GET  /api/reports/export/pdf               Export PDF (type, startDate, endDate)
```

### Annexe B : Codes d'erreur specifiques au COMMERCIAL

| Code HTTP | Code erreur | Message | Cause | Action |
|-----------|-------------|---------|-------|--------|
| 400 | BadRequest | "Une facture doit contenir au moins une ligne" | Creation de facture sans lignes | Ajouter au moins une ligne de produit |
| 400 | BadRequest | "Impossible de modifier une facture annulee" | Tentative de modifier/payer une facture CANCELLED | Creer une nouvelle facture |
| 400 | BadRequest | "Impossible de remettre en brouillon une facture payee" | Tentative de retour PAID → DRAFT | Action irreversible -- creer un avoir |
| 400 | BadRequest | "Impossible d'annuler une livraison deja validee" | Annulation d'une livraison VALIDATED | Contacter l'ADMIN |
| 400 | BadRequest | "Format QR code invalide" | QR scanne non conforme au format MCG:DLV:... | Verifier le bon de livraison |
| 400 | BadRequest | "QR code invalide ou falsifie" | Checksum SHA256 incorrect | QR potentiellement falsifie -- signaler |
| 400 | BadRequest | "Telephone invalide: format algerien attendu" | Numero non conforme a `^0[567]\d{8}$` | Corriger le format |
| 404 | NotFound | "Client #X introuvable" | ID client inexistant | Verifier l'ID client |
| 404 | NotFound | "Facture #X introuvable" | ID facture inexistant | Verifier l'ID facture |
| 404 | NotFound | "Livraison non trouvee" | UUID livraison inexistant | Verifier l'identifiant |
| 409 | Conflict | "Un client avec ce code existe deja" | Collision de code client (rare) | Reessayer -- code auto-genere |
| 409 | Conflict | "Impossible de supprimer: client a X facture(s)..." | Suppression client avec historique | Client ne peut pas etre supprime |
| 409 | Conflict | "Livraison deja validee le ..." | Double scan QR | Livraison deja traitee |
| 429 | TooManyRequests | Rate limit exceeded | Plus de 30 scans QR en 1 minute | Attendre 60 secondes |

### Annexe C : Formules de calcul fiscal

**Calcul d'une ligne de facture :**
```
lineHt = quantity * unitPriceHt
```

**Calcul des totaux :**
```
totalHt       = SUM(lineHt pour chaque ligne)
totalTva      = ROUND(totalHt * 0.19)
totalTtc      = totalHt + totalTva
timbreFiscal  = IF(paymentMethod == "ESPECES", 5000, 0)
netToPay      = totalTtc + timbreFiscal
```

**Exemples de calcul :**

| Description | Quantite | Prix HT unitaire (centimes) | Line HT (centimes) | Line HT (DA) |
|-------------|----------|---------------------------|---------------------|---------------|
| Gouda MONTESA(R) 400g | 100 | 85 000 | 8 500 000 | 85 000,00 |
| Edam MONTESA(R) 800g | 50 | 120 000 | 6 000 000 | 60 000,00 |
| Fromage fondu 400g | 200 | 45 000 | 9 000 000 | 90 000,00 |

```
totalHt      = 8 500 000 + 6 000 000 + 9 000 000 = 23 500 000 centimes = 235 000,00 DA
totalTva     = ROUND(23 500 000 * 0.19) = 4 465 000 centimes = 44 650,00 DA
totalTtc     = 23 500 000 + 4 465 000 = 27 965 000 centimes = 279 650,00 DA
timbreFiscal = 5 000 centimes = 50,00 DA (si ESPECES)
netToPay     = 27 965 000 + 5 000 = 27 970 000 centimes = 279 700,00 DA
```

### Annexe D : Schema des transitions d'etat

**Facture :**
```
                  +--------+
                  | DRAFT  |
                  +---+----+
                     / \
          (PAID)   /   \   (CANCELLED)
                 /       \
        +------v-+    +--v--------+
        |  PAID  |    | CANCELLED |
        +--------+    +-----------+
        [FINAL]       [FINAL]
```

**Livraison :**
```
                  +---------+
                  | PENDING |
                  +---+-----+
                     / \
      (VALIDATED) /     \ (CANCELLED)
                /         \
      +-------v--+    +---v--------+
      | VALIDATED |    | CANCELLED  |
      +----------+    +------------+
      [FINAL]         [FINAL]
```

### Annexe E : Contacts et escalade

| Situation | Contact | Delai de reponse |
|-----------|---------|------------------|
| Erreur de facturation irreversible (PAID errone) | ADMIN (Directeur General) | Immediat |
| Rupture stock PF | ADMIN + PRODUCTION | 2h maximum |
| Probleme d'acces au systeme | ADMIN (gestion utilisateurs) | 30 minutes |
| Anomalie QR code (suspicion fraude) | ADMIN (securite) | Immediat |
| Client litigieux / impaye | ADMIN (Direction) | 24h |
| Bug technique ou erreur systeme | ADMIN (equipe technique) | Selon severite |
| Demande de nouveau client | ADMIN (creation de client) | 1h ouvrable |
| Modification de prix produit PF | ADMIN (referentiel produits) | 24h |

### Annexe F : Regles de nommage et references

| Entite | Format | Exemple | Auto-genere |
|--------|--------|---------|-------------|
| Client | CLI-NNN | CLI-001, CLI-042 | Oui (sequentiel) |
| Facture | F-YYMMDD-NNN | F-260224-001 | Oui (date + seq jour) |
| Livraison | LIV-YYMMDD-NNN | LIV-260224-001 | Oui (date + seq jour) |
| Produit Fini | PF-NNN | PF-001 | Non (saisi par ADMIN) |
| QR Code | MCG:DLV:{UUID}:{REF}:{HASH16} | MCG:DLV:550e8400-...:LIV-260224-001:a1b2c3d4e5f6g7h8 | Oui (calcule) |

---

**FIN DU MANUEL -- Version 6.0**

**Document redige en conformite avec les standards de documentation ERP industriels.**
**Toute reproduction ou diffusion hors du perimetre autorise est interdite.**
**Pour toute question : contacter l'administrateur systeme Manchengo Smart ERP.**

# MANUEL UTILISATEUR -- COMPTABILITE / FACTURATION

## Manchengo Smart ERP -- Fromagerie Agroalimentaire

**Version du document :** 2.0
**Date de publication :** 24 fevrier 2026
**Classification :** CONFIDENTIEL -- Usage interne
**Destinataire principal :** Responsable Comptabilite / Facturation
**Role systeme requis :** ADMIN (acces complet comptabilite, facturation, exports fiscaux)

---

> **AVERTISSEMENT LEGAL** : Ce manuel est conforme a la reglementation fiscale algerienne en vigueur (Code des Impots Directs et Taxes Assimilees, Code des Taxes sur le Chiffre d'Affaires). Les taux de TVA, les obligations de timbre fiscal, et les formats de declaration G50 decrits ci-dessous refletent la legislation applicable a la date de publication. En cas de modification legislative, le service comptable doit adapter ses pratiques et notifier l'equipe technique pour mise a jour du systeme.

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

### 1.1 Designation

| Attribut | Valeur |
|---|---|
| **Intitule du poste** | Responsable Comptabilite / Facturation |
| **Role systeme ERP** | ADMIN |
| **Perimetre fonctionnel** | Facturation, journaux comptables, declarations fiscales, exports |
| **Rattachement hierarchique** | Direction Generale |
| **Interactions principales** | Commercial (factures), Approvisionnement (achats), Production (couts), Direction (reporting) |

### 1.2 Perimetre d'acces dans Manchengo Smart ERP

Le Responsable Comptabilite opere avec le role ADMIN, qui lui confere un acces complet aux modules financiers. Voici la cartographie exhaustive de ses droits :

**Module Facturation (Invoices) :**
- `GET /invoices` -- Consultation de toutes les factures avec filtres par statut (`DRAFT`, `PAID`, `CANCELLED`) et par client (`clientId`)
- `GET /invoices/:id` -- Detail complet d'une facture avec lignes, paiements, livraisons associees
- `POST /invoices` -- Creation de factures (reference auto-generee `F-YYMMDD-NNN`)
- `PUT /invoices/:id/status` -- Changement de statut (transitions `DRAFT` vers `PAID` ou `CANCELLED`)

**Module Comptabilite (Accounting) :**
- `GET /accounting/journal/sales` -- Journal des ventes (ecritures comptables)
- `GET /accounting/journal/purchases` -- Journal des achats (ecritures sur receptions validees)
- `GET /accounting/journal/production` -- Journal de production (variation de stock)
- `GET /accounting/export/pccompta` -- Export CSV au format PC Compta (logiciel comptable algerien)
- `GET /accounting/export/sage` -- Export CSV au format Sage (logiciel comptable)
- `GET /accounting/vat/declaration` -- Donnees de declaration G50 (TVA mensuelle)

**Module Clients :**
- `GET /clients` -- Liste de tous les clients avec filtre par type (`DISTRIBUTEUR`, `GROSSISTE`, `SUPERETTE`, `FAST_FOOD`)
- `GET /clients/:id` -- Detail d'un client avec ses 10 dernieres factures et livraisons
- `POST /clients` -- Creation de client (code auto `CLI-NNN`)
- `PUT /clients/:id` -- Modification des donnees client (NIF, RC, AI, NIS)
- `DELETE /clients/:id` -- Suppression (uniquement si aucune facture/livraison liee)

**Module Rapports (Reports) :**
- `GET /reports/sales` -- Rapport des ventes par periode
- `GET /reports/stock/valorization` -- Valorisation du stock (FIFO)
- `GET /reports/procurement/purchase-orders` -- Rapport des bons de commande
- `GET /reports/procurement/suppliers` -- Performance fournisseurs
- `GET /reports/export/excel` -- Export Excel de tout rapport
- `GET /reports/export/pdf` -- Export PDF de tout rapport

**Module Dashboard :**
- `GET /dashboard/kpis` -- KPIs principaux (chiffre d'affaires, commandes)
- `GET /dashboard/charts/sales` -- Graphique des ventes (configurable 1-365 jours)

**Module Stock :**
- `GET /stock/value` -- Valeur totale du stock PF (pour le bilan)
- `GET /stock/pf` -- Stock produits finis avec valorisation financiere
- `GET /stock/mp` -- Stock matieres premieres avec valorisation financiere

### 1.3 Missions principales

1. **Facturation** : Creer, verifier et valider les factures de vente conformement a la reglementation fiscale algerienne
2. **Tenue des journaux** : Generer et contrôler les journaux des ventes, des achats et de production
3. **Declarations fiscales** : Preparer la declaration mensuelle G50 (TVA collectee moins TVA deductible)
4. **Exports comptables** : Produire les fichiers d'import pour PC Compta et Sage
5. **Suivi clients** : Gerer le fichier clients avec les identifiants fiscaux obligatoires (NIF, RC, AI)
6. **Reporting financier** : Fournir les etats de valorisation du stock, les rapports de ventes et les analyses pour la direction
7. **Conformite** : Assurer la tracabilite de toutes les operations financieres pour les controles fiscaux

### 1.4 Indicateurs de performance (KPIs)

| KPI | Cible | Frequence de mesure |
|---|---|---|
| Delai moyen de facturation | < 24h apres livraison | Hebdomadaire |
| Taux de factures en erreur (CANCELLED / total) | < 2% | Mensuel |
| Ponctualite declaration G50 | Avant le 20 du mois suivant | Mensuel |
| Ecart stock valorise vs comptabilise | < 1% | Mensuel |
| Taux de clients avec NIF/RC/AI complets | 100% | Permanent |

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Creer une facture

**Objectif :** Emettre une facture de vente conforme a la reglementation fiscale algerienne.

**Pre-requis :**
- Le client doit exister dans le systeme avec ses identifiants fiscaux (NIF, RC, AI)
- Les produits finis factures doivent etre references dans le catalogue
- L'utilisateur doit etre connecte avec le role ADMIN ou COMMERCIAL

**Etapes detaillees :**

**Etape 1 -- Selection du client**
1. Naviguer vers le module Facturation
2. Cliquer sur "Nouvelle Facture"
3. Rechercher le client par code (`CLI-001`) ou par nom
4. Le systeme affiche le type de client (`DISTRIBUTEUR`, `GROSSISTE`, `SUPERETTE`, `FAST_FOOD`)
5. Verifier que les champs fiscaux sont renseignes : NIF (15 chiffres obligatoires), RC, AI (3-20 caracteres)
6. Si un champ fiscal est manquant, le completer via le module Clients avant de poursuivre

**Etape 2 -- Saisie de la date et du mode de paiement**
1. Saisir la date de la facture (format ISO : `YYYY-MM-DD`)
2. Selectionner le mode de paiement :
   - `ESPECES` -- Declenchera automatiquement le timbre fiscal de 50 DA (5 000 centimes)
   - `CHEQUE` -- Pas de timbre fiscal
   - `VIREMENT` -- Pas de timbre fiscal

**Etape 3 -- Ajout des lignes de facture**
Pour chaque produit a facturer :
1. Selectionner le produit fini (`productPfId`) dans la liste
2. Saisir la quantite (entier, minimum 1)
3. Saisir le prix unitaire HT en centimes (entier, minimum 0)
4. Le systeme calcule automatiquement : `lineHt = quantity x unitPriceHt`
5. Ajouter autant de lignes que necessaire (minimum 1 ligne obligatoire)

**Etape 4 -- Calcul automatique des totaux**
Le systeme procede au calcul automatique suivant :
```
totalHt     = somme de toutes les lignes (lineHt)
totalTva    = ARRONDI(totalHt x 0.19)      -- TVA 19% standard
totalTtc    = totalHt + totalTva
timbreFiscal = 5000 si ESPECES, sinon 0     -- 50 DA en centimes
netToPay    = totalTtc + timbreFiscal
```

**Etape 5 -- Generation de la reference**
Le systeme genere automatiquement la reference au format `F-YYMMDD-NNN` :
- `F-` : prefixe fixe
- `YYMMDD` : date de la facture (annee 2 chiffres, mois, jour)
- `NNN` : numero sequentiel du jour (auto-incremente, commence a 001)
- Exemple : `F-260224-001` pour la premiere facture du 24 fevrier 2026

**Etape 6 -- Validation et enregistrement**
1. Verifier le recapitulatif (client, lignes, totaux, mode de paiement)
2. Confirmer la creation
3. La facture est creee avec le statut `DRAFT` (brouillon)
4. Le systeme journalise l'operation avec l'identifiant de l'utilisateur createur (`userId`)

**Appel API correspondant :**
```
POST /invoices
Body:
{
  "clientId": 1,
  "date": "2026-02-24",
  "paymentMethod": "ESPECES",
  "lines": [
    { "productPfId": 3, "quantity": 50, "unitPriceHt": 45000 },
    { "productPfId": 7, "quantity": 20, "unitPriceHt": 62000 }
  ]
}
```

---

### Workflow B : Cycle de vie de la facture (DRAFT, PAID, CANCELLED)

**Principes fondamentaux :**
- Toute facture nait au statut `DRAFT`
- Seules les factures `DRAFT` peuvent etre modifiees
- Les transitions de statut sont IRREVERSIBLES
- Une facture `PAID` ne peut plus jamais changer de statut
- Une facture `CANCELLED` ne peut plus jamais changer de statut
- Seul le role ADMIN peut effectuer les changements de statut

**Transition DRAFT vers PAID :**
1. Ouvrir la facture en statut `DRAFT`
2. Verifier l'integralite des informations (client, lignes, montants)
3. Confirmer le paiement effectif
4. Cliquer sur "Valider le paiement" (ou appeler `PUT /invoices/:id/status` avec `{ "status": "PAID" }`)
5. Le systeme enregistre la transition et cree un enregistrement `Payment` associe
6. La facture apparait desormais dans le journal des ventes

**Transition DRAFT vers CANCELLED :**
1. Ouvrir la facture en statut `DRAFT`
2. Verifier la raison de l'annulation
3. Cliquer sur "Annuler la facture" (ou appeler `PUT /invoices/:id/status` avec `{ "status": "CANCELLED" }`)
4. La facture est marquee comme annulee, elle n'apparaitra pas dans les journaux comptables

**Diagramme d'etats :**
```
                    +--------+
         +--------->|  PAID  |  (Irreversible)
         |          +--------+
         |
    +---------+
    |  DRAFT  |
    +---------+
         |
         |          +-----------+
         +--------->| CANCELLED |  (Irreversible)
                    +-----------+
```

**Points de controle critique :**
- Avant de passer a `PAID`, verifier que le paiement physique (especes, cheque, virement) a bien ete recu
- Apres passage a `PAID`, il est IMPOSSIBLE de corriger une erreur ; la seule option est de creer une facture d'avoir (nouvelle facture negative)
- Les factures `CANCELLED` ne generent aucune ecriture comptable

---

### Workflow C : Generation PDF fiscal

**Objectif :** Generer un document PDF conforme a la reglementation fiscale algerienne, incluant tous les champs obligatoires.

**Contenu obligatoire du PDF fiscal :**

*En-tete entreprise :*
- Raison sociale de la fromagerie Manchengo
- NIF de l'entreprise
- RC de l'entreprise
- AI de l'entreprise
- Adresse du siege social

*Informations client :*
- Nom / Raison sociale
- Code client (`CLI-NNN`)
- NIF du client (15 chiffres)
- RC du client
- AI du client
- NIS du client (si disponible)

*Corps de la facture :*
- Reference de la facture (`F-YYMMDD-NNN`)
- Date de la facture
- Detail des lignes : designation produit, quantite, prix unitaire HT, montant HT ligne
- Total HT
- Montant TVA (19%)
- Total TTC
- Timbre fiscal (50 DA si especes, 0 sinon)
- Net a payer

*Pied de page :*
- Mode de paiement
- Mentions legales obligatoires

**Etapes :**
1. Ouvrir la facture souhaitee via `GET /invoices/:id`
2. Verifier que toutes les donnees fiscales client sont presentes
3. Declencher la generation PDF
4. Le systeme assemble les donnees de la facture, du client et de l'entreprise
5. Telecharger et archiver le PDF

---

### Workflow D : Cloture mensuelle -- Export journal des ventes

**Objectif :** Generer le journal des ventes du mois pour integration comptable.

**Periodicite :** Mensuelle, entre le 1er et le 5 du mois suivant.

**Etapes :**

1. **Definir la periode :**
   - Date de debut : premier jour du mois (`YYYY-MM-01`)
   - Date de fin : dernier jour du mois (`YYYY-MM-28/29/30/31`)

2. **Generer le journal des ventes :**
   ```
   GET /accounting/journal/sales?startDate=2026-02-01&endDate=2026-02-28
   ```

3. **Verifier les ecritures :**
   Le systeme genere une ecriture par facture au statut `PAID` dans la periode. Chaque ecriture contient :
   - **Debit** : Compte 411 (Clients) -- montant `netToPay`
   - **Credit** : Compte 701 (Ventes de produits finis) -- montant `totalHt`
   - **Credit** : Compte 4457 (TVA collectee) -- montant `totalTva`
   - **Credit** : Compte 6411 (Timbre fiscal) -- montant `timbreFiscal` (si applicable)

4. **Controles de coherence :**
   - Verifier que la somme des debits egale la somme des credits pour chaque ecriture
   - Verifier que le nombre de factures dans le journal correspond au nombre de factures `PAID` de la periode
   - Recouper avec les encaissements physiques

5. **Archiver :** Conserver le resultat pour audit.

---

### Workflow E : Cloture mensuelle -- Export journal des achats

**Objectif :** Generer le journal des achats du mois base sur les receptions de matieres premieres validees.

**Etapes :**

1. **Definir la periode :** Meme principe que le journal des ventes.

2. **Generer le journal des achats :**
   ```
   GET /accounting/journal/purchases?startDate=2026-02-01&endDate=2026-02-28
   ```

3. **Verifier les ecritures :**
   Chaque reception validee (`status: VALIDATED`) avec un fournisseur genere :
   - **Debit** : Compte 601 (Achats de matieres premieres) -- montant HT total
   - **Debit** : Compte 4456 (TVA deductible) -- montant TVA total
   - **Credit** : Compte 401 (Fournisseurs) -- montant TTC total

4. **Controles specifiques :**
   - Verifier les taux de TVA sur chaque ligne de reception (0%, 9%, ou 19%)
   - S'assurer que chaque reception a un fournisseur associe (les receptions internes sans fournisseur sont exclues)
   - Recouper avec les bons de livraison fournisseurs physiques

5. **Archiver :** Conserver pour audit.

---

### Workflow F : Declaration G50 TVA mensuelle

**Objectif :** Preparer les donnees de la declaration mensuelle de TVA (formulaire G50) a deposer avant le 20 du mois suivant.

**Cadre legal :** La declaration G50 est une obligation mensuelle pour les contribuables soumis au regime reel. Elle recapitule la TVA collectee sur les ventes et la TVA deductible sur les achats.

**Etapes :**

1. **Generer les donnees G50 :**
   ```
   GET /accounting/vat/declaration?startDate=2026-02-01&endDate=2026-02-28
   ```

2. **Structure de la reponse du systeme :**
   ```json
   {
     "period": { "start": "2026-02-01", "end": "2026-02-28" },
     "sales": {
       "totalHT": 15000000,
       "totalTVA": 2850000,
       "invoiceCount": 47
     },
     "purchases": {
       "totalHT": 8000000,
       "totalTVA": 1520000,
       "invoiceCount": 12
     },
     "declaration": {
       "tvaCollected": 2850000,
       "tvaDeductible": 1520000,
       "tvaNet": 1330000,
       "tvaPayable": 1330000,
       "tvaCredit": 0
     },
     "generatedAt": "2026-03-02T10:00:00Z"
   }
   ```

3. **Interpreter les resultats :**
   - `tvaCollected` : TVA facturee aux clients (compte 4457)
   - `tvaDeductible` : TVA payee aux fournisseurs (compte 4456)
   - `tvaNet` = `tvaCollected` - `tvaDeductible`
   - Si `tvaNet > 0` : montant a reverser au Tresor public (`tvaPayable`)
   - Si `tvaNet < 0` : credit de TVA reportable (`tvaCredit`)

4. **Convertir les centimes en dinars :** Diviser tous les montants par 100 pour obtenir les valeurs en DA.
   - Exemple : `tvaPayable = 1330000` centimes = **13 300,00 DA**

5. **Reporter sur le formulaire G50 :**
   - Section "Chiffre d'affaires imposable" : `sales.totalHT / 100`
   - Section "TVA collectee" : `declaration.tvaCollected / 100`
   - Section "TVA deductible" : `declaration.tvaDeductible / 100`
   - Section "TVA nette a payer" : `declaration.tvaPayable / 100`

6. **Deposer la declaration :** Avant le 20 du mois suivant aupres du Centre des Impots (CDI) dont depend la fromagerie.

---

### Workflow G : Export comptable PC Compta / Sage

**Objectif :** Produire les fichiers CSV d'import pour les logiciels comptables PC Compta et Sage.

**Etapes pour PC Compta :**

1. **Generer l'export :**
   ```
   GET /accounting/export/pccompta?startDate=2026-02-01&endDate=2026-02-28&journalType=ALL
   ```

2. **Format du fichier CSV :**
   ```
   DATE;JOURNAL;PIECE;COMPTE;LIBELLE;DEBIT;CREDIT;TIERS
   24/02/2026;VE;1;411;Vente F-260224-001 - Laiterie du Sud;3500.00;;CLI-001
   24/02/2026;VE;1;701;Vente F-260224-001 - Laiterie du Sud;;2941.18;
   24/02/2026;VE;1;4457;Vente F-260224-001 - Laiterie du Sud;;558.82;
   ```

3. **Codes journal utilises :**
   - `VE` : Journal des Ventes (comptes classe 7)
   - `AC` : Journal des Achats (comptes classe 6)
   - `OD` : Operations Diverses (comptes classe 4)

4. **Le parametre `journalType` accepte :** `SALES`, `PURCHASES`, `PRODUCTION`, `ALL` (defaut)

**Etapes pour Sage :**

1. **Generer l'export :**
   ```
   GET /accounting/export/sage?startDate=2026-02-01&endDate=2026-02-28&journalType=ALL
   ```

2. **Format du fichier CSV Sage (FEC-compatible) :**
   ```
   JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit;Lettrage;DateLettrage;ValidDate;Montantdevise;Idevise
   VE;Journal des Ventes;000001;20260224;411;Clients;F-260224-001;20260224;Vente F-260224-001;3500,00;;;...;20260224;;DZD
   ```

3. **Particularites du format Sage :**
   - Separateur decimal : virgule (`,`) au lieu du point
   - Date au format `YYYYMMDD` (sans separateurs)
   - Devise : `DZD` (Dinar Algerien)
   - Numero d'ecriture sur 6 chiffres, padde avec des zeros

4. **Importer dans le logiciel cible :** Ouvrir le fichier CSV dans PC Compta ou Sage et lancer l'assistant d'importation.

---

### Workflow H : Historique client et analyse des ventes

**Objectif :** Analyser l'historique de facturation d'un client specifique.

**Etapes :**

1. **Consulter la fiche client :**
   ```
   GET /clients/:id
   ```
   Le systeme retourne les 10 dernieres factures et les 10 dernieres livraisons.

2. **Consulter les factures par client :**
   ```
   GET /invoices?clientId=5
   ```
   Filtre toutes les factures (tous statuts) pour un client donne.

3. **Filtrer par statut :**
   ```
   GET /invoices?clientId=5&status=PAID
   ```
   Obtenir uniquement les factures payees pour ce client.

4. **Obtenir le rapport global des ventes :**
   ```
   GET /reports/sales?startDate=2026-01-01&endDate=2026-12-31
   ```

5. **Exporter en Excel pour analyse approfondie :**
   ```
   GET /reports/export/excel?type=sales&startDate=2026-01-01&endDate=2026-12-31
   ```

6. **Analyse :**
   - Identifier les clients a fort volume de commande
   - Detecter les clients avec factures `CANCELLED` recurrentes (risque de litiges)
   - Evaluer la saisonnalite des ventes par type de client

---

### Workflow I : Valorisation du stock (bilan)

**Objectif :** Obtenir la valeur comptable du stock de produits finis et de matieres premieres pour le bilan.

**Methode de valorisation :** FIFO (First In, First Out) -- le systeme utilise le coût du lot le plus ancien pour valoriser le stock.

**Etapes :**

1. **Valeur du stock produits finis :**
   ```
   GET /stock/value
   ```
   Retourne la valeur totale du stock PF basee sur les coûts de production par lot.

2. **Rapport detaille de valorisation :**
   ```
   GET /reports/stock/valorization
   ```
   Retourne le detail par produit : quantite en stock, coût unitaire moyen (FIFO), valeur totale.

3. **Stock matieres premieres avec valorisation :**
   ```
   GET /stock/mp
   ```
   Le role ADMIN recoit les donnees financieres completes (`priceHt`, `stockValue`). Les roles operationnels (PRODUCTION) ne voient que les quantites.

4. **Stock produits finis avec valorisation :**
   ```
   GET /stock/pf
   ```
   Meme logique : les donnees financieres sont visibles uniquement pour les roles ADMIN et APPRO.

5. **Controle comptable :**
   - Comparer la valeur totale du stock avec le solde du compte 35 (Stock PF) et du compte 31 (Stock MP)
   - L'ecart doit etre inferieur a 1% ; au-dela, investiguer les mouvements anormaux

---

## 3. SCENARIOS REELS

### Scenario 1 : Cloture mensuelle complete (mois de janvier 2026)

**Contexte :** Le 3 fevrier 2026, le Responsable Comptabilite procede a la cloture du mois de janvier.

**Deroulement :**

1. **Verification des factures en attente :**
   - `GET /invoices?status=DRAFT` pour identifier les factures encore en brouillon
   - Resultat : 3 factures DRAFT datees de janvier
   - Action : Contacter le service commercial pour confirmer le statut de ces factures. Deux sont payees (passage a `PAID`), une est annulee (`CANCELLED`)

2. **Generation du journal des ventes :**
   - `GET /accounting/journal/sales?startDate=2026-01-01&endDate=2026-01-31`
   - Resultat : 52 ecritures correspondant aux 52 factures payees du mois
   - Controle : Somme des debits 411 = Somme des credits (701 + 4457 + 6411) pour chaque ecriture

3. **Generation du journal des achats :**
   - `GET /accounting/journal/purchases?startDate=2026-01-01&endDate=2026-01-31`
   - Resultat : 8 ecritures correspondant aux 8 receptions validees
   - Controle : Verification des taux de TVA (certaines matieres premieres a 9%, d'autres a 19%)

4. **Generation du journal de production :**
   - `GET /accounting/journal/production?startDate=2026-01-01&endDate=2026-01-31`
   - Controle : Verification de la coherence entre la consommation de MP (credit compte 31) et l'entree en stock PF (debit compte 35)

5. **Preparation de la declaration G50 :**
   - `GET /accounting/vat/declaration?startDate=2026-01-01&endDate=2026-01-31`
   - TVA collectee : 456 000 DA, TVA deductible : 198 000 DA
   - TVA nette a payer : 258 000 DA
   - Reporter les montants sur le formulaire G50 papier ou electronique

6. **Exports comptables :**
   - Export PC Compta : `GET /accounting/export/pccompta?startDate=2026-01-01&endDate=2026-01-31`
   - Import dans PC Compta, verification des soldes

7. **Valorisation du stock :**
   - `GET /stock/value` pour le stock PF
   - `GET /reports/stock/valorization` pour le detail
   - Comparaison avec le mois precedent, analyse des ecarts

8. **Archivage :** Sauvegarder tous les exports et rapports dans le dossier de cloture mensuelle.

---

### Scenario 2 : Erreur sur une facture a corriger

**Contexte :** Une facture `F-260215-003` a ete creee avec un mauvais prix unitaire. La facture est encore au statut `DRAFT`.

**Deroulement :**

1. **Si la facture est encore DRAFT :**
   - Le service commercial peut modifier la facture ou la supprimer et en recreer une
   - Verifier le statut : `GET /invoices/:id` -- confirmer `status: "DRAFT"`
   - Solution : Annuler la facture (`PUT /invoices/:id/status` avec `{ "status": "CANCELLED" }`)
   - Creer une nouvelle facture correcte (`POST /invoices`)

2. **Si la facture est deja PAID (cas critique) :**
   - Il est IMPOSSIBLE de modifier ou annuler une facture payee
   - Solution : Creer une facture d'avoir (facture avec montant negatif ou facture specifique d'annulation)
   - Creer ensuite une nouvelle facture avec les montants corrects
   - Documenter la raison de la correction dans le dossier comptable

3. **Actions post-correction :**
   - Regenerer le journal des ventes pour la periode concernee
   - Verifier que la declaration G50 du mois n'est pas impactee (si deja deposee, deposer une declaration rectificative)

---

### Scenario 3 : Controle fiscal

**Contexte :** L'administration fiscale notifie un controle portant sur l'exercice 2025.

**Preparation :**

1. **Rassembler les journaux comptables :**
   - Pour chaque mois de 2025 (janvier a decembre), generer :
     - Journal des ventes : `GET /accounting/journal/sales?startDate=2025-MM-01&endDate=2025-MM-30`
     - Journal des achats : `GET /accounting/journal/purchases?startDate=2025-MM-01&endDate=2025-MM-30`
     - Journal de production : `GET /accounting/journal/production?startDate=2025-MM-01&endDate=2025-MM-30`

2. **Generer les exports au format Sage :**
   - Un export par mois ou un export annuel complet
   - Le format Sage est proche du FEC (Fichier des Ecritures Comptables) exige par l'administration

3. **Verifier la coherence des declarations G50 :**
   - Pour chaque mois, regenerer les donnees G50
   - Comparer avec les declarations effectivement deposees
   - Identifier et documenter tout ecart

4. **Verifier le fichier clients :**
   - `GET /clients` et verifier que tous les clients ont un NIF valide (15 chiffres)
   - Les factures sans NIF client valide constituent un risque fiscal majeur

5. **Preparer les justificatifs :**
   - Exporter les factures PDF pour toute facture susceptible d'etre verifiee
   - S'assurer que chaque facture est liee a un bon de livraison (module Delivery)

---

### Scenario 4 : Reconciliation stock / comptabilite

**Contexte :** A la cloture trimestrielle, le solde du compte 35 (Stock PF) dans le logiciel comptable ne correspond pas a la valorisation affichee par l'ERP.

**Deroulement :**

1. **Obtenir la valeur stock ERP :**
   - `GET /stock/value` -- valeur totale PF dans l'ERP
   - `GET /reports/stock/valorization` -- detail par produit

2. **Obtenir le solde comptable :**
   - Exporter le grand livre du compte 35 depuis PC Compta ou Sage
   - Calculer le solde (debit - credit)

3. **Analyser les ecarts :**
   - Verifier les ecritures de production (debit 35, credit 72) dans le journal de production
   - Verifier les ecritures de vente (implicitement, la sortie de stock PF lors des livraisons)
   - Identifier les ajustements d'inventaire eventuels (`POST /stock/pf/inventory`)
   - Verifier les declarations de pertes (`POST /stock/loss`)

4. **Corriger :**
   - Si l'ecart provient d'ecritures manquantes, les saisir dans le logiciel comptable
   - Si l'ecart provient d'un ajustement d'inventaire non comptabilise, passer l'ecriture comptable correspondante
   - Documenter la reconciliation

---

### Scenario 5 : Client avec impayes

**Contexte :** Le client `CLI-015` a plusieurs factures restees au statut `DRAFT` depuis plus de 30 jours.

**Deroulement :**

1. **Identifier les factures impayees :**
   - `GET /invoices?clientId=15&status=DRAFT`
   - Lister les factures et leurs dates

2. **Consulter l'historique du client :**
   - `GET /clients/15` -- voir les 10 dernieres factures et livraisons
   - Evaluer le volume d'activite et l'anciennete du client

3. **Relance :**
   - Transmettre la liste des factures en attente au service commercial pour relance
   - Documenter les dates de relance

4. **Decision :**
   - Si le paiement est confirme : passage a `PAID` via `PUT /invoices/:id/status`
   - Si le client refuse ou est insolvable : passage a `CANCELLED` pour les factures contestees
   - Dans les deux cas, mettre a jour le rapport de ventes et la declaration G50 si necessaire

5. **Mesure preventive :**
   - Evaluer la mise en place d'un plafond de credit par client
   - Signaler les clients a risque a la direction

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Oublier le timbre fiscal pour les paiements en especes

**Description :** L'operateur selectionne le mode de paiement `ESPECES` mais oublie de verifier que le systeme a bien ajoute les 50 DA de timbre fiscal.

**Impact :** Sous-facturation de 50 DA et non-conformite fiscale.

**Prevention dans Manchengo ERP :** Le systeme ajoute automatiquement le timbre fiscal (`timbreFiscal = 5000` centimes) lorsque `paymentMethod = 'ESPECES'`. Le risque residuel est de mal selectionner le mode de paiement.

**Bonne pratique :** Toujours verifier le montant "Net a Payer" avant validation. Si le client paie en especes, le net a payer doit etre superieur au TTC de 50 DA exactement.

---

### Erreur 2 : Creer un client sans identifiants fiscaux complets

**Description :** Un client est enregistre avec un NIF vide ou incorrect, un RC manquant, ou un AI absent.

**Impact :** Les factures emises a ce client sont non conformes fiscalement. En cas de controle, des penalites peuvent s'appliquer.

**Prevention :** Le systeme accepte un NIF vide par defaut (champ `@default("")`), mais le Responsable Comptabilite doit systematiquement verifier que les champs NIF (15 chiffres), RC et AI (3-20 caracteres) sont correctement renseignes avant d'emettre la premiere facture.

**Bonne pratique :** Implementer une verification systematique : `GET /clients` puis filtrer ceux dont NIF, RC ou AI sont vides.

---

### Erreur 3 : Valider une facture comme PAID sans paiement reel

**Description :** L'operateur passe une facture de `DRAFT` a `PAID` alors que le paiement n'a pas encore ete encaisse.

**Impact :** La facture est comptabilisee comme un revenu dans le journal des ventes et dans la declaration G50, alors que le flux de tresorerie n'a pas eu lieu. Impossibilite de revenir en arriere.

**Prevention :** Mettre en place un processus de double validation : le commercial confirme la reception du paiement, le comptable valide dans l'ERP.

---

### Erreur 4 : Confondre les montants en centimes et en dinars

**Description :** L'operateur saisit un prix unitaire de 450 DA en ecrivant `450` au lieu de `45000` (centimes).

**Impact :** La facture est sous-evaluee d'un facteur 100. Le chiffre d'affaires et la TVA sont faux.

**Prevention :** Tous les montants dans Manchengo ERP sont stockes en centimes (entiers). Il faut systematiquement multiplier par 100 a la saisie et diviser par 100 a l'affichage. Le systeme devrait afficher les montants en DA dans l'interface, avec la conversion automatique.

**Bonne pratique :** Verifier le montant "Net a Payer" en dinars avant toute validation.

---

### Erreur 5 : Generer la declaration G50 sur une mauvaise periode

**Description :** L'operateur se trompe dans les dates de debut et de fin, incluant des jours du mois precedent ou suivant.

**Impact :** La declaration G50 est fausse, ce qui peut entrainer un redressement fiscal.

**Prevention :** Utiliser systematiquement les dates canoniques du mois : `YYYY-MM-01` a `YYYY-MM-28/29/30/31`. Verifier que le nombre de jours couvre exactement le mois concerne.

---

### Erreur 6 : Exporter le journal avec le mauvais type (SALES au lieu de ALL)

**Description :** Lors de l'export PC Compta ou Sage, l'operateur selectionne `journalType=SALES` au lieu de `ALL`, omettant ainsi les achats et la production.

**Impact :** Le logiciel comptable ne recoit qu'une partie des ecritures. Les soldes des comptes sont faux.

**Prevention :** Pour la cloture mensuelle, toujours utiliser `journalType=ALL`. N'utiliser un type specifique que pour des verifications ponctuelles.

---

### Erreur 7 : Supprimer un client qui a des factures associees

**Description :** L'operateur tente de supprimer un client via `DELETE /clients/:id`.

**Impact :** Le systeme bloque la suppression si le client a des factures ou des livraisons liees (`ConflictException`). Cependant, l'operateur peut perdre du temps a chercher pourquoi la suppression echoue.

**Prevention :** Avant toute suppression, consulter `GET /clients/:id` et verifier les compteurs (`_count.invoices`, `_count.deliveries`). Si non nuls, la suppression est impossible.

---

### Erreur 8 : Ne pas archiver les exports mensuels

**Description :** Les fichiers CSV d'export PC Compta ou Sage ne sont pas sauvegardes apres import dans le logiciel comptable.

**Impact :** En cas de controle fiscal ou de besoin de re-import, les donnees doivent etre regenerees, avec le risque que les donnees source aient ete modifiees entre-temps.

**Prevention :** Etablir une procedure d'archivage systematique : chaque export est date et stocke dans un repertoire dedie (`/compta/exports/YYYY-MM/`).

---

### Erreur 9 : Creer plusieurs factures pour la meme livraison

**Description :** En cas de doublon de saisie, deux factures sont creees pour une meme vente.

**Impact :** Le chiffre d'affaires est surestime, la TVA collectee est trop elevee, et le client recoit deux demandes de paiement.

**Prevention :** Avant de creer une facture, verifier les factures recentes du client (`GET /invoices?clientId=X`) pour detecter les doublons potentiels.

---

### Erreur 10 : Ignorer les factures CANCELLED dans le suivi

**Description :** Les factures annulees ne sont pas documentees ni analysees.

**Impact :** Un taux eleve de factures annulees peut masquer des problemes operationnels (erreurs de livraison, litiges clients, erreurs de saisie).

**Prevention :** Inclure un indicateur "taux d'annulation" dans le tableau de bord mensuel. Analyser les raisons d'annulation et mettre en place des actions correctives.

---

## 5. RISQUES METIER CRITIQUES

### 5.1 Risques fiscaux

| Risque | Gravite | Probabilite | Impact financier | Mitigation |
|---|---|---|---|---|
| Declaration G50 en retard (apres le 20) | CRITIQUE | Moyenne | Penalites de retard (10% + 3% par mois) | Checklist mensuelle avec rappel au J+5 |
| TVA collectee sous-declaree | CRITIQUE | Faible | Redressement + majorations (25-100%) | Double controle journal ventes vs G50 |
| Factures sans NIF client | ELEVE | Moyenne | Rejet des charges par le fisc pour le client | Verification systematique a la creation client |
| Timbre fiscal non applique sur especes | MOYEN | Faible | Penalite forfaitaire + mise en conformite | Automatisme systeme (calcul auto dans le code) |
| Factures non numerotees sequentiellement | ELEVE | Faible | Presomption de dissimulation de ventes | Format auto `F-YYMMDD-NNN` (garanti par le systeme) |

### 5.2 Risques operationnels

| Risque | Gravite | Mitigation |
|---|---|---|
| Perte de donnees (crash serveur) | CRITIQUE | Backups automatiques PostgreSQL + archivage exports mensuels |
| Passage errone DRAFT vers PAID | ELEVE | Processus de double validation (commercial + comptable) |
| Ecart stock comptable vs physique | MOYEN | Reconciliation mensuelle (Workflow I) |
| Acces non autorise aux donnees financieres | ELEVE | Role ADMIN restreint, audit log systeme |
| Indisponibilite du systeme en fin de mois | MOYEN | Planifier les clotures entre J+1 et J+5, pas le dernier jour |

### 5.3 Risques legaux specifiques a l'agroalimentaire

| Risque | Mitigation |
|---|---|
| Non-conformite tracabilite lot/facture | Lier chaque facture aux lots de produits finis via le module Production |
| Valorisation stock non conforme aux normes SCF | Methode FIFO implementee dans le systeme, auditable |
| Absence de piece justificative | Chaque facture genere un PDF avec tous les champs reglementaires |

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist QUOTIDIENNE

| # | Tache | Verification | Fait |
|---|---|---|---|
| Q1 | Consulter les factures DRAFT du jour | `GET /invoices?status=DRAFT` | [ ] |
| Q2 | Valider les factures dont le paiement est confirme | `PUT /invoices/:id/status` vers PAID | [ ] |
| Q3 | Verifier la coherence des montants (centimes vs DA) | Controle visuel sur les factures creees | [ ] |
| Q4 | Verifier les KPIs du dashboard | `GET /dashboard/kpis` | [ ] |
| Q5 | Archiver les PDF des factures validees | Sauvegarde locale ou cloud | [ ] |

### 6.2 Checklist HEBDOMADAIRE

| # | Tache | Verification | Fait |
|---|---|---|---|
| H1 | Revue des factures CANCELLED de la semaine | `GET /invoices?status=CANCELLED`, analyser les causes | [ ] |
| H2 | Verifier la completude des fiches clients | NIF, RC, AI renseignes pour tous les clients actifs | [ ] |
| H3 | Rapprocher les encaissements avec les factures PAID | Croisement tresorerie / journal ventes | [ ] |
| H4 | Consulter le rapport des ventes | `GET /reports/sales` | [ ] |
| H5 | Verifier les alertes stock | `GET /stock/alerts` -- impact sur la facturation future | [ ] |

### 6.3 Checklist MENSUELLE (cloture)

| # | Tache | Date limite | Verification | Fait |
|---|---|---|---|---|
| M1 | Solder toutes les factures DRAFT du mois | J+3 | Aucune facture DRAFT du mois precedent | [ ] |
| M2 | Generer le journal des ventes | J+3 | `GET /accounting/journal/sales` | [ ] |
| M3 | Generer le journal des achats | J+3 | `GET /accounting/journal/purchases` | [ ] |
| M4 | Generer le journal de production | J+3 | `GET /accounting/journal/production` | [ ] |
| M5 | Verifier l'equilibre debit/credit de chaque journal | J+4 | Somme debits = Somme credits | [ ] |
| M6 | Generer la declaration G50 | J+5 | `GET /accounting/vat/declaration` | [ ] |
| M7 | Deposer la declaration G50 | J+20 max | Depot aupres du CDI | [ ] |
| M8 | Exporter vers PC Compta / Sage | J+5 | `GET /accounting/export/pccompta` ou `/sage` | [ ] |
| M9 | Importer dans le logiciel comptable | J+7 | Verification des soldes post-import | [ ] |
| M10 | Reconciliation stock comptable vs ERP | J+10 | `GET /stock/value` vs solde compte 35 | [ ] |
| M11 | Archiver tous les exports et rapports | J+10 | Dossier `/compta/YYYY-MM/` | [ ] |
| M12 | Rapport mensuel a la direction | J+15 | Synthese CA, TVA, marges, ecarts | [ ] |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Prise en main de l'interface Comptabilite (Duree estimee : 12 minutes)

**Titre :** "Decouvrir le module Comptabilite de Manchengo Smart ERP"

**Plan du script :**

*Sequence 1 (0:00 - 2:00) -- Introduction*
- Presenter le role du Responsable Comptabilite dans Manchengo Smart ERP
- Expliquer le perimetre d'acces ADMIN (facturation, journaux, declarations, exports)
- Montrer le dashboard avec les KPIs financiers (`GET /dashboard/kpis`)

*Sequence 2 (2:00 - 5:00) -- Navigation dans le module Facturation*
- Acceder a la liste des factures
- Expliquer les filtres : par statut (DRAFT, PAID, CANCELLED), par client
- Ouvrir une facture et decrire chaque champ : reference, client, lignes, totaux, mode de paiement
- Montrer le code couleur des statuts

*Sequence 3 (5:00 - 8:00) -- Navigation dans le module Clients*
- Acceder a la liste des clients
- Expliquer les types de clients (DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD)
- Montrer les champs fiscaux obligatoires : NIF, RC, AI, NIS
- Montrer le compteur de factures et livraisons par client

*Sequence 4 (8:00 - 12:00) -- Navigation dans le module Comptabilite*
- Acceder aux journaux (ventes, achats, production)
- Expliquer la structure d'une ecriture comptable (date, reference, debit, credit)
- Montrer les exports PC Compta et Sage
- Montrer la declaration G50

---

### Module 2 : Creer et valider une facture (Duree estimee : 15 minutes)

**Titre :** "Facturation conforme : de la creation au paiement"

**Plan du script :**

*Sequence 1 (0:00 - 3:00) -- Pre-requis*
- Verifier que le client existe et que ses identifiants fiscaux sont complets
- Montrer comment creer un client si necessaire (`POST /clients`)
- Insister sur l'importance du NIF a 15 chiffres

*Sequence 2 (3:00 - 8:00) -- Creation pas-a-pas*
- Selectionner le client
- Saisir la date (format YYYY-MM-DD)
- Choisir le mode de paiement (montrer l'impact du timbre fiscal pour ESPECES)
- Ajouter les lignes de produits (saisie en centimes)
- Montrer le calcul automatique : totalHt, totalTva (19%), totalTtc, timbreFiscal, netToPay
- Montrer la generation automatique de la reference F-YYMMDD-NNN

*Sequence 3 (8:00 - 11:00) -- Validation*
- Verifier le recapitulatif
- Montrer la facture en statut DRAFT
- Expliquer les possibilites de modification avant validation

*Sequence 4 (11:00 - 15:00) -- Cycle de vie*
- Passer la facture de DRAFT a PAID
- Montrer l'irreversibilite de la transition
- Montrer comment annuler une facture DRAFT
- Expliquer la procedure en cas d'erreur sur une facture PAID (facture d'avoir)

---

### Module 3 : Cloture mensuelle complete (Duree estimee : 20 minutes)

**Titre :** "La cloture mensuelle pas-a-pas : du journal a la G50"

**Plan du script :**

*Sequence 1 (0:00 - 3:00) -- Preparation*
- Verifier les factures DRAFT restantes du mois
- Solder ou annuler les factures en attente
- Verifier la coherence des dates

*Sequence 2 (3:00 - 8:00) -- Generation des journaux*
- Journal des ventes : parametres, lecture des ecritures, controles
- Journal des achats : parametres, verifier les taux de TVA, controles
- Journal de production : parametres, verifier variation de stock

*Sequence 3 (8:00 - 13:00) -- Declaration G50*
- Generer les donnees G50
- Interpreter les champs : TVA collectee, TVA deductible, TVA nette
- Convertir les centimes en dinars
- Reporter sur le formulaire officiel
- Rappeler la date limite (20 du mois suivant)

*Sequence 4 (13:00 - 17:00) -- Exports comptables*
- Export PC Compta : parametres, format CSV, import
- Export Sage : particularites (virgule decimale, date YYYYMMDD, devise DZD)
- Verification post-import dans le logiciel comptable

*Sequence 5 (17:00 - 20:00) -- Reconciliation et archivage*
- Valorisation du stock vs soldes comptables
- Archivage des fichiers du mois
- Rapport a la direction

---

### Module 4 : Gestion des clients et conformite fiscale (Duree estimee : 10 minutes)

**Titre :** "Fichier clients : les exigences fiscales algeriennes"

**Plan du script :**

*Sequence 1 (0:00 - 3:00) -- Reglementation*
- Les identifiants fiscaux obligatoires en Algerie : NIF, RC, AI
- Le NIS (optionnel mais recommande)
- Consequences d'une fiche client incomplete en cas de controle fiscal

*Sequence 2 (3:00 - 6:00) -- Gestion dans l'ERP*
- Creer un client complet (`POST /clients`)
- Modifier les identifiants fiscaux d'un client existant (`PUT /clients/:id`)
- Verifier la completude du fichier client (`GET /clients`)

*Sequence 3 (6:00 - 8:00) -- Types de clients*
- DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD
- Impact sur la politique commerciale et tarifaire
- Analyse par type via les rapports de ventes

*Sequence 4 (8:00 - 10:00) -- Historique et suivi*
- Consulter les factures d'un client
- Detecter les impayes
- Relances et procedures de recouvrement

---

### Module 5 : Preparation a un controle fiscal (Duree estimee : 15 minutes)

**Titre :** "Anticiper et repondre a un controle fiscal avec Manchengo ERP"

**Plan du script :**

*Sequence 1 (0:00 - 4:00) -- Que controle l'administration fiscale ?*
- Coherence chiffre d'affaires declare vs journaux de vente
- Conformite des factures (NIF, RC, AI, numerotation sequentielle)
- Declarations G50 vs ecritures comptables
- Valorisation du stock

*Sequence 2 (4:00 - 9:00) -- Generer les pieces justificatives*
- Exports comptables (Sage format FEC-compatible)
- Journaux de vente, achat, production mois par mois
- Declarations G50 regenerees pour verification
- PDF des factures individuelles

*Sequence 3 (9:00 - 12:00) -- Points de vigilance*
- Verifier la numerotation sequentielle des factures (pas de trous)
- Verifier que toutes les factures PAID sont dans les journaux
- Verifier que les factures CANCELLED sont documentees
- S'assurer de la coherence entre stock physique et comptable

*Sequence 4 (12:00 - 15:00) -- Bonnes pratiques permanentes*
- Archivage mensuel systematique
- Double controle des declarations avant depot
- Maintien a jour du fichier clients
- Documentation des ecarts et corrections

---

## 8. MATRICE RACI

Legende : **R** = Responsable (execute), **A** = Accountable (decide), **C** = Consulte, **I** = Informe

| Activite | Resp. Compta (ADMIN) | Commercial | Appro | Production | Direction |
|---|---|---|---|---|---|
| **Creation facture** | R/A | R | I | - | I |
| **Validation facture PAID** | R/A | C | - | - | I |
| **Annulation facture** | R/A | C | - | - | I |
| **Creation client** | R/A | C | - | - | I |
| **Verification NIF/RC/AI** | R/A | C | - | - | - |
| **Journal des ventes** | R/A | I | - | - | I |
| **Journal des achats** | R/A | - | C | - | I |
| **Journal de production** | R/A | - | - | C | I |
| **Declaration G50** | R/A | - | - | - | A |
| **Export PC Compta / Sage** | R/A | - | - | - | I |
| **Reconciliation stock** | R/A | - | C | C | I |
| **Valorisation stock bilan** | R/A | - | C | - | A |
| **Rapport mensuel finances** | R | - | - | - | A |
| **Archivage pieces comptables** | R/A | - | - | - | I |
| **Preparation controle fiscal** | R/A | C | C | C | A |
| **Gestion des impayes** | C | R | - | - | A |
| **Politique tarifaire** | C | R | - | - | A |
| **Receptions fournisseurs** | I | - | R/A | - | - |
| **Cloture production** | I | - | - | R/A | I |

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 : Initial (Mois 1-2)

**Caracteristiques :**
- Le Responsable Comptabilite decouvre le systeme
- Les factures sont creees manuellement, une par une
- Les exports comptables sont generes a la demande, sans processus etabli
- La declaration G50 est preparee tard dans le mois

**Actions :**
- Suivre les 5 modules de formation video
- Etablir la checklist quotidienne
- Verifier la completude du fichier clients (NIF, RC, AI)

**Criteres de passage au niveau 2 :**
- Toutes les factures du mois sont soldees avant J+5
- La declaration G50 est deposee avant le 20

---

### Niveau 2 : Defini (Mois 3-4)

**Caracteristiques :**
- Le processus de cloture mensuelle est formalise
- Les checklists quotidienne, hebdomadaire et mensuelle sont suivies
- Les exports comptables sont realises systematiquement
- Les controles de coherence sont effectues (debit = credit)

**Actions :**
- Mettre en place la reconciliation stock/comptabilite mensuelle
- Documenter les procedures de correction d'erreur
- Former un backup (deuxieme personne habilitee)

**Criteres de passage au niveau 3 :**
- Zero ecart debit/credit sur les journaux
- Reconciliation stock realisee chaque mois avec ecart < 2%
- Archives mensuelles completes

---

### Niveau 3 : Maitrise (Mois 5-8)

**Caracteristiques :**
- Le processus de cloture est fluide et respecte les delais
- Les ecarts stock/comptabilite sont < 1%
- Les anomalies (factures CANCELLED, doublons) sont detectees proactivement
- Le taux de clients avec identifiants fiscaux complets est de 100%

**Actions :**
- Analyser les tendances (CA par client, par produit, saisonnalite)
- Optimiser les delais de facturation (objectif < 24h apres livraison)
- Preparer un dossier permanent pour controle fiscal

**Criteres de passage au niveau 4 :**
- Delai moyen de facturation < 24h
- Cloture mensuelle finalisee avant J+7
- Taux d'annulation factures < 2%

---

### Niveau 4 : Optimise (Mois 9-12)

**Caracteristiques :**
- Le processus comptable est quasi-automatise
- Les rapports sont generes automatiquement et envoyes a la direction
- L'analyse predictive est utilisee (tendances de ventes, saisonnalite)
- La reconciliation stock est un controle de routine sans surprise

**Actions :**
- Mettre en place des alertes automatiques (factures DRAFT > 7 jours, ecart stock > seuil)
- Integrer les indicateurs comptables dans le dashboard temps reel
- Preparer la certification des comptes annuels

**Criteres de passage au niveau 5 :**
- Cloture mensuelle finalisee avant J+5
- Zero retard de declaration G50 sur 12 mois
- Ecart stock/comptabilite < 0.5%

---

### Niveau 5 : Excellence (Annee 2+)

**Caracteristiques :**
- Le systeme comptable est totalement integre et auditable
- Les exports sont automatises et programmes
- La direction recoit des analyses predictives (previsions de tresorerie, tendances de marge)
- Le dossier de controle fiscal est pret en permanence
- L'ERP est considere comme source de verite unique pour les chiffres financiers

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Court terme (0-3 mois)

1. **Automatiser les rappels de cloture :** Configurer des notifications automatiques a J+1, J+3, J+5 et J+15 pour rappeler les etapes de cloture mensuelle.

2. **Ajouter une validation de NIF :** Implementer un controle de format cote frontend (15 chiffres numeriques exactement) pour le champ NIF lors de la creation ou modification client.

3. **Dashboard comptable dedie :** Creer une vue specifique dans le dashboard pour le Responsable Comptabilite affichant : nombre de factures DRAFT en attente, date de derniere cloture, echeance G50, montant TVA estime du mois.

4. **Rapport des factures DRAFT anciennes :** Ajouter un filtre par anciennete pour identifier les factures en brouillon depuis plus de 7 jours.

### 10.2 Moyen terme (3-6 mois)

5. **Factures d'avoir :** Implementer un type de facture specifique pour les avoirs, permettant de corriger proprement les erreurs sur les factures PAID sans contourner le systeme.

6. **Lettrage automatique :** Ajouter un champ de lettrage dans les exports Sage (champ actuellement vide) pour permettre le rapprochement automatique clients/paiements.

7. **Multi-taux TVA sur factures de vente :** Actuellement la TVA est calculee a un taux unique de 19% sur les factures. Pour les produits pouvant beneficier du taux reduit (9%) ou de l'exoneration (0% export), ajouter un champ `tvaRate` par ligne de facture, similaire au modele `ReceptionMpLine`.

8. **Export FEC complet :** Enrichir l'export Sage pour qu'il soit pleinement conforme au format FEC (Fichier des Ecritures Comptables), facilitant la transmission electronique a l'administration fiscale.

### 10.3 Long terme (6-12 mois)

9. **Declaration G50 electronique :** Integrer la soumission electronique de la declaration G50 via les plateformes de la DGI (Direction Generale des Impots) algerienne, si elles proposent une API.

10. **Previsions de tresorerie :** Utiliser l'historique des ventes (`GET /reports/sales` et `GET /dashboard/charts/sales`) pour generer des previsions de tresorerie sur 3-6 mois.

11. **Audit trail renforcee :** Ajouter un journal d'audit specifique pour toutes les operations comptables (creation facture, changement de statut, export, generation G50) avec horodatage, identifiant utilisateur, et adresse IP.

12. **Integration bancaire :** Connecter le module de paiement avec les flux bancaires pour automatiser le rapprochement entre les virements recus et les factures en attente.

13. **Gestion des devises :** Pour les clients a l'export (TVA 0%), prevoir la gestion multi-devises avec taux de change et conversion en DZD.

---

## 11. GLOSSAIRE METIER

### Termes comptables algeriens

| Terme | Definition |
|---|---|
| **AI** | Article d'Imposition. Identifiant fiscal attribue par l'administration des impots, obligatoire pour toute personne morale ou physique exercant une activite commerciale. Format : alphanumerique, 3 a 20 caracteres. |
| **CDI** | Centre des Impots. Structure locale de l'administration fiscale aupres de laquelle sont deposees les declarations. |
| **DA** | Dinar Algerien. Unite monetaire officielle de l'Algerie. Code ISO 4217 : DZD. |
| **DGI** | Direction Generale des Impots. Administration centrale en charge de la politique fiscale algerienne. |
| **G50** | Formulaire de declaration mensuelle des impots et taxes (principalement TVA). A deposer avant le 20 du mois suivant la periode declaree. |
| **NIF** | Numero d'Identification Fiscale. Identifiant unique a 15 chiffres attribue a chaque contribuable algerien. Obligatoire sur toutes les factures. |
| **NIS** | Numero d'Identification Statistique. Identifiant attribue par l'ONS (Office National des Statistiques). Optionnel mais recommande. |
| **PCN** | Plan Comptable National. Ancien referentiel comptable algerien, remplace par le SCF. Certains logiciels utilisent encore cette terminologie. |
| **RC** | Registre de Commerce. Document attestant de l'inscription d'une entreprise au registre du commerce. Numero alphanumerique obligatoire. |
| **SCF** | Systeme Comptable Financier. Referentiel comptable algerien en vigueur depuis 2010, aligne sur les normes IAS/IFRS. |
| **Timbre fiscal** | Droit de timbre obligatoire de 50 DA sur toute facture reglee en especes. Ne s'applique pas aux reglements par cheque ou virement. |
| **TVA** | Taxe sur la Valeur Ajoutee. Taux standard : 19%. Taux reduit : 9% (produits de base). Exoneration : 0% (exportations). |

### Termes techniques Manchengo ERP

| Terme | Definition |
|---|---|
| **Centimes (stockage)** | Tous les montants monetaires dans Manchengo ERP sont stockes en centimes (entiers). 1 DA = 100 centimes. Exemple : 450 DA = 45 000 centimes. Cette approche elimine les erreurs d'arrondi des nombres a virgule flottante. |
| **DRAFT** | Statut initial d'une facture. La facture est en brouillon, modifiable et non comptabilisee. |
| **PAID** | Statut d'une facture payee. Transition irreversible depuis DRAFT. Genere un enregistrement Payment et apparait dans le journal des ventes. |
| **CANCELLED** | Statut d'une facture annulee. Transition irreversible depuis DRAFT. Aucune ecriture comptable generee. |
| **FIFO** | First In, First Out. Methode de valorisation du stock : les lots les plus anciens sont consommes en premier. Le cout du stock est base sur le cout d'acquisition des lots restants. |
| **F-YYMMDD-NNN** | Format de reference des factures. F = prefixe fixe, YYMMDD = date, NNN = numero sequentiel du jour. Exemple : F-260224-003 = 3e facture du 24 fevrier 2026. |
| **CLI-NNN** | Format de code client. CLI = prefixe fixe, NNN = numero sequentiel auto-incremente. Exemple : CLI-015. |
| **JournalEntry** | Ecriture comptable generee par le systeme. Comprend une date, une reference, une description et des lignes (debit/credit). |
| **ExportFilters** | Parametres de filtrage pour les exports comptables : startDate, endDate, journalType (SALES, PURCHASES, PRODUCTION, ALL). |
| **PaymentMethod** | Mode de paiement : ESPECES (especes), CHEQUE, VIREMENT. Determine l'application ou non du timbre fiscal. |
| **ClientType** | Type de client : DISTRIBUTEUR, GROSSISTE, SUPERETTE, FAST_FOOD. Classement a des fins d'analyse commerciale. |
| **netToPay** | Montant net a payer par le client. Formule : totalTtc + timbreFiscal. Represente le montant final de la facture. |

---

## 12. ANNEXES

### Annexe A : Plan des comptes SCF utilises dans Manchengo ERP

| Code | Libelle | Classe | Journal | Utilisation |
|---|---|---|---|---|
| **31** | Stock de matieres premieres | 3 - Stocks | Production | Debit a la reception MP, credit a la consommation production |
| **35** | Stock de produits finis | 3 - Stocks | Production | Debit a la cloture production, credit lors de la vente/sortie |
| **401** | Fournisseurs | 4 - Tiers | Achats | Credit lors des receptions (dette fournisseur) |
| **411** | Clients | 4 - Tiers | Ventes | Debit lors de la facturation (creance client) |
| **4456** | TVA deductible | 4 - Tiers | Achats | Debit lors des achats (TVA recuperable) |
| **4457** | TVA collectee | 4 - Tiers | Ventes | Credit lors des ventes (TVA due a l'Etat) |
| **4458** | TVA a payer | 4 - Tiers | OD | Solde a payer au Tresor (4457 - 4456) |
| **512** | Banque | 5 - Tresorerie | Tresorerie | Mouvements bancaires (cheques, virements) |
| **53** | Caisse | 5 - Tresorerie | Tresorerie | Mouvements especes |
| **601** | Achats de matieres premieres | 6 - Charges | Achats | Debit lors des receptions MP |
| **603** | Variation de stock MP | 6 - Charges | Production | Debit lors de la consommation MP en production |
| **61** | Services externes | 6 - Charges | Achats | Charges externes (transport, maintenance...) |
| **6411** | Timbre fiscal | 6 - Charges | Ventes | Credit du timbre fiscal (50 DA) sur factures especes |
| **701** | Ventes de produits finis | 7 - Produits | Ventes | Credit lors de la facturation (chiffre d'affaires) |
| **72** | Production stockee | 7 - Produits | Production | Credit lors de la cloture production |

### Annexe B : Codes journaux comptables

| Code | Libelle | Comptes impactes | Declencheur |
|---|---|---|---|
| **VE** | Journal des Ventes | 411, 701, 4457, 6411 | Facture au statut PAID |
| **AC** | Journal des Achats | 601, 4456, 401 | Reception MP validee (VALIDATED) avec fournisseur |
| **OD** | Operations Diverses | 4456, 4457, 4458 et autres | Ecritures de regularisation, TVA |
| **PR** | Production (implicite) | 35, 72, 603, 31 | Ordre de production COMPLETED |

### Annexe C : Taux de TVA applicables

| Taux | Application | Compte debit (achat) | Compte credit (vente) |
|---|---|---|---|
| **19%** | Taux normal. S'applique a tous les produits fromagers et la majorite des biens et services. | 4456 | 4457 |
| **9%** | Taux reduit. S'applique a certains produits alimentaires de base et matieres premieres specifiques. | 4456 | 4457 |
| **0%** | Exoneration. S'applique aux exportations et a certaines operations specifiques prevues par la loi. | - | - |

**Note importante :** Dans l'implementation actuelle de Manchengo ERP, les factures de vente appliquent un taux unique de 19% (`TVA_RATE = 0.19`). Les lignes de reception MP (`ReceptionMpLine`) supportent les trois taux (champ `tvaRate` : 0, 9, ou 19). L'evolution vers un multi-taux sur les factures de vente est recommandee (voir Section 10, recommandation 7).

### Annexe D : Format de la declaration G50

**Structure des donnees G50 retournees par le systeme :**

```
{
  "period": {
    "start": "Date de debut de la periode declaree",
    "end": "Date de fin de la periode declaree"
  },
  "sales": {
    "totalHT": "CA HT total des factures PAID (en centimes)",
    "totalTVA": "TVA collectee totale (en centimes)",
    "invoiceCount": "Nombre de factures PAID dans la periode"
  },
  "purchases": {
    "totalHT": "Total HT des achats valides (en centimes)",
    "totalTVA": "TVA deductible totale (en centimes)",
    "invoiceCount": "Nombre de receptions validees dans la periode"
  },
  "declaration": {
    "tvaCollected": "TVA collectee = sales.totalTVA",
    "tvaDeductible": "TVA deductible = purchases.totalTVA",
    "tvaNet": "tvaCollected - tvaDeductible",
    "tvaPayable": "Si tvaNet > 0 : montant a reverser au Tresor",
    "tvaCredit": "Si tvaNet < 0 : credit de TVA reportable"
  },
  "generatedAt": "Horodatage de la generation"
}
```

**Correspondance avec le formulaire G50 officiel :**

| Ligne G50 | Champ systeme | Conversion |
|---|---|---|
| Chiffre d'affaires imposable | `sales.totalHT` | Diviser par 100 |
| TVA sur ventes (19%) | `declaration.tvaCollected` | Diviser par 100 |
| TVA deductible sur achats | `declaration.tvaDeductible` | Diviser par 100 |
| TVA nette due | `declaration.tvaPayable` | Diviser par 100 |
| Credit de TVA | `declaration.tvaCredit` | Diviser par 100 |
| Nombre de factures emises | `sales.invoiceCount` | Direct |

### Annexe E : Schema des ecritures comptables type

**Ecriture de vente (facture PAID, paiement ESPECES) :**

| Compte | Libelle | Debit (DA) | Credit (DA) |
|---|---|---|---|
| 411 | Clients | 3 550,00 | |
| 701 | Ventes produits finis | | 2 941,18 |
| 4457 | TVA collectee (19%) | | 558,82 |
| 6411 | Timbre fiscal | | 50,00 |
| **Total** | | **3 550,00** | **3 550,00** |

**Ecriture de vente (facture PAID, paiement VIREMENT) :**

| Compte | Libelle | Debit (DA) | Credit (DA) |
|---|---|---|---|
| 411 | Clients | 3 500,00 | |
| 701 | Ventes produits finis | | 2 941,18 |
| 4457 | TVA collectee (19%) | | 558,82 |
| **Total** | | **3 500,00** | **3 500,00** |

**Ecriture d'achat (reception MP validee, TVA 19%) :**

| Compte | Libelle | Debit (DA) | Credit (DA) |
|---|---|---|---|
| 601 | Achats matieres premieres | 10 000,00 | |
| 4456 | TVA deductible (19%) | 1 900,00 | |
| 401 | Fournisseurs | | 11 900,00 |
| **Total** | | **11 900,00** | **11 900,00** |

**Ecriture de production (cloture ordre de production) :**

| Compte | Libelle | Debit (DA) | Credit (DA) |
|---|---|---|---|
| 35 | Stock produits finis | 8 500,00 | |
| 72 | Production stockee | | 8 500,00 |
| 603 | Variation stock MP | 6 200,00 | |
| 31 | Stock matieres premieres | | 6 200,00 |
| **Total** | | **14 700,00** | **14 700,00** |

### Annexe F : Reference rapide des endpoints API

| Action | Methode | Endpoint | Parametres |
|---|---|---|---|
| Lister les factures | GET | `/invoices` | `?status=DRAFT&clientId=5` |
| Detail facture | GET | `/invoices/:id` | - |
| Creer facture | POST | `/invoices` | Body JSON (voir Workflow A) |
| Changer statut | PUT | `/invoices/:id/status` | `{ "status": "PAID" }` |
| Lister clients | GET | `/clients` | `?type=DISTRIBUTEUR` |
| Detail client | GET | `/clients/:id` | - |
| Creer client | POST | `/clients` | Body JSON (name, type, nif, rc, ai) |
| Modifier client | PUT | `/clients/:id` | Body JSON partiel |
| Journal ventes | GET | `/accounting/journal/sales` | `?startDate=...&endDate=...` |
| Journal achats | GET | `/accounting/journal/purchases` | `?startDate=...&endDate=...` |
| Journal production | GET | `/accounting/journal/production` | `?startDate=...&endDate=...` |
| Export PC Compta | GET | `/accounting/export/pccompta` | `?startDate=...&endDate=...&journalType=ALL` |
| Export Sage | GET | `/accounting/export/sage` | `?startDate=...&endDate=...&journalType=ALL` |
| Declaration G50 | GET | `/accounting/vat/declaration` | `?startDate=...&endDate=...` |
| Rapport ventes | GET | `/reports/sales` | `?startDate=...&endDate=...` |
| Valorisation stock | GET | `/reports/stock/valorization` | - |
| Valeur stock PF | GET | `/stock/value` | - |
| KPIs dashboard | GET | `/dashboard/kpis` | - |
| Graphique ventes | GET | `/dashboard/charts/sales` | `?days=30` |
| Export Excel | GET | `/reports/export/excel` | `?type=sales&startDate=...&endDate=...` |
| Export PDF | GET | `/reports/export/pdf` | `?type=sales&startDate=...&endDate=...` |

### Annexe G : Transitions d'etat autorisees

```
FACTURES :
  DRAFT   --> PAID        [ADMIN uniquement, irreversible]
  DRAFT   --> CANCELLED   [ADMIN uniquement, irreversible]
  PAID    --> (aucune)     [Terminal]
  CANCELLED -> (aucune)    [Terminal]

RECEPTIONS MP (pour le journal achats) :
  PENDING   --> VALIDATED  [Genere les ecritures d'achat]
  PENDING   --> CANCELLED
  VALIDATED --> (aucune)   [Terminal]

ORDRES DE PRODUCTION (pour le journal production) :
  PLANNED   --> IN_PROGRESS
  IN_PROGRESS --> COMPLETED  [Genere les ecritures de production]
  Tout etat --> CANCELLED
```

---

**FIN DU MANUEL**

*Document redige conformement aux standards de documentation ERP professionnelle.*
*Toute modification de la reglementation fiscale algerienne doit entrainer une mise a jour de ce document.*
*Pour toute question technique, contacter l'equipe de developpement Manchengo Smart ERP.*

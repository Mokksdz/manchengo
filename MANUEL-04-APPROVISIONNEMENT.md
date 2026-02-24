# MANUEL UTILISATEUR - MODULE APPROVISIONNEMENT

## MANCHENGO SMART ERP v2.0 - Guide du Responsable Approvisionnement

| Attribut | Valeur |
|---|---|
| **Document** | MANUEL-04-APPROVISIONNEMENT |
| **Version** | 2.0.0 |
| **Classification** | INTERNE - CONFIDENTIEL |
| **Date** | Fevrier 2026 |
| **Redige par** | Direction des Systemes d'Information |
| **Valide par** | Direction Generale |
| **Destinataires** | Responsable Approvisionnement, Equipe APPRO, Formateurs |

---

## TABLE DES MATIERES

1. [Fiche d'identite du role](#1-fiche-didentite-du-role)
2. [Workflow complet (step-by-step)](#2-workflow-complet-step-by-step)
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

### 1.1 Designation

| Champ | Description |
|---|---|
| **Intitule** | Responsable Approvisionnement |
| **Code role RBAC** | `APPRO` |
| **Rattachement hierarchique** | Direction des Operations |
| **Perimetre fonctionnel** | Supply chain amont, stock MP, bons de commande, fournisseurs, alertes |
| **Module ERP** | `/dashboard/appro` |
| **Utilisateurs types** | Responsable approvisionnement, Acheteur, Assistant achats |

### 1.2 Mission principale

Le Responsable Approvisionnement assure la continuite de la production en garantissant la disponibilite des matieres premieres (MP), emballages, additifs et consommables au bon moment, dans les bonnes quantites, au meilleur cout. Il pilote l'ensemble de la chaine d'approvisionnement amont depuis le tableau de bord APPRO du systeme Manchengo Smart ERP.

### 1.3 Droits d'acces RBAC

Le role APPRO dispose des permissions suivantes dans le systeme :

**Acces complet (lecture + ecriture) :**
- Dashboard APPRO : consultation de l'IRS, MP critiques, statistiques, alertes
- Stock MP : consultation de toutes les MP avec etats calcules, modification des seuils et parametres
- Bons de commande : creation directe, envoi, confirmation, reception
- Alertes : consultation, accusation de reception, report avec motif, scan complet
- Suggestions de requisitions : consultation des suggestions automatiques
- Performance fournisseurs : consultation des grades et metriques
- Verification production : lancement du check pre-production

**Acces en lecture seule :**
- Stock MP/PF (module stock general)
- Mouvements de stock
- Rapports : valorisation stock, bons de commande, fournisseurs, mouvements

**Acces refuse :**
- Annulation de BC (reserve au role ADMIN uniquement)
- Recalcul des metriques MP (reserve au role ADMIN)
- Gestion des utilisateurs
- Parametrage systeme
- Facturation et comptabilite

### 1.4 Pages de l'interface web

Le module Approvisionnement est accessible depuis la barre de navigation laterale sous la section "Appro". Les pages disponibles sont :

| Page | URL | Description |
|---|---|---|
| Dashboard APPRO | `/dashboard/appro` | Tableau de bord principal avec IRS, stats, alertes |
| Stock MP | `/dashboard/appro/stock` | Vue complete du stock MP avec etats calcules |
| Bons de Commande | `/dashboard/appro/bons` | Liste des BC avec filtres par statut |
| Nouveau BC | `/dashboard/appro/bons/new` | Formulaire de creation de BC direct |
| Detail BC | `/dashboard/appro/bons/[id]` | Detail complet d'un BC avec historique |
| Reception BC | `/dashboard/appro/bons/[id]/receive` | Formulaire de reception |
| Fournisseurs | `/dashboard/appro/fournisseurs` | Liste des fournisseurs avec grades |
| Detail Fournisseur | `/dashboard/appro/fournisseurs/[id]` | Fiche detaillee fournisseur |
| Nouveau Fournisseur | `/dashboard/appro/fournisseurs/nouveau` | Creation d'un fournisseur |
| Impact Fournisseurs | `/dashboard/appro/fournisseurs/impact` | Analyse d'impact supply chain |
| Alertes | `/dashboard/appro/alertes` | Centre de gestion des alertes APPRO |

### 1.5 Indicateur cle : IRS (Indice de Risque Supply)

L'IRS est l'indicateur synthetique principal du module. Il est affiche en permanence sur le dashboard et se calcule selon la formule suivante :

```
IRS = (nbBloquantesProduction x 30) + (nbRuptures x 20) + (nbSousSeuil x 10)
Borne : [0 - 100]
```

| Plage IRS | Statut | Signification |
|---|---|---|
| 0 - 30 | SAIN | Supply chain maitrisee, pas d'action urgente |
| 31 - 60 | SURVEILLANCE | Risques identifies, actions correctives a planifier |
| 61 - 100 | CRITIQUE | Risque de rupture de production, action immediate requise |

**Interpretation :** Une seule MP bloquante ajoute 30 points a l'IRS. Deux MP en rupture ajoutent 40 points. L'IRS est un outil de pilotage, pas un indicateur de confort : il doit faire mal quand la situation est mauvaise.

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Analyse quotidienne du dashboard APPRO

**Objectif :** Evaluer en 5 minutes l'etat global de la supply chain et identifier les actions prioritaires.

**Prerequis :** Connexion au systeme avec le role APPRO.

**Etapes :**

1. **Acceder au dashboard** : Naviguer vers `/dashboard/appro`. Le systeme appelle `GET /appro/dashboard` et charge automatiquement les donnees.

2. **Lire l'IRS** : En haut du dashboard, l'IRS est affiche avec son statut (SAIN/SURVEILLANCE/CRITIQUE) et le detail decompose :
   - `mpRupture` : nombre de MP en rupture totale (stock = 0)
   - `mpSousSeuil` : nombre de MP sous le seuil de securite
   - `mpCritiquesProduction` : nombre de MP bloquantes pour la production

   **Action si IRS > 60 :** Passer immediatement au traitement des MP critiques.

3. **Examiner les MP critiques production** : Le dashboard affiche le top 5 des MP bloquantes ou a risque, triees par severite puis par jours de couverture croissants. Pour chaque MP, verifier :
   - Son etat (BLOQUANT_PRODUCTION, RUPTURE, A_COMMANDER)
   - Sa criticite effective
   - Ses jours de couverture restants
   - Son fournisseur principal

4. **Consulter les statistiques stock** : Le bloc `stockStats` affiche la repartition de toutes les MP par etat :
   - `total` : nombre total de MP suivies
   - `sain` : MP avec stock superieur au seuil de commande
   - `sousSeuil` : MP sous le seuil de securite
   - `aCommander` : MP sous le seuil de commande
   - `rupture` : MP avec stock = 0
   - `bloquantProduction` : MP bloquantes avec stock insuffisant

5. **Verifier les alertes actives** : Le compteur `alertesActives` indique le nombre d'alertes en cours. Cliquer pour acceder a la page alertes (`/dashboard/appro/alertes`).

6. **Verifier les BC en attente** : Le compteur `bcEnAttente` indique le nombre de BC en statut DRAFT ou SENT qui n'ont pas encore ete receptionnes.

7. **Prendre les decisions** : En fonction de l'analyse :
   - IRS SAIN : routine de verification, consulter les suggestions
   - IRS SURVEILLANCE : traiter les MP A_COMMANDER, verifier les BC en retard
   - IRS CRITIQUE : traiter immediatement les alertes CRITICAL, creer les BC urgents

---

### Workflow B : Creer un bon de commande direct (BC)

**Objectif :** Commander des MP aupres d'un fournisseur sans passer par une demande d'achat prealable.

**Prerequis :** Connaitre le fournisseur cible et les MP a commander.

**Etapes :**

1. **Acceder au formulaire** : Naviguer vers `/dashboard/appro/bons/new`.

2. **Selectionner le fournisseur** : Choisir le fournisseur dans la liste deroulante. Le systeme verifie automatiquement :
   - Que le fournisseur est actif (`isActive = true`)
   - Que le fournisseur n'est pas bloque (`isBlocked = false`)
   - **Blocage :** Si le fournisseur est bloque ou inactif, la creation est refusee.

3. **Ajouter les lignes de commande** : Pour chaque MP a commander :
   - Selectionner la MP (code MP-xxx)
   - Saisir la quantite (doit etre > 0)
   - Saisir le prix unitaire HT en DA (optionnel, peut etre 0)
   - Le total HT de la ligne est calcule automatiquement : `quantite x prix unitaire`

4. **Renseigner la date de livraison prevue** : Saisir la date a laquelle le fournisseur est cense livrer. Ce champ est critique car il sert au calcul des retards.

5. **Ajouter des notes** (optionnel) : Informations complementaires pour le fournisseur ou l'equipe.

6. **Valider la creation** : Le systeme appelle `POST /appro/purchase-orders/create-direct` et :
   - Genere une reference unique au format `BC-YYYY-NNNNN` (ex: `BC-2026-00042`)
   - Cree le BC en statut `DRAFT`
   - Calcule le `totalHT` global
   - Cree un audit log avec l'identite du createur, le fournisseur, le nombre de lignes et le montant

7. **Confirmer** : Un message de succes affiche la reference du BC cree.

**Regles de validation importantes :**
- Au moins une ligne de commande obligatoire
- Quantite strictement positive pour chaque ligne
- Prix unitaire >= 0
- Fournisseur actif et non bloque

---

### Workflow C : Cycle de vie complet d'un BC (DRAFT -> SENT -> CONFIRMED -> RECEIVED)

**Objectif :** Suivre un BC de sa creation jusqu'a la reception complete des marchandises.

#### Etape C.1 : DRAFT -> SENT (Envoi au fournisseur)

1. **Ouvrir le BC** : Naviguer vers `/dashboard/appro/bons/[id]` pour afficher le detail du BC en statut DRAFT.

2. **Choisir le mode d'envoi** : Le systeme propose deux modes :
   - **EMAIL** : Envoi automatique par email au fournisseur. Necessite que le fournisseur ait une adresse email renseignee. Un `messageId` est genere et stocke pour tracabilite.
   - **MANUAL** : Marquage manuel comme envoye. Necessite une note de preuve obligatoire d'au minimum 20 caracteres (ex: "Envoye par fax le 15/02/2026 a 10h30, confirme par telephone").

3. **Fournir la preuve d'envoi** : Selon le mode choisi :
   - Mode EMAIL : l'email du destinataire est pre-rempli depuis la fiche fournisseur. Possibilite de saisir une adresse alternative.
   - Mode MANUAL : saisir la note de preuve (min 20 caracteres) et optionnellement une URL de preuve (scan, photo).

4. **Envoyer** : Le systeme appelle `POST /appro/purchase-orders/:id/send` et :
   - Verifie que le BC est bien en statut DRAFT
   - Passe le statut a SENT
   - Enregistre la date d'envoi, l'expediteur, le mode, la preuve
   - Cree un audit log detaille
   - **Protection idempotence** : si une cle d'idempotence est fournie, le systeme verifie qu'elle n'a pas deja ete utilisee pour eviter les double-envois

**Regle critique : Un BC ne peut JAMAIS passer en SENT sans preuve d'envoi tracable.**

#### Etape C.2 : SENT -> CONFIRMED (Confirmation par le fournisseur)

1. **Attendre la confirmation** : Le fournisseur accuse reception du BC et confirme les quantites et delais.

2. **Enregistrer la confirmation** : Ouvrir le BC en statut SENT et cliquer sur "Confirmer". Le systeme appelle `POST /appro/purchase-orders/:id/confirm` et :
   - Verifie que le BC est en statut SENT
   - Passe le statut a CONFIRMED
   - Enregistre la date de confirmation et l'identite du valideur
   - Cree un audit log

#### Etape C.3 : CONFIRMED -> RECEIVED (Reception complete)

Se referer au Workflow D ci-dessous pour le detail de la reception.

---

### Workflow D : Reception partielle et suivi

**Objectif :** Enregistrer la reception de marchandises, gerer les receptions partielles et les ecarts.

**Prerequis :** Le BC doit etre en statut SENT, CONFIRMED ou PARTIAL.

**Etapes :**

1. **Acceder au formulaire de reception** : Naviguer vers `/dashboard/appro/bons/[id]/receive`.

2. **Renseigner les informations generales** :
   - **Numero de BL fournisseur** (optionnel mais recommande) : reference du bon de livraison du fournisseur
   - **Date de reception** : par defaut la date du jour, modifiable
   - **Notes generales** : observations sur la livraison

3. **Pour chaque ligne du BC**, saisir :
   - **Quantite recue** : la quantite effectivement livree (peut etre 0 si non livree)
   - **Numero de lot** : obligatoire si quantite > 0 (tracabilite alimentaire)
   - **Date d'expiration (DLC)** : obligatoire si quantite > 0 (format YYYY-MM-DD, tracabilite alimentaire)

4. **Valider la reception** : Le systeme appelle `POST /appro/purchase-orders/:id/receive` et execute dans une transaction atomique :
   - **Creation d'une ReceptionMp** avec reference unique au format `REC-YYYYMMDD-NNN`
   - **Pour chaque ligne avec quantite > 0** :
     - Mise a jour de la quantite recue sur la ligne BC
     - Creation d'une ligne de reception avec calcul TVA (taux 0%, 9% ou 19%)
     - Creation d'un lot MP avec numero de lot unique
     - Creation d'un mouvement de stock entrant (IN) avec tracabilite complete
   - **Determination du nouveau statut** :
     - Si toutes les lignes sont entierement recues : statut `RECEIVED`
     - Sinon : statut `PARTIAL`
   - **Audit log** avec detail de la reception

5. **Verification post-reception** :
   - Si statut PARTIAL : planifier le suivi de la reception restante
   - Verifier que les mouvements de stock sont bien enregistres via `/stock/mp/:id/movements`
   - Verifier l'impact sur l'IRS du dashboard

**Protections systeme :**
- **Anti sur-reception** : Le systeme refuse toute reception dont la quantite cumule depasserait la quantite commandee. Erreur explicite : "Sur-reception pour [nom MP] : deja recu X, commande Y, tentative de recevoir Z supplementaires."
- **Lot obligatoire** : Pas de reception sans numero de lot (tracabilite alimentaire)
- **DLC obligatoire** : Pas de reception sans date d'expiration (securite alimentaire)

---

### Workflow E : Gestion des alertes (accuser reception, reporter, scanner)

**Objectif :** Traiter les alertes systeme de maniere structuree et auditable.

**Types d'alertes dans le systeme :**

| Type | Niveau par defaut | Declencheur |
|---|---|---|
| MP_CRITIQUE | CRITICAL | MP BLOQUANTE avec stock = 0 |
| RUPTURE | WARNING | Jours de couverture < lead time fournisseur |
| FOURNISSEUR_RETARD | WARNING ou CRITICAL | Taux de retard > 20% (CRITICAL si > 30%) |
| PRODUCTION_BLOQUEE | CRITICAL | Check-production refuse : MP manquantes |
| DLC_PROCHE | INFO ou WARNING | Lot proche de la date limite de consommation |

#### E.1 : Accuser reception d'une alerte

1. Naviguer vers `/dashboard/appro/alertes`.
2. Le systeme affiche les alertes triees par niveau (CRITICAL en premier) puis par date de creation.
3. Pour chaque alerte, cliquer sur "Accuser reception".
4. Le systeme appelle `POST /appro/alerts/:id/acknowledge` et enregistre :
   - La date d'accusation
   - L'identite de l'utilisateur
   - **REGLE CRITIQUE : Les alertes CRITICAL non accusees DOIVENT etre visibles partout dans le systeme. L'accusation de reception est la preuve que l'utilisateur a pris connaissance du risque.**

#### E.2 : Reporter une alerte MP

1. Identifier l'alerte MP a reporter.
2. Cliquer sur "Reporter" et renseigner :
   - **Duree** : choisir parmi 4h, 12h ou 24h uniquement
   - **Motif** : texte obligatoire d'au minimum 10 caracteres expliquant pourquoi le report est justifie

3. Le systeme appelle `POST /appro/alerts/mp/:mpId/postpone` et applique les regles :
   - **RUPTURE (stock = 0) non reportable** : le systeme refuse avec l'erreur "Les alertes RUPTURE ne peuvent pas etre reportees"
   - **Maximum 2 reports consecutifs** sur 7 jours glissants pour la meme MP. Au-dela, le systeme refuse avec : "Maximum 2 reports consecutifs atteint. Veuillez creer un BC."
   - Un audit log complet est cree (action, utilisateur, date, motif, duree)

#### E.3 : Declencher un scan complet

1. Depuis la page alertes, cliquer sur "Scanner les alertes".
2. Le systeme appelle `POST /appro/alerts/scan` et execute :
   - **Scan MP critiques** : toutes les MP BLOQUANTES ou obligatoires dans des recettes actives avec stock = 0 generent une alerte MP_CRITIQUE
   - **Scan ruptures imminentes** : toutes les MP dont les jours de couverture sont inferieurs au lead time fournisseur generent une alerte RUPTURE
   - **Scan fournisseurs** : tous les fournisseurs actifs avec un taux de retard > 20% generent une alerte FOURNISSEUR_RETARD
3. Le systeme retourne le nombre d'alertes creees par categorie : `{ mpCritiques: N, ruptures: N, fournisseurs: N }`.
4. **Regle de non-duplication** : si une alerte identique (meme type + meme entite) est deja active et non accusee, le systeme ne cree pas de doublon.

#### E.4 : Consulter les compteurs d'alertes

Le endpoint `GET /appro/alerts/counts` retourne un resume structure :
- `total` : nombre total d'alertes
- `critical` / `warning` / `info` : ventilation par niveau
- `unacknowledged` : alertes non accusees
- `criticalUnacknowledged` : alertes CRITICAL non accusees (indicateur le plus important)

---

### Workflow F : Evaluation performance fournisseurs (grade, blocage, surveillance)

**Objectif :** Evaluer et piloter la performance des fournisseurs pour securiser la supply chain.

**Etapes :**

1. **Consulter le classement** : Naviguer vers `/dashboard/appro/fournisseurs` ou appeler `GET /appro/suppliers/performance`.

2. **Lire les metriques de chaque fournisseur** :
   - **Grade** : A (score > 90, fiable), B (score 70-90, acceptable), C (score < 70, a risque)
   - **Score de performance** (0-100) : calcule sur 50% ponctualite + 50% conformite quantite
   - **Delai reel moyen** vs delai annonce : ecart entre le lead time promis et le constate
   - **Taux de retard** : pourcentage de livraisons en retard (tolerance : +1 jour)
   - **Taux d'ecart quantite** : ratio entre quantite livree et commandee
   - **Nombre de MP fournies** : nombre de MP dont ce fournisseur est le principal

3. **Analyser le score de performance** :
   Le score est recalcule apres chaque reception validee sur les 50 dernieres livraisons :
   ```
   score = (tauxPonctualite x 50) + (tauxConformiteQuantite x 50)
   ```
   - Ponctualite : livraison recue <= date prevue + 1 jour de tolerance
   - Conformite quantite : min(quantiteRecue / quantiteCommandee, 1) par BC

4. **Determiner le grade automatique** :
   | Score | Grade | Signification |
   |---|---|---|
   | >= 90 | A | Fournisseur fiable, aucune restriction |
   | 70 - 89 | B | Fournisseur acceptable, surveillance recommandee |
   | < 70 | C | Fournisseur a risque, creation de BC bloquee si blocage actif |

5. **Actions sur les fournisseurs grade C** :
   - Mettre sous surveillance (`isUnderSurveillance = true`) avec motif et duree
   - Bloquer si necessaire (`isBlocked = true`) : empeche la creation de nouveaux BC
   - Un fournisseur bloque genere une erreur explicite si on tente de creer un BC pour lui

6. **Impact du blocage** : Un fournisseur bloque (`isBlocked = true`) ou inactif (`isActive = false`) empeche la creation de tout nouveau BC via le endpoint `POST /appro/purchase-orders/create-direct`.

---

### Workflow G : Parametrage MP (seuils, lead times, criticite, fournisseur principal)

**Objectif :** Configurer les parametres d'approvisionnement de chaque MP pour un pilotage automatise.

**Etapes :**

1. **Acceder au stock MP** : Naviguer vers `/dashboard/appro/stock`.

2. **Selectionner la MP a parametrer** et cliquer sur "Modifier les parametres APPRO".

3. **Configurer les champs** via `PATCH /appro/stock-mp/:id` :

   | Champ | Description | Contrainte |
   |---|---|---|
   | `seuilSecurite` | Stock minimum de securite (en unite) | >= 0, entier |
   | `seuilCommande` | Seuil declenchant une commande | > seuilSecurite (validation stricte) |
   | `quantiteCommande` | Quantite standard a commander | >= 1, entier |
   | `leadTimeFournisseur` | Delai de livraison en jours | 1 a 365 |
   | `criticite` | Niveau de criticite | FAIBLE / MOYENNE / HAUTE / BLOQUANTE |
   | `fournisseurPrincipalId` | ID du fournisseur principal | Fournisseur existant |

4. **Comprendre la validation metier** :
   - **Regle stricte** : `seuilCommande` doit etre strictement superieur a `seuilSecurite`. Si cette regle n'est pas respectee, le systeme refuse la mise a jour avec l'erreur : "seuilCommande (X) doit etre superieur au seuilSecurite (Y)".
   - Si `seuilSecurite` n'est pas defini, le systeme utilise `minStock` comme valeur par defaut.
   - Si `seuilCommande` n'est pas defini, le systeme utilise `minStock x 1.5` comme valeur par defaut.

5. **Comprendre la criticite effective** :
   Le systeme calcule automatiquement une criticite effective qui est le maximum entre la criticite parametree et la criticite deduite de l'utilisation dans les recettes :
   - MP utilisee dans >= 3 recettes actives : criticite effective au minimum BLOQUANTE
   - MP utilisee dans >= 2 recettes actives : criticite effective au minimum HAUTE
   - MP utilisee dans >= 1 recette active : criticite effective au minimum MOYENNE
   - La criticite parametree manuellement reste prioritaire si elle est plus elevee

6. **Verifier l'impact** : Apres modification, retourner au dashboard pour constater l'impact sur l'IRS et les etats calcules.

---

### Workflow H : Verification production (check-production avant lancement)

**Objectif :** Verifier que toutes les matieres premieres sont disponibles avant de lancer un ordre de production.

**Prerequis :** Connaitre l'ID de la recette et le nombre de batchs a produire.

**Etapes :**

1. **Lancer la verification** : Appeler `POST /appro/check-production` avec :
   - `recipeId` : ID de la recette a verifier
   - `batchCount` : nombre de batchs prevus (minimum 1)

2. **Analyser le resultat** : Le systeme retourne :
   - `canStart: true` si toutes les MP sont disponibles en quantite suffisante
   - `canStart: false` avec la liste des `blockers` si des MP manquent

3. **Structure des blockers** : Pour chaque MP bloquante :
   - `productMpId` : ID de la MP
   - `name` : nom de la MP
   - `required` : quantite requise (quantite recette x nombre de batchs)
   - `available` : stock actuellement disponible
   - `shortage` : deficit a combler (required - available)

4. **Action automatique** : Si la production est bloquee (`canStart = false`), le systeme cree automatiquement une alerte `PRODUCTION_BLOQUEE` de niveau CRITICAL avec le detail des MP manquantes. Cette alerte est immediatement visible sur le dashboard.

5. **Optimisation technique** : Le systeme recupere tous les stocks en une seule requete batch pour eviter les problemes de performance N+1. Seuls les ingredients avec `affectsStock = true` sont verifies.

6. **Prochaine action** : Si la production est bloquee, consulter les suggestions de requisitions (`GET /appro/requisitions/suggested`) pour identifier les commandes a passer en priorite.

---

## 3. SCENARIOS REELS

### Scenario 1 : Rupture critique de presure (MP BLOQUANTE)

**Contexte :** La presure (MP-003) est une matiere premiere BLOQUANTE utilisee dans 4 recettes actives de fromage. Le stock atteint 0 un lundi matin.

**Deroulement :**

1. **Detection** : Le scan automatique (ou le batch quotidien) detecte que MP-003 a un stock de 0 et une criticite BLOQUANTE. Une alerte `MP_CRITIQUE` de niveau `CRITICAL` est creee avec le message : "MP CRITIQUE: Presure (MP-003) - Stock: 0. BLOQUE LA PRODUCTION."

2. **Notification** : L'IRS bondit a 30+ points (une seule bloquante = +30). Le dashboard passe en statut SURVEILLANCE ou CRITIQUE. Le compteur `criticalUnacknowledged` passe a 1.

3. **Reaction du Responsable APPRO** :
   - Se connecte, voit l'IRS en rouge
   - Accuse reception de l'alerte CRITICAL (obligatoire, trace d'audit)
   - Consulte les suggestions : le systeme a deja genere une suggestion de priorite CRITIQUE pour MP-003
   - Verifie le fournisseur principal de MP-003 : grade A, lead time 3 jours

4. **Action corrective** :
   - Cree un BC direct via `/dashboard/appro/bons/new`
   - Selectionne le fournisseur principal
   - Commande la quantite recommandee par le systeme
   - Envoie immediatement le BC par email
   - Contacte le fournisseur par telephone pour confirmer le delai

5. **Suivi** :
   - Chaque jour, verifie le statut du BC dans la liste des BC en retard (`GET /appro/purchase-orders/late`)
   - A la reception, saisit les quantites, lots et DLC
   - L'IRS revient progressivement a la normale

**Lecon :** Ne jamais ignorer une alerte CRITICAL. L'accusation de reception est un acte d'engagement legal et operationnel.

---

### Scenario 2 : Fournisseur d'emballages en retard chronique

**Contexte :** Le fournisseur FOUR-012 (Emballages El-Djazair) livre regulierement en retard. Son taux de retard atteint 35% sur les 50 dernieres livraisons.

**Deroulement :**

1. **Detection** : Le scan des fournisseurs detecte un taux de retard de 35% (> 30%, seuil CRITICAL). Une alerte `FOURNISSEUR_RETARD` de niveau CRITICAL est creee : "FOURNISSEUR DEGRADE: Emballages El-Djazair (FOUR-012) - Taux retard: 35.0%. Grade: B -> C."

2. **Analyse** :
   - Consulte `GET /appro/suppliers/performance` : score 52/100, grade C
   - Delai reel moyen : 12 jours vs 7 jours annonces
   - 5 MP dependantes (seaux IML, film retractable, cartons)
   - 3 BC actuellement en cours aupres de ce fournisseur

3. **Action corrective** :
   - Accuse reception de l'alerte CRITICAL
   - Convoque une reunion avec le fournisseur
   - Met le fournisseur sous surveillance (`isUnderSurveillance = true`) avec motif
   - Identifie un fournisseur alternatif pour les MP critiques
   - Reparametrer le fournisseur principal des MP les plus critiques

4. **Si la situation ne s'ameliore pas** :
   - Bloquer le fournisseur (`isBlocked = true`)
   - Basculer toutes les MP vers le fournisseur alternatif
   - Les tentatives de creation de BC pour ce fournisseur seront desormais refusees

---

### Scenario 3 : BC urgent pour une production planifiee

**Contexte :** La production prevoit de lancer 50 batchs de Gouda MONTESA 400g jeudi. Le check-production echoue mercredi matin.

**Deroulement :**

1. **Detection** : L'equipe production lance `POST /appro/check-production` avec `recipeId: 5, batchCount: 50`. Le systeme repond :
   ```
   canStart: false
   blockers: [
     { name: "Lait pasteurise", required: 5000, available: 3200, shortage: 1800 },
     { name: "Colorant annatto", required: 250, available: 200, shortage: 50 }
   ]
   ```

2. **Alerte automatique** : Le systeme cree une alerte `PRODUCTION_BLOQUEE` de niveau CRITICAL avec le detail des MP manquantes.

3. **Reaction APPRO** :
   - Accuse reception de l'alerte
   - Evalue les options : le lait est disponible chez FOUR-001 (grade A, lead time 1 jour), le colorant chez FOUR-008 (grade B, lead time 2 jours)
   - Cree deux BC urgents avec livraison prevue le lendemain matin
   - Envoie les BC par email immediatement
   - Contacte les fournisseurs pour confirmer

4. **Suivi** :
   - Confirme les BC des que les fournisseurs accusent reception
   - Jeudi matin, receptionne les livraisons en priorite
   - Relance le check-production : `canStart: true`
   - La production peut demarrer

---

### Scenario 4 : Reception partielle avec ecart de quantite

**Contexte :** Le BC-2026-00089 commande 500 kg de cheddar en blocs et 200 unites de seaux IML. Le fournisseur livre partiellement.

**Deroulement :**

1. **Reception partielle** : Le camion arrive avec 350 kg de cheddar (sur 500) et 200 seaux (quantite complete). Pas de colorant annatto prevu sur ce BC.

2. **Saisie dans le systeme** :
   - Ouvre le formulaire de reception `/dashboard/appro/bons/[id]/receive`
   - Ligne 1 (Cheddar) : quantite recue = 350, lot = L260220-C01, DLC = 2026-06-15
   - Ligne 2 (Seaux IML) : quantite recue = 200, lot = LOT-2026-S042, DLC = N/A (non perissable mais champ obligatoire, saisir une date lointaine)
   - BL fournisseur : BL-2026-00456
   - Notes : "Livraison partielle. Fournisseur annonce solde semaine prochaine."

3. **Resultat systeme** :
   - Reference reception : REC-20260220-001
   - Statut BC : PARTIAL (car cheddar partiellement recu : 350/500)
   - 2 mouvements de stock IN crees
   - 2 lots MP crees avec tracabilite complete
   - Audit log : BC_PARTIAL_RECEIVED

4. **Suivi du solde** :
   - Le BC reste en statut PARTIAL et apparait dans la liste des BC
   - A la livraison du solde (150 kg de cheddar), une nouvelle reception est saisie
   - Le systeme verifie automatiquement que la quantite cumulee ne depasse pas la commandee
   - Si tout est recu, le BC passe en statut RECEIVED

5. **Verification** : Le systeme empeche toute sur-reception. Si quelqu'un tente de saisir 200 kg alors qu'il n'en reste que 150 a recevoir, l'erreur est explicite.

---

### Scenario 5 : Lot MP avec DLC proche

**Contexte :** Un lot de lait pasteurise (L260115-LP01) a une DLC au 28 fevrier. Nous sommes le 24 fevrier.

**Deroulement :**

1. **Detection** : Le scan des alertes detecte un lot dont la DLC est a moins de 5 jours. Une alerte `DLC_PROCHE` est creee avec les details du lot.

2. **Evaluation** :
   - Le Responsable APPRO accuse reception de l'alerte
   - Verifie la quantite restante dans le lot
   - Consulte avec l'equipe production pour planifier l'utilisation du lot avant expiration

3. **Actions possibles** :
   - Si le lot peut etre consomme avant la DLC : prioriser son utilisation en production (FIFO)
   - Si le lot ne peut pas etre consomme a temps : le bloquer (`status: BLOCKED`, motif : DLC_EXPIRED_AUTO) pour eviter toute utilisation accidentelle
   - Commander du stock frais si necessaire pour compenser

4. **Impact** : Le blocage d'un lot reduit le stock disponible, ce qui peut declencher d'autres alertes (SOUS_SEUIL, A_COMMANDER) et impacter l'IRS.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Oublier d'accuser reception des alertes CRITICAL

**Description :** L'utilisateur voit l'alerte sur le dashboard mais ne clique pas sur "Accuser reception". L'alerte reste dans le compteur `criticalUnacknowledged`.

**Consequence :** Non-conformite audit. L'audit trail ne prouve pas que le risque a ete pris en connaissance. Potentiel blocage de certaines operations si des controles sont implementes.

**Prevention :** Integrer l'accusation d'alertes CRITICAL dans la checklist quotidienne du matin. Verifier chaque jour que `criticalUnacknowledged = 0`.

---

### Erreur 2 : Parametrer seuilCommande <= seuilSecurite

**Description :** L'utilisateur definit un seuil de commande inferieur ou egal au seuil de securite, ce qui est logiquement incoherent (on devrait commander AVANT d'atteindre le stock de securite).

**Consequence :** Le systeme refuse la modification avec l'erreur explicite : "seuilCommande (X) doit etre superieur au seuilSecurite (Y)". Aucune donnee n'est modifiee.

**Prevention :** Comprendre la logique des seuils : seuilCommande > seuilSecurite > 0. Le seuil de commande est le declencheur, le seuil de securite est le filet de securite.

---

### Erreur 3 : Ne pas renseigner le numero de lot et la DLC lors d'une reception

**Description :** L'utilisateur tente de valider une reception avec quantite > 0 sans saisir le numero de lot ou la date d'expiration.

**Consequence :** Le systeme refuse la validation avec des messages explicites : "Le numero de lot est obligatoire pour la tracabilite" ou "La date d'expiration (DLC) est obligatoire pour la tracabilite alimentaire."

**Prevention :** Former les equipes a toujours demander le numero de lot et la DLC au fournisseur au moment de la livraison. Avoir un processus de controle a quai systematique.

---

### Erreur 4 : Creer un BC pour un fournisseur bloque

**Description :** L'utilisateur tente de commander aupres d'un fournisseur dont le statut est bloque.

**Consequence :** Le systeme refuse avec l'erreur : "Fournisseur [nom] est inactif" ou un blocage equivalent. Aucune commande n'est creee.

**Prevention :** Verifier le grade et le statut du fournisseur avant toute creation de BC. Consulter regulierement la page `/dashboard/appro/fournisseurs` pour identifier les fournisseurs a risque.

---

### Erreur 5 : Reporter une alerte RUPTURE

**Description :** L'utilisateur tente de reporter une alerte pour une MP dont le stock est a 0.

**Consequence :** Le systeme refuse categoriquement avec l'erreur : "Les alertes RUPTURE (stock = 0) ne peuvent pas etre reportees." C'est une regle metier inviolable.

**Prevention :** Comprendre que la rupture (stock = 0) exige une action immediate, pas un report. La seule reponse adequate est de creer un BC ou de trouver un substitut.

---

### Erreur 6 : Reporter plus de 2 fois la meme alerte MP

**Description :** L'utilisateur reporte une alerte pour la 3eme fois en 7 jours.

**Consequence :** Le systeme refuse avec : "Maximum 2 reports consecutifs atteint pour cette MP. Veuillez creer un BC."

**Prevention :** Le report n'est pas une solution. Il donne un delai de reflexion, pas un droit d'inaction. Au deuxieme report, l'action corrective (BC, substitution, ajustement planification) doit etre engagee.

---

### Erreur 7 : Ne pas verifier les BC en retard

**Description :** L'utilisateur ne consulte pas regulierement la liste des BC en retard (`GET /appro/purchase-orders/late`).

**Consequence :** Des retards non detectes s'accumulent, les BC critiques ne sont pas relances, la production risque d'etre impactee sans alerte prealable.

**Prevention :** Consulter les BC en retard quotidiennement. Le systeme calcule automatiquement : `daysLate` (nombre de jours), `isCritical` (retard > 3 jours), `hasCriticalMp` (MP critique concernee), `impactLevel` (BLOQUANT/MAJEUR/MINEUR).

---

### Erreur 8 : Envoyer un BC sans preuve tracable

**Description :** L'utilisateur tente d'envoyer un BC en mode MANUAL sans fournir de note de preuve suffisante.

**Consequence :** Le systeme refuse si la note de preuve fait moins de 20 caracteres. L'envoi sans aucune preuve est impossible par conception.

**Prevention :** Toujours documenter comment le BC a ete transmis au fournisseur. En mode EMAIL, la preuve est automatique (messageId). En mode MANUAL, decrire precisement : methode (fax, telephone, remise en main propre), date, heure, interlocuteur.

---

### Erreur 9 : Ignorer la criticite effective calculee

**Description :** L'utilisateur parametrer une MP en criticite FAIBLE alors qu'elle est utilisee dans 3 recettes actives.

**Consequence :** Le systeme calcule automatiquement une criticite effective BLOQUANTE (car >= 3 recettes). L'utilisateur peut voir un decalage entre la criticite parametree et la criticite effective affichee.

**Prevention :** Comprendre que la criticite effective est toujours le maximum entre la valeur manuelle et la valeur calculee. Si une MP est dans 3+ recettes, sa criticite effective sera BLOQUANTE quoi qu'il arrive.

---

### Erreur 10 : Tenter une sur-reception

**Description :** L'utilisateur saisit une quantite recue superieure a la quantite restante a recevoir sur une ligne de BC.

**Consequence :** Le systeme refuse avec l'erreur : "Sur-reception pour [nom] : deja recu X, commande Y, tentative de recevoir Z supplementaires." Aucun mouvement de stock n'est cree.

**Prevention :** Verifier la quantite deja recue vs commandee avant de saisir. En cas de livraison excedentaire reelle, contacter l'ADMIN pour ajustement ou creer un nouveau BC.

---

## 5. RISQUES METIER CRITIQUES

### 5.1 Matrice des risques

| ID | Risque | Probabilite | Impact | Severite | Mitigation |
|---|---|---|---|---|---|
| R1 | Rupture MP bloquante causant arret production | Moyenne | Critique | CRITIQUE | Suivi quotidien IRS, seuils parametres, alertes CRITICAL |
| R2 | Fournisseur unique pour MP critique | Haute | Majeur | HAUT | Double-sourcing, evaluation fournisseurs, plan B |
| R3 | Reception sans controle qualite (lot, DLC) | Faible | Critique | MOYEN | Champs obligatoires systeme, formation equipes |
| R4 | BC en retard non detecte | Moyenne | Majeur | HAUT | Dashboard BC late, alertes FOURNISSEUR_RETARD |
| R5 | Donnees de seuils obsoletes | Haute | Moyen | MOYEN | Revue mensuelle parametrage, metriques batch |
| R6 | Modification concurrente d'un BC | Faible | Moyen | FAIBLE | Verrouillage optimiste + soft lock 5 min |
| R7 | Annulation BC frauduleuse ou erronee | Faible | Majeur | MOYEN | Reservation ADMIN, motif 10 chars min, audit |
| R8 | Fournisseur bloque pour facturation impayee | Moyenne | Moyen | MOYEN | Communication inter-services, surveillance |
| R9 | Perte de tracabilite lot (securite alimentaire) | Faible | Critique | HAUT | Lot et DLC obligatoires, audit mouvements |
| R10 | IRS faussement rassurant par metriques obsoletes | Moyenne | Majeur | HAUT | Batch quotidien de recalcul, scan alertes |

### 5.2 Plan de continuite approvisionnement

**Risque maximal :** Arret complet de la production par manque de MP bloquante.

**Mesures preventives :**
1. Maintenir un IRS < 30 (statut SAIN) en permanence
2. Parametrer tous les seuils de securite et de commande
3. Avoir au minimum 2 fournisseurs qualifies pour chaque MP bloquante
4. Lancer le check-production 48h avant chaque lancement
5. Traiter les alertes CRITICAL dans l'heure suivant leur apparition

**Mesures correctives en cas de crise :**
1. Identifier les substituts possibles avec la Direction Qualite
2. Contacter les fournisseurs alternatifs en urgence
3. Ajuster le planning de production en fonction des MP disponibles
4. Documenter chaque decision dans le systeme (notes BC, alertes)

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist QUOTIDIENNE (chaque matin, 15 minutes)

| # | Action | Endpoint / Page | Fait |
|---|---|---|---|
| 1 | Consulter le dashboard APPRO, noter l'IRS | `GET /appro/dashboard` | [ ] |
| 2 | Verifier que `criticalUnacknowledged = 0` | `GET /appro/alerts/counts` | [ ] |
| 3 | Accuser reception de toutes les alertes CRITICAL | `POST /appro/alerts/:id/acknowledge` | [ ] |
| 4 | Consulter la liste des MP en etat RUPTURE ou BLOQUANT_PRODUCTION | `GET /appro/stock-mp/critical` | [ ] |
| 5 | Verifier les BC en retard et relancer si necessaire | `GET /appro/purchase-orders/late` | [ ] |
| 6 | Consulter les suggestions de requisitions automatiques | `GET /appro/requisitions/suggested` | [ ] |
| 7 | Creer les BC necessaires pour les MP priorite CRITIQUE ou ELEVEE | `POST /appro/purchase-orders/create-direct` | [ ] |
| 8 | Verifier les BC en statut DRAFT : envoyer ou supprimer | `GET /appro/purchase-orders?status=DRAFT` | [ ] |
| 9 | Traiter les receptions du jour (saisir les livraisons arrivees) | `POST /appro/purchase-orders/:id/receive` | [ ] |
| 10 | Consigner les anomalies dans les notes des BC concernes | Formulaire BC | [ ] |

### 6.2 Checklist HEBDOMADAIRE (chaque lundi, 30 minutes)

| # | Action | Endpoint / Page | Fait |
|---|---|---|---|
| 1 | Analyser la tendance de l'IRS sur la semaine ecoulee | Dashboard historique | [ ] |
| 2 | Revoir les BC en statut PARTIAL : relancer les fournisseurs | `GET /appro/purchase-orders?status=PARTIAL` | [ ] |
| 3 | Consulter les statistiques de retards BC | `GET /appro/purchase-orders/delay-stats` | [ ] |
| 4 | Evaluer les fournisseurs grade C : actions correctives | `GET /appro/suppliers/performance` | [ ] |
| 5 | Verifier les MP avec jours de couverture < 2x lead time | `GET /appro/stock-mp` filtrage | [ ] |
| 6 | Declencher un scan complet des alertes | `POST /appro/alerts/scan` | [ ] |
| 7 | Revoir les alertes reportees qui arrivent a echeance | `GET /appro/alerts/all` | [ ] |
| 8 | Preparer le planning d'approvisionnement de la semaine suivante | Reunions inter-services | [ ] |

### 6.3 Checklist MENSUELLE (premier lundi du mois, 1 heure)

| # | Action | Endpoint / Page | Fait |
|---|---|---|---|
| 1 | Revue complete du parametrage MP (seuils, lead times, criticite) | `PATCH /appro/stock-mp/:id` | [ ] |
| 2 | Analyse performance fournisseurs : grades, scores, tendances | `GET /appro/suppliers/performance` | [ ] |
| 3 | Decisions sur fournisseurs grade C : blocage, surveillance, remplacement | Page fournisseurs | [ ] |
| 4 | Verification que les metriques de consommation sont a jour | `POST /appro/update-metrics` (ADMIN) | [ ] |
| 5 | Export du rapport valorisation stock MP | `GET /reports/stock/valorization` | [ ] |
| 6 | Export du rapport bons de commande du mois | `GET /reports/procurement/purchase-orders` | [ ] |
| 7 | Export du rapport performance fournisseurs | `GET /reports/procurement/suppliers` | [ ] |
| 8 | Audit des alertes du mois : taux d'accusation, temps de reaction | `GET /appro/alerts/all` | [ ] |
| 9 | Revue des BC annules : justification, patterns | Audit logs | [ ] |
| 10 | Mise a jour du plan de continuite approvisionnement | Document hors systeme | [ ] |

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : "Decouverte du Dashboard APPRO" (8 minutes)

**Sequence 1 (0:00 - 1:30) : Connexion et navigation**
- Montrer la connexion avec un compte role APPRO
- Naviguer vers le dashboard APPRO depuis la barre laterale
- Presenter la structure de la page : IRS en haut, stats au centre, MP critiques a gauche, alertes a droite

**Sequence 2 (1:30 - 3:30) : Comprendre l'IRS**
- Expliquer la formule : (bloquantes x 30) + (ruptures x 20) + (sous seuil x 10)
- Montrer un IRS SAIN (0-30) : ecran vert, pas d'action urgente
- Montrer un IRS CRITIQUE (61-100) : ecran rouge, detail des MP impactees
- Insister : "L'IRS ne ment jamais. Si c'est rouge, la production est en danger."

**Sequence 3 (3:30 - 5:30) : Lire les statistiques stock**
- Parcourir chaque etat : SAIN, SOUS_SEUIL, A_COMMANDER, RUPTURE, BLOQUANT_PRODUCTION
- Montrer comment filtrer la vue stock MP par etat
- Expliquer la difference entre RUPTURE et BLOQUANT_PRODUCTION

**Sequence 4 (5:30 - 7:00) : Alertes et BC en attente**
- Montrer le compteur d'alertes actives
- Montrer le compteur de BC en attente
- Transition vers les modules suivants

**Sequence 5 (7:00 - 8:00) : Recapitulatif et quiz**
- 3 questions de verification :
  - "Un IRS de 45, c'est quel statut ?" (SURVEILLANCE)
  - "Que signifie BLOQUANT_PRODUCTION ?" (MP critique avec stock insuffisant, arrete la production)
  - "Combien d'alertes CRITICAL non accusees sont tolerables ?" (Zero)

---

### Module 2 : "Creer et envoyer un Bon de Commande" (10 minutes)

**Sequence 1 (0:00 - 2:00) : Consulter les suggestions**
- Ouvrir les suggestions automatiques
- Expliquer les priorites : CRITIQUE, ELEVEE, NORMALE
- Montrer la justification generee par le systeme
- Montrer le fournisseur suggere

**Sequence 2 (2:00 - 5:00) : Creer le BC**
- Naviguer vers "Nouveau BC"
- Selectionner le fournisseur (montrer le cas d'un fournisseur bloque)
- Ajouter 3 lignes de commande avec quantites et prix
- Saisir la date de livraison prevue
- Valider : montrer la reference generee (BC-2026-XXXXX)

**Sequence 3 (5:00 - 7:30) : Envoyer le BC**
- Ouvrir le BC en statut DRAFT
- Montrer le mode EMAIL : email pre-rempli, envoi automatique
- Montrer le mode MANUAL : saisie de la note de preuve (min 20 caracteres)
- Montrer le PDF telecharge (`GET /appro/purchase-orders/:id/pdf`)
- Insister : "Jamais d'envoi sans preuve. Le systeme le refuse."

**Sequence 4 (7:30 - 9:00) : Confirmer le BC**
- Simuler la confirmation apres retour du fournisseur
- Montrer la transition SENT -> CONFIRMED

**Sequence 5 (9:00 - 10:00) : Recapitulatif**
- Parcours complet : creation -> envoi -> confirmation
- Les 3 regles d'or : fournisseur actif, preuve obligatoire, audit automatique

---

### Module 3 : "Receptionner une livraison" (10 minutes)

**Sequence 1 (0:00 - 2:00) : Contexte de la reception**
- Expliquer quand receptionner : a l'arrivee du camion fournisseur
- Les 3 documents a avoir : BC, BL fournisseur, bon de controle qualite

**Sequence 2 (2:00 - 5:00) : Saisie de la reception complete**
- Ouvrir le formulaire de reception
- Saisir le numero de BL fournisseur
- Pour chaque ligne : quantite recue, numero de lot, DLC
- Insister sur les champs obligatoires : "Sans lot ni DLC, pas de reception possible"
- Valider : montrer la reference REC-YYYYMMDD-NNN

**Sequence 3 (5:00 - 7:30) : Cas de reception partielle**
- Simuler une livraison incomplete (300/500 kg)
- Montrer le statut PARTIAL
- Expliquer le suivi : le BC reste ouvert
- Simuler la deuxieme reception pour le solde
- Montrer la protection anti sur-reception

**Sequence 4 (7:30 - 9:00) : Verifications post-reception**
- Verifier les mouvements de stock crees
- Verifier l'impact sur le stock de la MP
- Verifier l'impact sur l'IRS

**Sequence 5 (9:00 - 10:00) : Gestion des ecarts**
- Que faire si la quantite recue differe de la commande
- Que faire si le lot est endommage
- Documentation dans les notes du BC

---

### Module 4 : "Gerer les alertes et les risques" (8 minutes)

**Sequence 1 (0:00 - 2:00) : Types d'alertes**
- Presenter les 5 types : MP_CRITIQUE, RUPTURE, FOURNISSEUR_RETARD, PRODUCTION_BLOQUEE, DLC_PROCHE
- Expliquer les 3 niveaux : INFO (bleu), WARNING (orange), CRITICAL (rouge)
- Montrer la page alertes avec le tri par severite

**Sequence 2 (2:00 - 4:00) : Accuser reception**
- Montrer le processus d'accusation de reception
- Expliquer pourquoi c'est obligatoire pour les CRITICAL
- Montrer l'audit trail : qui a vu quoi, quand

**Sequence 3 (4:00 - 6:00) : Reporter une alerte**
- Montrer le formulaire de report : duree (4h/12h/24h) + motif (min 10 chars)
- Montrer le cas refuse : alerte RUPTURE (stock = 0) -> non reportable
- Montrer le cas refuse : 3eme report en 7 jours -> maximum atteint
- Insister : "Reporter n'est pas ignorer. C'est un delai pour agir."

**Sequence 4 (6:00 - 7:30) : Scanner les alertes**
- Declencher un scan complet
- Montrer les resultats : X alertes MP, Y ruptures, Z fournisseurs
- Expliquer la non-duplication des alertes

**Sequence 5 (7:30 - 8:00) : Resume**
- Regle fondamentale : zero alerte CRITICAL non accusee en fin de journee

---

### Module 5 : "Piloter les fournisseurs" (8 minutes)

**Sequence 1 (0:00 - 2:00) : Le classement fournisseurs**
- Ouvrir la page performance fournisseurs
- Expliquer le systeme de grading : A (> 90), B (70-90), C (< 70)
- Montrer le detail d'un fournisseur : metriques, historique, MP liees

**Sequence 2 (2:00 - 4:00) : Comprendre le score**
- Formule : 50% ponctualite + 50% conformite quantite
- Ponctualite : livre a temps = tolerance +1 jour
- Conformite : ratio quantite recue / commandee (plafonne a 100%)
- Base de calcul : 50 dernieres livraisons

**Sequence 3 (4:00 - 5:30) : Actions sur les fournisseurs**
- Mettre sous surveillance : quand et pourquoi
- Bloquer un fournisseur : consequence sur les BC
- Montrer l'impact du blocage : tentative de creation BC refusee

**Sequence 4 (5:30 - 7:00) : Optimisation du sourcing**
- Identifier les mono-sources (MP avec un seul fournisseur)
- Diversifier les fournisseurs pour les MP critiques
- Reparametrer le fournisseur principal d'une MP

**Sequence 5 (7:00 - 8:00) : Exercice pratique**
- A partir du classement, identifier le fournisseur le plus a risque
- Proposer un plan d'action en 3 points

---

## 8. MATRICE RACI

La matrice RACI definit les responsabilites pour chaque processus du module Approvisionnement.

**Legende :** R = Responsable (execute), A = Autorite (valide/approuve), C = Consulte, I = Informe

| Processus | APPRO | ADMIN | PRODUCTION | COMMERCIAL | Direction |
|---|---|---|---|---|---|
| Analyse quotidienne dashboard IRS | **R** | I | I | - | I (si critique) |
| Parametrage seuils MP | **R** | A | C | - | - |
| Creation BC direct | **R** | I | C | - | - |
| Envoi BC au fournisseur | **R** | I | - | - | - |
| Confirmation BC | **R** | I | I | - | - |
| Reception marchandises | **R** | I | C | - | - |
| Annulation BC | C | **R/A** | I | - | I |
| Accusation alertes CRITICAL | **R** | A | I | - | I |
| Report d'alertes MP | **R** | A | - | - | - |
| Scan complet alertes | **R** | R | - | - | - |
| Evaluation fournisseurs (grade) | **R** | A | C | - | I |
| Blocage fournisseur | **R** | **A** | I | I | I |
| Mise sous surveillance fournisseur | **R** | I | I | - | - |
| Check pre-production | C | - | **R** | - | - |
| Recalcul metriques MP (batch) | I | **R** | - | - | - |
| Gestion inventaire physique | C | **R** | R | - | A |
| Rapports mensuels appro | **R** | A | I | - | I |
| Decision double-sourcing | **R** | A | C | - | A |
| Gestion budget achats | C | A | - | - | **R/A** |
| Communication fournisseurs | **R** | C | - | - | - |

---

## 9. NIVEAUX DE MATURITE

L'echelle ci-dessous permet d'evaluer le niveau de maturite de l'utilisation du module Approvisionnement dans l'organisation.

### Niveau 1 : INITIAL (Score audit : 0-25)

**Caracteristiques :**
- Le dashboard est consulte de facon sporadique (moins de 3 fois par semaine)
- Les seuils de securite et de commande ne sont pas parametres pour la majorite des MP
- Les BC sont crees de maniere reactive, uniquement quand la rupture est constatee
- Les alertes CRITICAL ne sont pas systematiquement accusees
- La performance fournisseurs n'est pas suivie
- Les receptions sont saisies avec retard ou partiellement

**Actions pour passer au niveau 2 :**
- Former le responsable APPRO aux workflows de base (modules video 1-3)
- Parametrer les seuils pour au moins les 20 MP les plus consommees
- Instaurer la consultation quotidienne du dashboard

---

### Niveau 2 : REACTIVE (Score audit : 26-50)

**Caracteristiques :**
- Le dashboard est consulte quotidiennement
- Les seuils sont parametres pour les MP principales mais pas toutes
- Les BC sont crees en reaction aux suggestions du systeme
- Les alertes CRITICAL sont accusees mais parfois avec retard (> 4h)
- Le check-production est utilise occasionnellement
- Les receptions sont saisies le jour meme avec lots et DLC

**Actions pour passer au niveau 3 :**
- Completer le parametrage seuils/criticite pour 100% des MP
- Atteindre un taux d'accusation des alertes CRITICAL < 2h
- Utiliser systematiquement le check-production 48h avant chaque lancement
- Commencer le suivi hebdomadaire des fournisseurs

---

### Niveau 3 : PROACTIVE (Score audit : 51-75)

**Caracteristiques :**
- L'IRS est maintenu sous 30 (statut SAIN) au moins 80% du temps
- Toutes les MP ont des seuils parametres et coherents
- Les BC sont anticipes grace aux suggestions automatiques (commandes avant rupture)
- Les alertes CRITICAL sont accusees en moins d'1 heure
- La performance fournisseurs est revue mensuellement avec actions correctives
- Les check-production sont systematiques et les blockers resolus avant le lancement
- Le scan des alertes est lance au minimum hebdomadairement

**Actions pour passer au niveau 4 :**
- Implementer le double-sourcing pour toutes les MP BLOQUANTES
- Atteindre un taux de service fournisseurs > 90% (grade A moyen)
- Reduire les BC en retard a < 5% du total
- Integrer l'appro dans le planning de production S+2

---

### Niveau 4 : PREDICTIVE (Score audit : 76-92)

**Caracteristiques :**
- L'IRS est maintenu sous 15 (tres sain) au moins 90% du temps
- Toutes les MP BLOQUANTES ont au minimum 2 fournisseurs qualifies
- Les commandes sont planifiees 2 semaines a l'avance sur base des previsions de production
- Le taux de service fournisseurs est > 92%, tous les fournisseurs grade C sont traites
- Aucune rupture de production liee a l'approvisionnement sur le trimestre
- Les metriques de consommation sont fiables et mises a jour quotidiennement
- Les rapports mensuels sont exploites pour l'amelioration continue

**Actions pour passer au niveau 5 :**
- Integrer les previsions de vente dans le calcul des besoins
- Mettre en place des contrats-cadres avec les fournisseurs strategiques
- Automatiser les commandes recurrentes pour les MP a consommation stable

---

### Niveau 5 : OPTIMISE (Score audit : 93-100)

**Caracteristiques :**
- Zero rupture de production liee a l'approvisionnement sur 12 mois glissants
- Couverture de stock optimisee (ni surstockage ni sous-stockage)
- Fournisseurs tous grade A ou B, avec plans d'amelioration actifs pour les B
- Integration complete avec le planning de production : les BC sont generes automatiquement
- Cout d'achat optimise grace a la negociation basee sur les donnees de performance
- Tracabilite complete lot-par-lot de toute la chaine amont
- Audit trail 100% conforme, aucune alerte CRITICAL non accusee sur 12 mois

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Optimisations a court terme (0-3 mois)

**O1 : Completer le parametrage des seuils**
- Action : Pour chaque MP active et suivie, definir `seuilSecurite`, `seuilCommande`, `quantiteCommande` et `leadTimeFournisseur` de maniere coherente.
- Formule recommandee pour le seuil de securite : `consommationMoyJour x leadTimeFournisseur x 0.5` (50% du lead time en stock tampon).
- Formule recommandee pour le seuil de commande : `consommationMoyJour x leadTimeFournisseur x 1.2` (120% du lead time pour anticiper).
- Impact : Reduction immediate des faux positifs et faux negatifs dans l'IRS.

**O2 : Instaurer le rituel quotidien des 15 minutes**
- Action : Le responsable APPRO doit executer la checklist quotidienne chaque matin sans exception.
- Meilleur moment : 8h00, avant le debut des operations de production.
- Impact : Detection precoce des risques, temps de reaction reduit.

**O3 : Parametrer les fournisseurs principaux**
- Action : Pour chaque MP, definir le `fournisseurPrincipalId` correspondant au fournisseur habituel.
- Impact : Les suggestions automatiques proposeront le bon fournisseur, gain de temps a la creation de BC.

### 10.2 Optimisations a moyen terme (3-6 mois)

**O4 : Mettre en place le double-sourcing**
- Action : Pour chaque MP de criticite BLOQUANTE ou HAUTE, qualifier au minimum un fournisseur alternatif.
- Impact : Resilience de la supply chain, pouvoir de negociation accru.

**O5 : Exploiter les rapports pour la negociation**
- Action : Utiliser les rapports `GET /reports/procurement/suppliers` et `GET /reports/procurement/purchase-orders` pour objectiver les discussions avec les fournisseurs.
- Donnees cles : taux de retard, conformite quantite, evolution des prix, volumes commandes.
- Impact : Amelioration des conditions commerciales, reduction des couts.

**O6 : Synchroniser avec la production**
- Action : Institutionnaliser le check-production (`POST /appro/check-production`) 48h avant chaque lancement prevu.
- Impact : Zero surprise le jour du lancement, planification fluide.

### 10.3 Optimisations a long terme (6-12 mois)

**O7 : Tendre vers la commande predictive**
- Action : Exploiter les donnees de `consommationMoyJour` et les previsions de production pour generer des besoins a S+2 et S+3.
- Impact : Reduction du stock de securite (moins de capital immobilise) tout en maintenant le taux de service.

**O8 : Automatiser les commandes recurrentes**
- Action : Pour les MP a consommation stable et previsible, automatiser la generation de BC quand le seuil est atteint.
- Prerequis : metriques fiables, fournisseur stable (grade A), lead time constant.
- Impact : Reduction de la charge administrative, zero oubli de commande.

**O9 : Integration comptable**
- Action : Connecter le flux de reception (ReceptionMp + TVA) directement avec le module comptable pour la comptabilisation automatique des achats.
- Impact : Reduction des erreurs de saisie, cloturecomptable acceleree.

**O10 : Tableau de bord direction**
- Action : Creer un dashboard synthetique pour la direction avec : IRS moyen mensuel, cout total des achats, taux de service fournisseurs, nombre de ruptures de production.
- Impact : Visibilite direction, decisions strategiques eclairees.

---

## 11. GLOSSAIRE METIER

| Terme | Definition |
|---|---|
| **BC** | Bon de Commande. Document envoyee au fournisseur pour commander des matieres premieres. Reference au format BC-YYYY-NNNNN. |
| **BL** | Bon de Livraison. Document du fournisseur accompagnant la livraison physique des marchandises. |
| **Criticite** | Niveau d'importance d'une MP pour la production. Quatre niveaux : FAIBLE, MOYENNE, HAUTE, BLOQUANTE. |
| **Criticite effective** | Criticite calculee automatiquement par le systeme comme le maximum entre la criticite parametree et la criticite deduite du nombre de recettes actives utilisant la MP. |
| **DA** | Dinar Algerien. Devise utilisee pour tous les montants dans le systeme. |
| **DLC** | Date Limite de Consommation. Date au-dela de laquelle un produit ne doit plus etre consomme. Champ obligatoire a la reception. |
| **FIFO** | First In, First Out. Methode de gestion des lots : le lot le plus ancien est consomme en premier. |
| **Grade fournisseur** | Classification de performance : A (fiable, score > 90), B (acceptable, score 70-90), C (a risque, score < 70). |
| **IRS** | Indice de Risque Supply. Indicateur agrege de 0 a 100 mesurant le risque global de la supply chain. Formule : (bloquantes x 30) + (ruptures x 20) + (sous seuil x 10). |
| **Lead time** | Delai de livraison d'un fournisseur, exprime en jours. Distinguer le lead time annonce (contractuel) du lead time reel (constate). |
| **Lot** | Ensemble homogene de produits issus d'une meme fabrication ou reception. Identifie par un numero unique pour la tracabilite. |
| **MP** | Matiere Premiere. Tout intrant utilise dans la production : matieres premieres brutes (lait, presure), emballages, additifs, consommables. Code au format MP-NNN. |
| **PF** | Produit Fini. Produit issu de la production, destine a la vente. Code au format PF-NNN. |
| **RBAC** | Role-Based Access Control. Systeme de controle d'acces base sur les roles (ADMIN, APPRO, PRODUCTION, COMMERCIAL). |
| **ReceptionMp** | Enregistrement dans le systeme d'une reception physique de marchandises. Reference au format REC-YYYYMMDD-NNN. |
| **Seuil de commande** | Niveau de stock en dessous duquel une commande doit etre passee. Doit etre strictement superieur au seuil de securite. |
| **Seuil de securite** | Stock minimum de securite. Niveau en dessous duquel le risque de rupture est eleve. |
| **Score de performance** | Note de 0 a 100 attribuee a un fournisseur. Calcule sur 50% ponctualite + 50% conformite quantite sur les 50 dernieres livraisons. |
| **StockMovement** | Mouvement de stock enregistre dans le systeme. Type IN (entree) ou OUT (sortie). Chaque mouvement est tracable (utilisateur, date, origine, lot). |
| **TVA** | Taxe sur la Valeur Ajoutee. Trois taux en vigueur en Algerie : 0%, 9% (taux reduit), 19% (taux normal). |
| **Verrouillage optimiste** | Mecanisme empechant les modifications concurrentes d'un BC. Un champ `version` est incremente a chaque modification. |
| **Soft lock** | Verrou temporaire (5 minutes par defaut) empechant un autre utilisateur de modifier un BC pendant qu'il est en cours d'edition. |
| **Idempotence** | Propriete d'une operation qui produit le meme resultat meme si elle est executee plusieurs fois. Utilise pour les envois et annulations de BC. |

### Etats du stock MP

| Etat | Condition | Signification |
|---|---|---|
| **SAIN** | stock > seuilCommande | Stock confortable, pas d'action requise |
| **A_COMMANDER** | seuilSecurite < stock <= seuilCommande | Stock en baisse, passer commande |
| **SOUS_SEUIL** | 0 < stock <= seuilSecurite | Stock critique, action urgente |
| **RUPTURE** | stock = 0, MP non bloquante | Rupture de stock, commander immediatement |
| **BLOQUANT_PRODUCTION** | stock = 0 (ou <= seuilSecurite) + criticite BLOQUANTE ou utilise dans recette active | Arret de production imminent si pas d'action |

### Cycle de vie d'un BC

| Statut | Description | Actions possibles |
|---|---|---|
| **DRAFT** | BC cree, non envoye | Modifier, envoyer, annuler (ADMIN) |
| **SENT** | BC envoye au fournisseur | Confirmer, receptionner, annuler (ADMIN) |
| **CONFIRMED** | BC confirme par le fournisseur | Receptionner, annuler (ADMIN) |
| **PARTIAL** | Partiellement receptionne | Completer la reception |
| **RECEIVED** | Entierement receptionne | Consultation seule |
| **CANCELLED** | Annule (ADMIN uniquement) | Consultation seule |

---

## 12. ANNEXES

### Annexe A : Cartographie des endpoints API

#### A.1 Dashboard et stock

| Methode | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/appro/dashboard` | Dashboard complet APPRO | ADMIN, APPRO |
| GET | `/appro/stock-mp` | Liste MP avec etat calcule | ADMIN, APPRO, PRODUCTION |
| GET | `/appro/stock-mp/critical` | MP critiques uniquement | ADMIN, APPRO, PRODUCTION |
| PATCH | `/appro/stock-mp/:id` | Modifier parametres APPRO MP | ADMIN, APPRO |
| GET | `/appro/requisitions/suggested` | Suggestions automatiques | ADMIN, APPRO |
| GET | `/appro/suppliers/performance` | Performance fournisseurs | ADMIN, APPRO |
| POST | `/appro/check-production` | Verifier disponibilite MP | ADMIN, APPRO, PRODUCTION |
| POST | `/appro/update-metrics` | Recalculer metriques (batch) | ADMIN |

#### A.2 Alertes V1.2

| Methode | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/appro/alerts` | Alertes actives (legacy) | ADMIN, APPRO |
| GET | `/appro/alerts/all` | Toutes les alertes | ADMIN, APPRO |
| GET | `/appro/alerts/active` | Alertes non accusees | ADMIN, APPRO |
| GET | `/appro/alerts/critical` | Alertes CRITICAL non accusees | ADMIN, APPRO, PRODUCTION |
| GET | `/appro/alerts/counts` | Compteurs par niveau | ADMIN, APPRO |
| POST | `/appro/alerts/:id/acknowledge` | Accuser reception | ADMIN, APPRO |
| POST | `/appro/alerts/mp/:mpId/postpone` | Reporter une alerte MP | ADMIN, APPRO |
| POST | `/appro/alerts/scan` | Scan complet (ou check-alerts) | ADMIN, APPRO |

#### A.3 Bons de commande

| Methode | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/appro/purchase-orders/create-direct` | Creer BC direct | ADMIN, APPRO |
| GET | `/appro/purchase-orders` | Liste BC avec filtres | ADMIN, APPRO, PRODUCTION |
| GET | `/appro/purchase-orders/:id` | Detail BC | ADMIN, APPRO, PRODUCTION |
| GET | `/appro/purchase-orders/:id/pdf` | Telecharger PDF BC | ADMIN, APPRO, PRODUCTION |
| POST | `/appro/purchase-orders/:id/send` | Envoyer (DRAFT -> SENT) | ADMIN, APPRO |
| POST | `/appro/purchase-orders/:id/confirm` | Confirmer (SENT -> CONFIRMED) | ADMIN, APPRO |
| POST | `/appro/purchase-orders/:id/receive` | Receptionner | ADMIN, APPRO |
| POST | `/appro/purchase-orders/:id/cancel` | Annuler (ADMIN uniquement) | ADMIN |
| GET | `/appro/purchase-orders/late` | BC en retard | ADMIN, APPRO, PRODUCTION |
| GET | `/appro/purchase-orders/delay-stats` | Statistiques retards | ADMIN, APPRO, PRODUCTION |
| POST | `/appro/purchase-orders/:id/lock` | Acquerir lock | ADMIN, APPRO |
| POST | `/appro/purchase-orders/:id/unlock` | Liberer lock | ADMIN, APPRO |

#### A.4 Stock et rapports

| Methode | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/stock/mp` | Stock MP (module general) | Tous |
| GET | `/stock/mp/:id/stock` | Stock detail MP | Tous |
| GET | `/stock/mp/:id/movements` | Mouvements stock MP | Tous |
| GET | `/stock/alerts` | Alertes stock | Tous |
| GET | `/stock/value` | Valorisation stock | ADMIN, APPRO |
| POST | `/inventory/declare` | Declarer inventaire | ADMIN, APPRO |
| GET | `/reports/stock/valorization` | Rapport valorisation | ADMIN, APPRO |
| GET | `/reports/procurement/purchase-orders` | Rapport BC | ADMIN, APPRO |
| GET | `/reports/procurement/suppliers` | Rapport fournisseurs | ADMIN, APPRO |
| GET | `/reports/stock/movements` | Rapport mouvements | ADMIN, APPRO |

---

### Annexe B : Modele de donnees simplifie

```
ProductMp
  - id, code (MP-001), name, unit, category
  - minStock, seuilSecurite, seuilCommande, quantiteCommande
  - leadTimeFournisseur (jours)
  - consommationMoyJour, joursCouverture (calcules)
  - criticite (FAIBLE/MOYENNE/HAUTE/BLOQUANTE)
  - fournisseurPrincipalId
  - isPerishable

Supplier
  - id, code (FOUR-001), name
  - rc, nif, ai, nis (fiscalite algerienne)
  - leadTimeJours, delaiReelMoyen
  - tauxRetard, tauxEcartQuantite, tauxRupturesCausees
  - scorePerformance (0-100), grade (A/B/C)
  - isBlocked, blockedReason
  - isUnderSurveillance, surveillanceReason

PurchaseOrder
  - id (UUID), reference (BC-YYYY-NNNNN)
  - supplierId, status (DRAFT/SENT/CONFIRMED/PARTIAL/RECEIVED/CANCELLED)
  - totalHT (DA), expectedDelivery
  - sentVia (EMAIL/MANUAL/FAX), sentProofUrl, sentProofNote
  - version (verrouillage optimiste)
  - lockedById, lockExpiresAt (soft lock)

PurchaseOrderItem
  - purchaseOrderId, productMpId
  - quantity, quantityReceived
  - unitPrice, totalHT, tvaRate (0/9/19%)

ApproAlert
  - type (MP_CRITIQUE/RUPTURE/FOURNISSEUR_RETARD/PRODUCTION_BLOQUEE/DLC_PROCHE)
  - niveau (INFO/WARNING/CRITICAL)
  - entityType (MP/SUPPLIER/PRODUCTION/LOT)
  - entityId, message, metadata
  - acknowledgedAt, acknowledgedBy (tracabilite)

ReceptionMp
  - reference (REC-YYYYMMDD-NNN)
  - supplierId, date, blNumber, status
  - lines: [productMpId, quantity, unitCost, lotNumber, expiryDate, tvaRate]
```

---

### Annexe C : Formules de calcul de reference

**Consommation moyenne journaliere :**
```
consommationMoyJour = SUM(mouvements OUT sur 30 jours) / 30
```
Mise a jour par le batch quotidien `POST /appro/update-metrics` (role ADMIN).

**Jours de couverture :**
```
joursCouverture = stockActuel / consommationMoyJour
Si consommationMoyJour = 0 : joursCouverture = null (infini)
```

**Score performance fournisseur :**
```
tauxPonctualite = nbLivraisonsATemps / nbLivraisonsScorables
tauxConformiteQuantite = MOYENNE(min(qteRecue/qteCommandee, 1)) sur les 50 dernieres livraisons
scorePerformance = (tauxPonctualite x 50) + (tauxConformiteQuantite x 50)
```
Tolerance ponctualite : +1 jour par rapport a expectedDelivery.

**IRS (Indice de Risque Supply) :**
```
IRS = min(100, max(0, (nbBloquantesProduction x 30) + (nbRuptures x 20) + (nbSousSeuil x 10)))
```

**Impact level BC en retard :**
```
daysLate = (dateAujourdhui - expectedDelivery) en jours
isCritical = daysLate >= 3
hasCriticalMp = au moins une ligne avec MP criticite BLOQUANTE ou HAUTE
impactLevel =
  si isCritical ET hasCriticalMp : BLOQUANT
  si isCritical : MAJEUR
  sinon : MINEUR
```

---

### Annexe D : Reference rapide des codes d'erreur

| Code erreur | Message | Cause | Action |
|---|---|---|---|
| 400 | "Le BC doit contenir au moins une ligne" | Creation BC sans ligne | Ajouter au moins une MP |
| 400 | "seuilCommande doit etre superieur au seuilSecurite" | Parametrage incoherent | Corriger les valeurs |
| 400 | "Quantite invalide pour [MP]" | Quantite <= 0 | Saisir une quantite > 0 |
| 400 | "BC pas en statut DRAFT" | Envoi d'un BC deja envoye | Verifier le statut actuel |
| 400 | "BC pas en statut SENT" | Confirmation d'un BC non envoye | Envoyer d'abord le BC |
| 400 | "Sur-reception pour [MP]" | Reception depassant la commande | Verifier les quantites |
| 400 | "Le motif doit contenir au moins 10 caracteres" | Report avec motif trop court | Detailler le motif |
| 400 | "Duree invalide" | Report avec duree non standard | Utiliser 4h, 12h ou 24h |
| 400 | "Alerte deja accusee" | Double accusation | Aucune action requise |
| 400 | "Impossible d'annuler: reception partielle effectuee" | Annulation apres reception | Utiliser le processus de litige |
| 403 | "Les alertes RUPTURE ne peuvent pas etre reportees" | Report d'une alerte stock = 0 | Creer un BC immediatement |
| 403 | "Maximum 2 reports consecutifs atteint" | 3eme report en 7 jours | Creer un BC obligatoirement |
| 403 | "Seul un ADMIN peut annuler un BC" | Annulation par role non ADMIN | Demander a un ADMIN |
| 404 | "BC non trouve" | ID invalide ou supprime | Verifier la reference |
| 404 | "Fournisseur non trouve" | ID fournisseur invalide | Verifier l'ID |
| 404 | "Recette introuvable" | Check-production avec ID invalide | Verifier l'ID recette |
| 409 | "Conflit de version" | Modification concurrente du BC | Recharger la page et reessayer |

---

### Annexe E : Contacts et escalade

| Situation | Premier contact | Escalade | Delai max |
|---|---|---|---|
| Alerte CRITICAL non resolue en 4h | Responsable APPRO | Directeur Operations | 4 heures |
| Fournisseur bloque sans alternative | Responsable APPRO | Direction Generale | 24 heures |
| Rupture bloquant la production | Responsable APPRO + Chef Production | Direction Generale | 2 heures |
| BC annule par erreur | ADMIN ayant annule | Responsable APPRO | Immediat |
| Probleme technique systeme | Responsable APPRO | Equipe IT / Support | 1 heure |
| Ecart de reception significatif (> 10%) | Responsable APPRO | Responsable Qualite | 24 heures |

---

### Annexe F : Historique des versions du document

| Version | Date | Auteur | Modifications |
|---|---|---|---|
| 1.0.0 | Janvier 2026 | DSI | Creation initiale |
| 2.0.0 | Fevrier 2026 | DSI | Integration Alertes V1.2, BC lifecycle complet, performance fournisseurs, check-production, lock/unlock, reception partielle |

---

**FIN DU DOCUMENT**

*Ce manuel est un document vivant. Il doit etre revise a chaque evolution significative du module Approvisionnement. Toute suggestion d'amelioration doit etre transmise a la Direction des Systemes d'Information.*

*Document genere pour Manchengo Smart ERP - EURL MANCHENGO - Ouled Chbel, Alger, Algerie*

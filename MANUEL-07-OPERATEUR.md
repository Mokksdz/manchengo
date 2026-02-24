# MANUEL-07 : OPERATEUR TERRAIN

## Manchengo Smart ERP -- Manuel Utilisateur Detaille

| Champ | Valeur |
|---|---|
| **Version** | 1.0.0 |
| **Date** | 2026-02-24 |
| **Classification** | INTERNE -- USAGE OPERATIONNEL |
| **Public cible** | Operateurs terrain (production, livraison, inventaire) |
| **Prerequis** | Formation initiale ERP + habilitation hygiene HACCP |
| **Plateforme** | Web (Next.js 14 / Vercel), Mobile (Flutter -- a venir) |
| **Backend** | NestJS / Railway, PostgreSQL, Redis |

---

## TABLE DES MATIERES

1. [Fiche d'Identite du Role](#1-fiche-didentite-du-role)
2. [Workflow Complet (Step-by-Step)](#2-workflow-complet-step-by-step)
3. [Scenarios Reels](#3-scenarios-reels)
4. [Erreurs Humaines Frequentes](#4-erreurs-humaines-frequentes)
5. [Risques Metier Critiques](#5-risques-metier-critiques)
6. [Checklists Quotidienne / Hebdomadaire / Mensuelle](#6-checklists)
7. [Scripts de Formation Video](#7-scripts-de-formation-video)
8. [Matrice RACI](#8-matrice-raci)
9. [Niveaux de Maturite](#9-niveaux-de-maturite)
10. [Recommandations d'Optimisation](#10-recommandations-doptimisation)
11. [Glossaire Metier](#11-glossaire-metier)
12. [Annexes](#12-annexes)

---

## 1. FICHE D'IDENTITE DU ROLE

### 1.1 Definition

L'**Operateur Terrain** est l'executant operationnel de Manchengo Smart ERP. Il intervient directement sur les lignes de production fromagere, les tournees de livraison et les comptages d'inventaire physique. Son role est d'assurer l'execution fiable des ordres de fabrication, la validation securisee des livraisons et la declaration exacte des stocks physiques.

### 1.2 Perimetre RBAC

L'Operateur Terrain se mappe sur deux roles systeme selon son departement d'affectation :

| Departement | Role RBAC | Endpoints accessibles |
|---|---|---|
| **Atelier de production** | `PRODUCTION` | `/production`, `/recipes`, `/inventory/declare` |
| **Service commercial / livraison** | `COMMERCIAL` | `/deliveries`, `/deliveries/validate`, `/deliveries/pending` |

**Permissions cles :**

- **PRODUCTION** : Consulter les ordres de fabrication (OF), demarrer une production (`POST /production/:id/start`), completer une production (`POST /production/:id/complete`), consulter les recettes, verifier la disponibilite des stocks (`GET /recipes/:id/check-stock`), declarer un inventaire physique (`POST /inventory/declare`).
- **COMMERCIAL** : Consulter les livraisons en attente (`GET /deliveries/pending`), valider une livraison par QR code (`POST /deliveries/validate`), annuler une livraison (`POST /deliveries/:id/cancel`), consulter le detail d'une livraison (`GET /deliveries/:id`).

**Restrictions :**

- Aucun acces aux modules financiers (factures, paiements, CA).
- Aucun acces a la gestion des utilisateurs ni aux parametres systeme.
- Aucune capacite de creation d'OF (reserve au chef de production ou ADMIN).
- Aucune capacite de validation d'inventaire (reserve ADMIN -- regle de segregation des taches).

### 1.3 Profil type

- **Formation** : Technicien agroalimentaire, operateur de ligne, chauffeur-livreur.
- **Competences requises** : Lecture de fiche recette, maitrise des regles FIFO, connaissance des normes d'hygiene HACCP, utilisation de base d'un smartphone/tablette.
- **Contexte d'utilisation** : Environnement fromagerie (humidite, froid, gants), camion de livraison, entrepot.
- **Equipement** : Tablette ou smartphone avec application mobile (future Flutter) ou acces navigateur web simplifie.

### 1.4 Indicateurs de performance associes

| KPI | Cible | Source |
|---|---|---|
| Rendement de production | >= 95% | `GET /production/dashboard/kpis` (champ `week.avgYield`) |
| Taux de livraisons validees a l'heure | >= 98% | Module livraison |
| Ecart inventaire moyen | < 2% | Declarations `POST /inventory/declare` |
| Nombre de defauts qualite majeurs | 0 / mois | Champ `qualityStatus` des OF |
| Temps moyen de cloture d'un OF | < 4h | Ecart `startedAt` / `completedAt` |

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Prise de poste production

**Objectif** : Prendre connaissance des ordres de fabrication assignes, verifier les matieres premieres disponibles et demarrer la production sur la ligne.

**Etapes :**

1. **Connexion au systeme** -- S'authentifier avec ses identifiants sur l'interface web ou l'application mobile. Le systeme verifie le JWT et le role PRODUCTION.

2. **Consulter les OF assignes** -- Acceder a la liste des ordres de production filtrés par statut :
   - `GET /production?status=PENDING` : ordres en attente de demarrage.
   - Le systeme retourne pour chaque OF : la reference (format `OP-AAMMJJ-XXX`), le produit fini cible, le nombre de batchs, la quantite cible et la recette associee.

3. **Selectionner l'OF prioritaire** -- Identifier l'OF planifie pour le jour (`scheduledDate`) ou le plus ancien en statut PENDING.

4. **Consulter la fiche recette** -- Via `GET /recipes/:id`, verifier :
   - La liste des matieres premieres (items de type MP) avec quantites par batch.
   - Les fluides (type FLUID : eau, vapeur) qui n'affectent pas le stock.
   - Le poids de batch (`batchWeight`), la quantite de sortie (`outputQuantity`), la tolerance de perte (`lossTolerance`).
   - La duree de vie (`shelfLifeDays`) qui determinera la DLC du lot produit.

5. **Verifier la disponibilite des stocks** -- Via `GET /recipes/:id/check-stock?batchCount=N` :
   - Le systeme retourne pour chaque MP : quantite requise, quantite disponible, indicateur `isAvailable`, ecart (`shortage`).
   - Le champ `canProduce` indique si toutes les MP obligatoires (`isMandatory: true`) sont suffisantes.
   - **IMPORTANT** : Seuls les lots MP en statut `AVAILABLE`, non expires et avec quantite restante > 0 sont comptabilises. Les lots `BLOCKED` sont exclus.

6. **Verification physique croisee** -- AVANT de demarrer dans le systeme, verifier physiquement que les matieres premieres presentes en atelier correspondent aux lots que le systeme va consommer en FIFO. Verifier les numeros de lot, les DLC, l'integrite des emballages.

7. **Demarrer la production** -- Via `POST /production/:id/start` :
   - Le systeme change le statut de PENDING a IN_PROGRESS.
   - **CONSOMMATION FIFO AUTOMATIQUE** : le systeme consomme les lots MP du plus ancien au plus recent (FIFO strict), par transaction atomique avec isolation `Serializable`.
   - Chaque consommation cree un enregistrement `ProductionConsumption` liant l'OF au lot MP consomme.
   - Un mouvement de stock `PRODUCTION_OUT` est cree pour chaque lot MP.
   - L'horodatage `startedAt` est enregistre avec l'ID de l'operateur (`startedBy`).
   - **Si stock insuffisant** pour une MP obligatoire : le systeme retourne une erreur `INSUFFICIENT_STOCK` avec le detail du manque. Aucune consommation n'est effectuee (rollback complet).

**Point de controle** : Apres le demarrage, verifier sur l'ecran de l'OF que les consommations MP listees correspondent aux lots physiquement utilises.

---

### Workflow B : Suivi de production en cours

**Objectif** : Surveiller la production en cours, noter les evenements qualite et les anomalies.

**Etapes :**

1. **Consulter l'OF en cours** -- Via `GET /production/:id`, visualiser :
   - Les consommations MP effectuees (lots, quantites planifiees vs consommees).
   - Le statut `IN_PROGRESS` confirmant que les matieres ont ete consommees.

2. **Surveiller les parametres de production** -- Pendant le cycle de production :
   - Verifier la temperature, le pH, la texture selon les specifications de la fiche recette.
   - Consigner les observations dans un cahier de production physique (en attendant le module mobile).

3. **Consulter le dashboard production** -- Via `GET /production/dashboard/kpis` :
   - Productions du jour : terminees (`today.completed`), en cours (`today.inProgress`), en attente (`today.pending`).
   - Rendement moyen de la semaine (`week.avgYield`).
   - Nombre de rendements faibles (`week.lowYieldCount`).

4. **Verifier les alertes** -- Via `GET /production/dashboard/alerts` :
   - Alertes `DLC_PROCHE` : lots PF expirant dans 7 jours (severity `critical` si <= 3 jours).
   - Alertes `RENDEMENT_FAIBLE` : OF completes avec rendement < 90%.
   - Alertes `ORDRE_BLOQUE` : OF en PENDING depuis > 24h.
   - Alertes `STOCK_PF_BAS` : stock PF en dessous du seuil minimum.

---

### Workflow C : Cloture de production

**Objectif** : Finaliser l'ordre de fabrication en saisissant la quantite reellement produite et le controle qualite.

**Etapes :**

1. **Peser et compter la production** -- Determiner physiquement :
   - La quantite reellement produite (en unites du produit fini : kg, unites, etc.).
   - Le poids reel du batch si applicable (`batchWeightReal`).

2. **Effectuer le controle qualite** -- Evaluer la conformite :
   - `OK` : Production conforme aux specifications.
   - `DEFAUT_MINEUR` : Ecart acceptable, produit commercialisable avec reserve.
   - `DEFAUT_MAJEUR` : Non-conformite importante, necessitant action corrective.

3. **Completer la production** -- Via `POST /production/:id/complete` avec le body :
   ```json
   {
     "quantityProduced": 95,
     "batchWeightReal": 48.5,
     "qualityStatus": "OK",
     "qualityNotes": "Production conforme, texture homogene"
   }
   ```
   **Regles metier appliquees automatiquement :**
   - La quantite produite doit etre strictement > 0 (sinon, annuler l'OF).
   - Le rendement est calcule : `(quantityProduced / targetQuantity) * 100`.
   - Si le rendement est inferieur a la tolerance de perte de la recette, un warning `PRODUCTION_LOW_YIELD` est enregistre.
   - Un **lot PF** est cree automatiquement avec :
     - Numero de lot au format `{CODE_PF}-{AAMMJJ}-{SEQ}`.
     - Quantite initiale = quantite produite.
     - Date de fabrication = maintenant.
     - DLC = date de fabrication + `shelfLifeDays` de la recette.
     - Cout unitaire = somme des couts MP consommees / quantite produite.
   - Un mouvement de stock `PRODUCTION_IN` est cree (type PF, entree en stock).
   - Le statut passe a `COMPLETED` avec horodatage `completedAt`.

4. **Verification post-cloture** -- Confirmer que le lot PF apparait dans le systeme avec les bonnes informations (numero de lot, DLC, quantite).

---

### Workflow D : Livraison terrain

**Objectif** : Charger les marchandises, effectuer la livraison chez le client et valider la livraison par scan QR avec preuve de livraison.

**Etapes :**

1. **Consulter les livraisons du jour** -- Via `GET /deliveries/pending` :
   - Le systeme retourne les livraisons en statut `PENDING`, triees par date planifiee.
   - Pour chaque livraison : reference (format `LIV-AAMMJJ-XXX`), client, adresse, facture associee, montant.

2. **Preparer le chargement** -- Verifier les quantites a charger en comparant avec le detail de la livraison (`GET /deliveries/:id`) qui inclut les lignes de facture avec les produits PF.

3. **Se deplacer chez le client** -- Suivre l'itineraire prevu. Les notes de livraison (`deliveryNotes`) peuvent contenir des instructions particulieres.

4. **Scanner le QR code** -- A l'arrivee, scanner le QR imprime sur le bon de livraison :
   - **Format QR** : `MCG:DLV:{UUID}:{REFERENCE}:{CHECKSUM}`
   - Le checksum est un SHA256 tronque a 16 caracteres, calcule a partir de l'UUID, la reference et une cle secrete.

5. **Valider la livraison** -- Via `POST /deliveries/validate` :
   ```json
   {
     "qrCode": "MCG:DLV:550e8400-e29b-41d4-...:LIV-260224-001:a1b2c3d4e5f6g7h8",
     "deviceId": "uuid-du-terminal",
     "gpsCoordinates": "36.7538,3.0588",
     "recipientName": "Mohammed Benali",
     "recipientSignature": "base64_signature_data",
     "proofPhoto": "base64_photo_data"
   }
   ```
   **Verifications automatiques du systeme :**
   - Validation du format QR (5 segments separes par `:`, prefixe `MCG`, UUID valide).
   - Verification du type d'entite (`DLV` pour livraison).
   - **Verification cryptographique** du checksum SHA256 (comparaison en temps constant pour prevenir les attaques par timing).
   - Verification que l'utilisateur est actif.
   - Verification que le terminal est enregistre et actif (si `deviceId` fourni).
   - **Transaction atomique** avec isolation `Serializable` pour prevenir la double validation.
   - Verification du statut : rejet si deja validee (`DELIVERY_ALREADY_VALIDATED`) ou annulee (`DELIVERY_CANCELLED`).
   - **Rate limiting** : 30 scans maximum par minute par utilisateur.

6. **Enregistrement du journal de validation** -- A chaque tentative (succes ou echec), un `DeliveryValidationLog` immutable est cree avec : action, QR scanne, userId, deviceId, adresse IP, user-agent, succes/erreur, coordonnees GPS, temps de traitement.

7. **Traitement du rejet** -- Si la validation echoue :
   - `INVALID_QR_FORMAT` : QR mal scanne ou endommage. Re-scanner ou saisir manuellement.
   - `INVALID_QR_CHECKSUM` : QR potentiellement falsifie. Alerter immediatement le superviseur.
   - `DELIVERY_ALREADY_VALIDATED` : Livraison deja validee par un autre operateur. Contacter le depot.
   - `DELIVERY_NOT_FOUND` : Livraison inexistante dans le systeme. Verifier la reference.

8. **Annulation si necessaire** -- Via `POST /deliveries/:id/cancel` avec motif obligatoire (minimum 5 caracteres). Seules les livraisons en statut PENDING peuvent etre annulees.

---

### Workflow E : Comptage inventaire physique

**Objectif** : Realiser un comptage physique des stocks, prendre des photos justificatives et declarer les quantites dans le systeme.

**Etapes :**

1. **Preparer le comptage** -- S'equiper d'un terminal (tablette/smartphone), des fiches de comptage physiques et d'un appareil photo.

2. **Compter les produits** -- Pour chaque reference (MP ou PF) :
   - Compter physiquement toutes les unites presentes en stock.
   - Verifier les numeros de lots et les DLC.
   - Noter les anomalies (emballages endommages, produits non etiquetes, DLC depassees).

3. **Photographier les preuves** -- Prendre des photos des zones de stockage et des produits comptes (particulierement en cas d'ecart important).

4. **Declarer dans le systeme** -- Via `POST /inventory/declare` :
   ```json
   {
     "productType": "MP",
     "productId": 12,
     "declaredQuantity": 485,
     "notes": "3 sacs endommages, contenu intact",
     "evidencePhotos": ["base64_photo_1", "base64_photo_2"]
   }
   ```

5. **Analyse automatique par le systeme** -- Le systeme calcule :
   - **Stock theorique** : somme des mouvements IN - somme des mouvements OUT.
   - **Ecart** : quantite declaree - stock theorique.
   - **Pourcentage d'ecart** : |ecart| / stock theorique * 100.
   - **Valeur de l'ecart** : |ecart| * cout unitaire moyen.
   - **Niveau de risque** determine par les seuils suivants :

   | Type produit | Auto-approuve | Validation simple | Double validation |
   |---|---|---|---|
   | MP perissable | < 2% | 2-5% | > 5% ou > 50 000 DA |
   | MP non perissable | < 3% | 3-8% | > 8% ou > 50 000 DA |
   | PF (produit fini) | < 1% | 1-3% | > 3% ou > 50 000 DA |

6. **Resultat de la declaration** :
   - `AUTO_APPROVED` : ecart faible, mouvement d'ajustement cree automatiquement.
   - `PENDING_VALIDATION` : ecart moyen, en attente de validation par un ADMIN.
   - `PENDING_DOUBLE_VALIDATION` : ecart critique, requiert 2 validateurs ADMIN differents.

7. **Regles anti-fraude** :
   - **Segregation des taches** : le compteur ne peut jamais etre le validateur.
   - **Cooldown 4 heures** : impossible de redeclarer le meme produit avant 4h.
   - **Detection de patterns suspects** : 3 ecarts negatifs consecutifs sur 30 jours pour le meme produit par le meme compteur declenchent une alerte et forcent la validation meme si l'ecart est sous le seuil d'auto-approbation.

---

### Workflow F : Signalement d'anomalie

**Objectif** : Declarer un defaut qualite, un ecart de stock ou un probleme materiel constate pendant l'activite terrain.

**Etapes :**

1. **Defaut qualite en production** :
   - Lors de la cloture d'un OF, renseigner `qualityStatus: "DEFAUT_MAJEUR"` et detailler dans `qualityNotes`.
   - Le systeme enregistre le defaut dans l'OF et le lot PF associe.
   - Un rendement < 80% genere automatiquement une alerte `RENDEMENT_FAIBLE` de severite `critical`.

2. **Lot DLC depassee decouvert en atelier** :
   - Ne PAS utiliser le lot. Le signaler au chef de production.
   - Le lot doit etre mis en statut `BLOCKED` par un ADMIN dans le module stock.
   - Les lots BLOCKED sont automatiquement exclus de la consommation FIFO lors des futures productions.

3. **Ecart de stock important** :
   - Declarer via `POST /inventory/declare` avec photos justificatives.
   - Si l'ecart depasse les seuils, le systeme cree automatiquement une alerte avec `severity: CRITICAL` et `metadata.actionRequired: VALIDATE_OR_REJECT`.

4. **Panne reseau pendant operation terrain** :
   - En mode mobile futur : les operations sont enfilees localement et synchronisees au retour de la connectivite (architecture offline-first via le module sync : `POST /sync/push`).
   - En mode web actuel : noter les informations manuellement et les saisir des le retour de la connexion.

5. **QR code falsifie ou suspect** :
   - Si le scan retourne `INVALID_QR_CHECKSUM` : le QR est potentiellement falsifie.
   - Ne PAS valider manuellement. Contacter immediatement le superviseur.
   - L'evenement est automatiquement consigne dans le `DeliveryValidationLog` avec l'adresse IP et le terminal.

---

## 3. SCENARIOS REELS

### Scenario 1 : Production matin -- Fromage fondu

**Contexte** : Lundi 6h30, l'operateur Ahmed arrive pour la production matinale de fromage fondu (code PF : `FF-001`). L'OF `OP-260224-001` est planifie avec 3 batchs.

**Deroulement** :
1. Ahmed se connecte avec son compte PRODUCTION, consulte `GET /production?status=PENDING`.
2. Il selectionne l'OF et consulte la recette : 5 MP requises (lait en poudre, matiere grasse, sels de fonte, amidon, eau).
3. Il lance `GET /recipes/4/check-stock?batchCount=3` : toutes les MP sont disponibles, `canProduce: true`.
4. Ahmed verifie physiquement les lots en chambre froide : lot LP-260210-002 de lait en poudre (DLC 15/05/2026), lot MG-260218-001 de matiere grasse (DLC 30/04/2026).
5. Il lance `POST /production/1/start`. Le systeme consomme les lots en FIFO et affiche les consommations.
6. A 10h00, la production est terminee. Ahmed pese : 285 kg produits (cible 300 kg, rendement 95%).
7. Il complete avec `qualityStatus: "OK"`, `qualityNotes: "Texture homogene, pH 5.8"`.
8. Le lot `FF001-260224-001` est cree automatiquement avec DLC = 25/05/2026 (90 jours).

**Resultat** : OF complete, rendement 95%, lot PF en stock.

---

### Scenario 2 : Livraison avec QR refuse

**Contexte** : Karim, livreur COMMERCIAL, arrive chez le client Supermarche Alger Centre. Il scanne le QR du bon de livraison LIV-260224-003.

**Deroulement** :
1. Premier scan : erreur `INVALID_QR_FORMAT`. Le QR est partiellement endommage (tache de graisse sur l'etiquette).
2. Karim nettoie l'etiquette et rescanne. Deuxieme essai : erreur `INVALID_QR_CHECKSUM`.
3. Karim contacte le depot. Le responsable verifie dans le systeme que la livraison est bien en statut PENDING et que le QR est correct.
4. Diagnostic : l'etiquette QR a ete reimprimee avec une erreur de reference. Le depot genere une nouvelle etiquette.
5. En attendant, Karim fait signer manuellement le bon physique et note le probleme.
6. De retour au depot, le depot re-genere la livraison ou Karim rescanne le QR corrige.
7. Validation reussie avec `recipientName: "Ali Kader"`, photo de preuve.

**Point cle** : Le systeme a protege contre une validation avec un QR incorrect. Le journal de validation conserve les 3 tentatives avec les timestamps, IP et codes d'erreur.

---

### Scenario 3 : Inventaire de fin de mois

**Contexte** : Dernier jour du mois, l'equipe procede au comptage physique de l'entrepot MP.

**Deroulement** :
1. L'operateur Yacine commence par la zone laitiere. Il compte 12 palettes de lait en poudre = 2 400 kg.
2. Declaration : `POST /inventory/declare` avec `productType: "MP"`, `productId: 3`, `declaredQuantity: 2400`.
3. Stock theorique systeme : 2 450 kg. Ecart : -50 kg (-2.04%).
4. Le seuil MP perissable est 2% pour auto-approbation. L'ecart de 2.04% depasse legerement : statut `PENDING_VALIDATION`.
5. Yacine prend 3 photos de la zone de stockage et les joint comme `evidencePhotos`.
6. L'ADMIN Mourad consulte la declaration, verifie les photos, et valide avec motif : "Ecart marginal, pertes de manipulation confirmees".
7. Le mouvement d'ajustement `INVENTAIRE` est cree (-50 kg), le stock theorique est mis a jour.

**Point cle** : Mourad (validateur) est different de Yacine (compteur). Si Yacine avait tente de valider son propre comptage, le systeme aurait refuse avec `SELF_VALIDATION_FORBIDDEN`.

---

### Scenario 4 : Decouverte d'un lot DLC depassee en production

**Contexte** : Mercredi 8h, l'operatrice Fatima prepare une production de fromage a tartiner. Lors de la verification physique, elle decouvre que le lot de matiere grasse `MG-260105-002` a une DLC au 20/02/2026 (depassee de 4 jours).

**Deroulement** :
1. Fatima constate que le lot est physiquement present mais que l'etiquette indique une DLC depassee.
2. Elle NE LANCE PAS la production. Elle isole physiquement le lot et le marque "A BLOQUER".
3. Elle alerte le chef de production qui demande le blocage du lot dans le systeme (passage en statut `BLOCKED`).
4. Fatima relance `GET /recipes/:id/check-stock` pour verifier si la production reste faisable sans ce lot.
5. Le systeme recalcule : un lot plus recent `MG-260215-001` (DLC 15/06/2026) est disponible et suffisant.
6. Fatima lance la production. Le systeme consomme `MG-260215-001` en FIFO (le lot bloque est automatiquement exclu).

**Point cle** : La verification physique AVANT le demarrage systeme est OBLIGATOIRE. Le systeme exclut les lots BLOCKED de la consommation FIFO, mais ne peut pas verifier visuellement l'etat physique des lots.

---

### Scenario 5 : Panne reseau pendant une livraison

**Contexte** : Livreur Samir est en tournee dans une zone a faible couverture reseau. Il a 3 livraisons a valider.

**Deroulement** :
1. Premiere livraison : connexion OK, validation par QR reussie normalement.
2. Deuxieme livraison : perte de reseau 3G/4G. L'application web affiche une erreur de connexion.
3. Samir remplit manuellement le bon de livraison papier : nom du receptionnaire, signature, heure.
4. Il prend une photo du bon signe avec son telephone (stockage local).
5. Troisieme livraison : meme probleme. Meme procedure manuelle.
6. De retour au depot (connexion WiFi disponible), Samir saisit les 2 validations en attente.
7. **Future solution mobile (Flutter)** : les validations seront enfilees localement via le module sync (`POST /sync/push`) et synchronisees automatiquement au retour de la connectivite, avec idempotence via `clientEventId`.

**Point cle** : En mode web actuel, la procedure de secours papier est OBLIGATOIRE. Le module sync futur eliminera ce probleme grace a l'architecture offline-first.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Demarrer la production sans verification physique

**Description** : L'operateur lance `POST /production/:id/start` sans verifier que les lots physiques correspondent aux lots systeme.
**Risque** : Consommation FIFO d'un lot different de celui physiquement utilise. Rupture de tracabilite.
**Prevention** : Toujours croiser les numeros de lot physiques avec l'ecran systeme APRES le demarrage. En cas d'ecart, alerter immediatement.

### Erreur 2 : Saisir une quantite produite erronee

**Description** : Erreur de saisie dans `quantityProduced` (ex. 95 au lieu de 950).
**Risque** : Rendement aberrant (ex. 9.5% au lieu de 95%), lot PF cree avec une quantite fausse.
**Prevention** : Verifier l'ordre de grandeur AVANT de soumettre. Le systeme log un warning si le rendement est anormalement bas (< 90%).

### Erreur 3 : Oublier de completer l'OF

**Description** : La production est terminee physiquement mais l'operateur oublie de faire `POST /production/:id/complete`.
**Risque** : L'OF reste en statut IN_PROGRESS indefiniment. Pas de lot PF cree. Stock PF desynchronise. Apres 24h, une alerte `ORDRE_BLOQUE` est generee.
**Prevention** : Checklist de fin de poste obligatoire. Verifier qu'aucun OF n'est en IN_PROGRESS au depart.

### Erreur 4 : Scanner le mauvais QR code

**Description** : Le livreur scanne un QR d'une autre livraison (etiquettes melangees).
**Risque** : Validation croisee -- la mauvaise livraison est marquee comme livree.
**Prevention** : Toujours verifier que la reference sur le QR correspond au bon de livraison papier AVANT de scanner.

### Erreur 5 : Declarer l'inventaire sur le mauvais produit

**Description** : L'operateur selectionne `productId: 12` au lieu de `productId: 13` (deux references similaires).
**Risque** : Ecart fictif sur un produit, stock non ajuste sur le bon produit.
**Prevention** : Verifier le code produit (ex. `LP-001` vs `LP-002`) et le nom complet avant de declarer.

### Erreur 6 : Ignorer le cooldown de 4 heures

**Description** : L'operateur tente de redeclarer un inventaire pour le meme produit moins de 4h apres.
**Risque** : Le systeme refuse avec `INVENTORY_COOLDOWN`. L'operateur perd du temps.
**Prevention** : Planifier les comptages en avance. Respecter le delai de 4h entre deux comptages du meme produit.

### Erreur 7 : Valider une livraison sans preuve de reception

**Description** : Le livreur valide via QR sans renseigner `recipientName`, `recipientSignature` ni `proofPhoto`.
**Risque** : En cas de litige client ("je n'ai rien recu"), aucune preuve exploitable.
**Prevention** : Toujours recueillir au minimum le nom du receptionnaire et une photo de preuve.

### Erreur 8 : Ne pas signaler un defaut qualite

**Description** : L'operateur constate un defaut (texture anormale, odeur suspecte) mais complete avec `qualityStatus: "OK"` pour eviter les complications.
**Risque** : Mise en marche d'un produit non conforme. Responsabilite sanitaire. Non-conformite reglementaire.
**Prevention** : Formation obligatoire sur l'importance de la declaration loyale. Sanctions disciplinaires en cas de dissimulation avere.

### Erreur 9 : Tenter de forcer un scan QR par repetition

**Description** : Le livreur rescanne le meme QR en boucle en esperant que ca passe.
**Risque** : Declenchement du rate limit (30 scans/minute). Blocage temporaire du compte. Chaque tentative echouee est journalisee avec IP et terminal.
**Prevention** : Si un scan echoue 2 fois, contacter le support avant de reessayer.

### Erreur 10 : Melanger les unites de mesure

**Description** : Declarer un inventaire en grammes alors que le produit est gere en kilogrammes dans le systeme.
**Risque** : Ecart astronomique (ex. 485 000 g declare vs 485 kg theorique = ecart de +484 515 kg). Declenchement d'alerte critique, double validation requise.
**Prevention** : Verifier l'unite du produit dans le systeme (`unit`) avant toute declaration.

---

## 5. RISQUES METIER CRITIQUES

### 5.1 Securite alimentaire et tracabilite

| Risque | Gravite | Mesure dans l'ERP |
|---|---|---|
| Utilisation d'un lot DLC depassee | **CRITIQUE** | Lots expires automatiquement bloques par le job `lot-expiry`. Les lots BLOCKED sont exclus de la consommation FIFO. |
| Rupture de tracabilite ascendante | **CRITIQUE** | Chaque lot PF est lie a son OF, qui est lie aux consommations MP avec les lots MP utilises. Recherche par `GET /production/lots/search`. |
| Contamination croisee non detectee | **MAJEUR** | Le champ `qualityNotes` permet de tracer les anomalies. Les defauts majeurs declenchent des alertes. |
| Produit non conforme mis en marche | **CRITIQUE** | Le statut `qualityStatus` est enregistre pour chaque lot. `DEFAUT_MAJEUR` doit bloquer la distribution. |

### 5.2 Hygiene (HACCP)

- **Points de controle critiques (CCP)** : L'operateur doit verifier la temperature, le pH et la duree de traitement a chaque etape. Les notes qualite dans `qualityNotes` servent de registre numerique complementaire au cahier HACCP physique.
- **Nettoyage** : Avant chaque production, l'atelier doit etre nettoye conformement au plan HACCP. L'ERP ne gere pas ce processus directement mais le rendement (< tolerance) peut indiquer un probleme d'hygiene.

### 5.3 Integrite des donnees

| Risque | Mesure |
|---|---|
| Fraude sur inventaire (sous-declaration) | Segregation compteur/validateur, detection de patterns suspects (3 ecarts negatifs consecutifs), photos obligatoires pour ecarts > seuil |
| Falsification de QR de livraison | Checksum cryptographique SHA256, comparaison en temps constant, journalisation complete |
| Double validation de livraison | Transaction `Serializable`, verification de statut atomique |
| Modification retroactive | Audit trail complet (`AuditService`), mouvements de stock immutables |

### 5.4 Continuite d'activite

- **Panne reseau** : Procedure papier de secours obligatoire. Future architecture offline-first mobile.
- **Panne serveur** : L'ERP est deploye sur Railway avec redondance. En cas de panne prolongee, basculer sur les fiches papier.
- **Perte de terminal** : L'appareil peut etre desactive via le module Device (statut `isActive: false`). Les validations futures depuis ce terminal seront refusees.

---

## 6. CHECKLISTS

### 6.1 Checklist quotidienne -- Operateur production

- [ ] Se connecter au systeme et verifier les identifiants
- [ ] Consulter les OF du jour (`status=PENDING`, filtre `scheduledDate`)
- [ ] Verifier la disponibilite des MP pour chaque OF (`check-stock`)
- [ ] Realiser la verification physique croisee (lots, DLC, etat)
- [ ] Demarrer chaque OF dans le systeme APRES verification physique
- [ ] Surveiller les parametres qualite pendant la production
- [ ] Completer chaque OF avec quantite reelle et statut qualite
- [ ] Verifier qu'aucun OF ne reste en statut IN_PROGRESS en fin de journee
- [ ] Consulter les alertes du dashboard (`/dashboard/alerts`)
- [ ] Consigner les anomalies dans les notes qualite

### 6.2 Checklist quotidienne -- Operateur livraison

- [ ] Se connecter au systeme et verifier les identifiants
- [ ] Consulter les livraisons du jour (`GET /deliveries/pending`)
- [ ] Verifier le chargement (quantites, references, etat des emballages)
- [ ] S'assurer que les QR codes sont lisibles sur chaque bon
- [ ] Avoir le materiel de secours (bons papier, stylo, appareil photo)
- [ ] Pour chaque livraison : scanner QR, recueillir nom + signature + photo
- [ ] En cas d'echec de scan : noter manuellement et signaler au depot
- [ ] De retour : saisir les validations manuelles en attente
- [ ] Signaler toute annulation avec motif detaille (min. 5 caracteres)

### 6.3 Checklist hebdomadaire

- [ ] Consulter le rendement moyen de la semaine (`week.avgYield`)
- [ ] Identifier les OF a rendement faible (< 90%) et documenter les causes
- [ ] Verifier les alertes DLC proches pour les 7 prochains jours
- [ ] Signaler les lots physiquement endommages ou suspects
- [ ] Verifier la coherence entre stock physique visible et stock systeme (spot check)
- [ ] Nettoyer et verifier le materiel de scan (terminal, camera)

### 6.4 Checklist mensuelle

- [ ] Participer au comptage inventaire physique complet
- [ ] Declarer les quantites dans le systeme pour chaque produit assigne
- [ ] Fournir les photos justificatives pour les ecarts > 2%
- [ ] Revoir les alertes et anomalies du mois
- [ ] Mettre a jour sa connaissance des recettes (nouvelles formulations)
- [ ] Verifier la validite de ses habilitations HACCP
- [ ] Participer a la reunion de revue de production mensuelle

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Prise en main du systeme (15 minutes)

**Titre** : "Premiers pas dans Manchengo Smart ERP pour l'operateur terrain"

| Sequence | Duree | Contenu |
|---|---|---|
| 1.1 | 3 min | Presentation de l'interface : connexion, navigation, page d'accueil |
| 1.2 | 3 min | Comprendre les roles : ce que l'operateur peut et ne peut pas faire |
| 1.3 | 4 min | Naviguer dans la liste des OF : filtres par statut, recherche |
| 1.4 | 3 min | Lire une fiche recette : ingredients, quantites, parametres |
| 1.5 | 2 min | Que faire en cas de probleme de connexion |

**Evaluation** : QCM de 10 questions sur la navigation et les permissions.

---

### Module 2 : Production -- Du demarrage a la cloture (20 minutes)

**Titre** : "Gerer un ordre de fabrication de A a Z"

| Sequence | Duree | Contenu |
|---|---|---|
| 2.1 | 4 min | Verifier les stocks avant de demarrer (`check-stock`) |
| 2.2 | 4 min | La verification physique croisee : pourquoi et comment |
| 2.3 | 3 min | Demarrer la production : ce qui se passe sous le capot (FIFO) |
| 2.4 | 4 min | Completer la production : saisie quantite, poids reel, qualite |
| 2.5 | 3 min | Les alertes de rendement : comprendre et reagir |
| 2.6 | 2 min | Cas d'annulation : quand et comment annuler un OF |

**Exercice pratique** : Simuler la creation et la cloture d'un OF en environnement de test.

---

### Module 3 : Livraison et validation QR (15 minutes)

**Titre** : "Valider une livraison en toute securite"

| Sequence | Duree | Contenu |
|---|---|---|
| 3.1 | 3 min | Consulter les livraisons du jour et preparer la tournee |
| 3.2 | 4 min | Scanner un QR code : gestes techniques et positionnement |
| 3.3 | 3 min | Recueillir la preuve de livraison : nom, signature, photo |
| 3.4 | 3 min | Que faire quand le QR est refuse : diagnostic et escalade |
| 3.5 | 2 min | Annuler une livraison et la procedure papier de secours |

**Exercice pratique** : Scanner 5 QR codes de test avec differents scenarios (succes, format invalide, checksum errone, deja validee).

---

### Module 4 : Inventaire physique (15 minutes)

**Titre** : "Compter, photographier, declarer : le processus inventaire"

| Sequence | Duree | Contenu |
|---|---|---|
| 4.1 | 3 min | Preparer le comptage : zone, materiel, organisation |
| 4.2 | 3 min | Techniques de comptage : par palette, par emplacement |
| 4.3 | 3 min | Declarer dans le systeme : selection du produit, saisie quantite |
| 4.4 | 3 min | Comprendre les seuils : auto-approuve, validation, double validation |
| 4.5 | 3 min | Photographier correctement : cadrage, lisibilite des etiquettes |

**Exercice pratique** : Declarer un inventaire de test avec un ecart de 3% et observer le processus de validation.

---

### Module 5 : Securite alimentaire et tracabilite (10 minutes)

**Titre** : "Votre role dans la chaine de securite alimentaire"

| Sequence | Duree | Contenu |
|---|---|---|
| 5.1 | 2 min | La tracabilite ascendante/descendante expliquee simplement |
| 5.2 | 3 min | Reconnaitre un lot expire ou bloque : signaux visuels et systeme |
| 5.3 | 2 min | L'importance du FIFO en pratique terrain |
| 5.4 | 3 min | Declarer un defaut qualite : courage et responsabilite |

**Evaluation** : Mise en situation : "Vous trouvez un lot DLC depassee. Quelles sont vos 3 premieres actions ?"

---

## 8. MATRICE RACI

**Legende** : R = Responsable, A = Approbateur, C = Consulte, I = Informe

| Activite | Operateur Terrain | Chef de Production | ADMIN | Responsable Qualite |
|---|---|---|---|---|
| Consulter les OF du jour | **R** | I | I | - |
| Verifier les stocks MP | **R** | C | - | - |
| Verification physique croisee | **R** | A | - | C |
| Demarrer un OF dans le systeme | **R** | I | I | - |
| Surveiller la production | **R** | C | - | C |
| Completer l'OF (quantite + qualite) | **R** | A | I | I |
| Annuler un OF | C | **R** | A | I |
| Creer un nouvel OF | - | **R** | A | C |
| Preparer le chargement livraison | **R** | - | - | - |
| Valider livraison par QR | **R** | - | I | - |
| Annuler une livraison | **R** | - | I | - |
| Comptage physique inventaire | **R** | I | I | - |
| Declarer inventaire dans le systeme | **R** | I | I | - |
| Valider une declaration inventaire | - | C | **R/A** | I |
| Rejeter une declaration inventaire | - | C | **R/A** | I |
| Signaler un lot DLC depassee | **R** | A | I | **R** |
| Signaler un defaut qualite majeur | **R** | A | I | **R/A** |
| Bloquer un lot dans le systeme | - | C | **R** | A |
| Generer les QR de livraison | - | - | **R** | - |
| Configurer les seuils d'inventaire | - | C | **R** | C |

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 -- Debutant (Semaines 1-2)

- Sait se connecter au systeme et consulter les OF assignes.
- Sait lire une fiche recette et identifier les MP necessaires.
- Sait realiser une verification stock (`check-stock`) basique.
- Connait la procedure papier de secours.
- Necessite une supervision constante pour le demarrage et la cloture des OF.

### Niveau 2 -- Operationnel (Semaines 3-8)

- Maitrise le workflow complet de production : demarrage, surveillance, cloture.
- Sait interpreter les resultats de `check-stock` et identifier les ruptures.
- Effectue la verification physique croisee systematiquement.
- Sait scanner un QR de livraison et recueillir les preuves.
- Sait declarer un inventaire et comprend les seuils de validation.
- Sait reagir aux erreurs courantes (QR invalide, stock insuffisant).

### Niveau 3 -- Autonome (Mois 2-6)

- Execute les workflows sans supervision.
- Detecte proactivement les anomalies (DLC, ecarts visuels, defauts qualite).
- Comprend la logique FIFO et verifie sa coherence sur le terrain.
- Sait diagnostiquer les erreurs systeme (codes d'erreur, rate limiting).
- Contribue a l'amelioration des procedures terrain.
- Forme les nouveaux operateurs sur les gestes de base.

### Niveau 4 -- Referent (Apres 6 mois)

- Maitrise tous les workflows (production, livraison, inventaire).
- Sert de point d'escalade pour les autres operateurs.
- Participe a la definition des procedures et des checklists.
- Propose des ameliorations au systeme basees sur l'experience terrain.
- Capable d'analyser les KPIs de production et de les expliquer en reunion.
- Competent pour le tutorat des nouveaux arrivants sur l'ensemble du systeme.

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Court terme (0-3 mois)

1. **Deployer l'application mobile Flutter** avec architecture offline-first pour eliminer les procedures papier de secours en livraison.
2. **Activer les notifications push** pour alerter les operateurs terrain en temps reel (DLC proches, OF assignes, inventaires en attente).
3. **Implementer le scan camera natif** dans l'application mobile pour le scan QR (remplacement de la saisie manuelle).
4. **Ajouter un ecran simplifie** "Ma journee" affichant uniquement les OF et livraisons assignes a l'operateur connecte.

### 10.2 Moyen terme (3-6 mois)

5. **Automatiser la verification croisee** : scanner le code-barre des lots MP physiques et comparer avec les lots FIFO prevus par le systeme avant de demarrer.
6. **Ajouter la geolocalisation obligatoire** pour les validations de livraison (deja prevu dans le DTO `gpsCoordinates`).
7. **Implementer les tableaux de bord operateur** avec KPIs personnalises (mon rendement, mes livraisons du jour, mes comptages).
8. **Ajouter des photos obligatoires** pour la cloture de production (photo du lot emballe, etiquette DLC visible).

### 10.3 Long terme (6-12 mois)

9. **Integrer des capteurs IoT** (temperature, humidite) lies aux OF pour enrichir automatiquement les notes qualite.
10. **Deployer la signature electronique** dans l'application mobile pour les preuves de livraison (remplacement de la photo de signature).
11. **Machine learning** sur les ecarts d'inventaire pour detecter les patterns de fraude plus sophistiques.
12. **Planification intelligente** des tournees de livraison avec optimisation d'itineraire.
13. **Gamification** : tableau de classement des operateurs par rendement, precision d'inventaire, taux de validation QR au premier scan.

---

## 11. GLOSSAIRE METIER

### Termes de fromagerie et agroalimentaire

| Terme | Definition |
|---|---|
| **Batch** | Unite de production correspondant a une charge de la ligne. Le nombre de batchs multiplie par la quantite de sortie donne la quantite cible. |
| **DLC** | Date Limite de Consommation. Calculee automatiquement : date de fabrication + `shelfLifeDays` de la recette. |
| **FIFO** | First In First Out. Regle de consommation des lots : le lot le plus ancien (date de reception) est consomme en premier. Appliquee automatiquement par le systeme. |
| **Lot MP** | Lot de Matiere Premiere. Identifie par un numero unique (format `{CODE_MP}-{AAMMJJ}-{SEQ}`). Contient : quantite, fournisseur, DLC, cout unitaire. |
| **Lot PF** | Lot de Produit Fini. Cree automatiquement a la cloture d'un OF. Lie a l'OF et aux lots MP consommes pour la tracabilite. |
| **MP** | Matiere Premiere : ingredient entre en stock par reception fournisseur (lait en poudre, matiere grasse, sels de fonte, etc.). |
| **PF** | Produit Fini : produit fabrique pret a la vente (fromage fondu, fromage a tartiner, etc.). |
| **Rendement** | Ratio quantite produite / quantite cible x 100. Un rendement < 90% declenche une alerte. |
| **Tolerance de perte** | Pourcentage de perte acceptable defini dans la recette (`lossTolerance`). Par defaut : 2%. |
| **Sels de fonte** | Additifs utilises dans la fabrication du fromage fondu pour obtenir une texture homogene. |
| **Affinage** | Periode de maturation du fromage. Non gere directement par l'ERP (la DLC englobe cette duree). |
| **CCP** | Point de Controle Critique HACCP. Etape de production ou un danger doit etre maitrise. |

### Termes ERP et systeme

| Terme | Definition |
|---|---|
| **OF** | Ordre de Fabrication (= Production Order). Reference au format `OP-AAMMJJ-XXX`. Statuts : PENDING, IN_PROGRESS, COMPLETED, CANCELLED. |
| **QR Code livraison** | Code 2D au format `MCG:DLV:{UUID}:{REF}:{CHECKSUM}`. Securise par checksum SHA256. |
| **Rate limiting** | Limitation du nombre de requetes : 30 scans QR/minute pour prevenir les attaques par force brute. |
| **Segregation des taches** | Regle de controle interne : le compteur d'inventaire ne peut pas etre le validateur. Deux ADMIN differents pour la double validation. |
| **Auto-approbation** | Validation automatique d'un inventaire quand l'ecart est sous le seuil (< 2% MP perissable, < 1% PF). |
| **Double validation** | Approbation requise par 2 ADMIN differents pour les ecarts critiques (> 5% ou > 50 000 DA). |
| **Cooldown** | Delai de 4 heures entre deux declarations d'inventaire pour le meme produit. |
| **Offline-first** | Architecture mobile ou les operations sont enregistrees localement puis synchronisees au retour de la connectivite. |
| **Bootstrap** | Telechargement initial des donnees de reference (produits, clients) lors de la premiere connexion mobile (`POST /sync/bootstrap`). |
| **Mouvement de stock** | Enregistrement d'une entree (IN) ou sortie (OUT) de stock. Origine : RECEPTION, PRODUCTION_IN, PRODUCTION_OUT, PRODUCTION_CANCEL, INVENTAIRE, etc. |
| **Transaction atomique** | Operation tout-ou-rien : si une etape echoue, toutes les modifications sont annulees (rollback). |
| **Checksum** | Empreinte cryptographique du QR code (SHA256 tronque a 16 caracteres) garantissant l'authenticite. |
| **Idempotence** | Propriete d'une operation qui produit le meme resultat meme si executee plusieurs fois. Utilisee pour la synchronisation mobile (`clientEventId`). |

---

## 12. ANNEXES

### Annexe A : Format des codes QR livraison

```
Format complet : MCG:DLV:{UUID}:{REFERENCE}:{CHECKSUM}

Segments :
  [0] MCG           -- Prefixe Manchengo (fixe)
  [1] DLV           -- Type d'entite (DLV = livraison)
  [2] UUID          -- Identifiant unique de la livraison (format UUID v4)
  [3] REFERENCE     -- Reference humaine (format LIV-AAMMJJ-XXX)
  [4] CHECKSUM      -- SHA256({UUID}:{REFERENCE}:{SECRET_KEY})[0:16]

Exemple :
  MCG:DLV:550e8400-e29b-41d4-a716-446655440000:LIV-260224-001:a1b2c3d4e5f6g7h8

Verification :
  Le checksum est calcule cote serveur avec une cle secrete (QR_SECRET_KEY).
  La comparaison est effectuee en temps constant pour prevenir les attaques par timing.
  Tout echec de verification est journalise avec IP, terminal et timestamp.
```

### Annexe B : Codes d'erreur livraison

| Code | Message | Action operateur |
|---|---|---|
| `INVALID_QR_FORMAT` | Format QR code invalide | Nettoyer l'etiquette et rescanner. Si le probleme persiste, signaler au depot. |
| `INVALID_QR_CHECKSUM` | QR code invalide ou falsifie | NE PAS retenter. Contacter immediatement le superviseur. Possible tentative de fraude. |
| `INVALID_ENTITY_TYPE` | Ce QR code n'est pas un bon de livraison | Verifier que le bon document est scanne (pas un QR de production ou autre). |
| `DELIVERY_NOT_FOUND` | Livraison non trouvee | Verifier la reference. Le bon peut ne pas avoir ete cree dans le systeme. |
| `DELIVERY_ALREADY_VALIDATED` | Livraison deja validee | Contacter le depot pour verification. La livraison a deja ete confirmee. |
| `DELIVERY_CANCELLED` | Cette livraison a ete annulee | Ne pas livrer. Ramener la marchandise au depot. |
| `DEVICE_NOT_ACTIVE` | Appareil non autorise | Le terminal a ete desactive. Utiliser un autre terminal ou contacter l'ADMIN. |
| `USER_NOT_ACTIVE` | Compte utilisateur inactif | Contacter l'ADMIN pour reactivation du compte. |

### Annexe C : Codes d'erreur production

| Code | Message | Action operateur |
|---|---|---|
| `INSUFFICIENT_STOCK` | Stock insuffisant pour la MP | Verifier les lots disponibles. Alerter le chef de production pour reapprovisionner ou replanifier. |
| Statut != PENDING | Impossible de demarrer | L'OF n'est pas en statut PENDING. Verifier s'il a deja ete demarre ou annule. |
| Statut != IN_PROGRESS | Impossible de terminer | L'OF n'a pas ete demarre. Lancer d'abord `POST /production/:id/start`. |
| quantityProduced <= 0 | La quantite produite doit etre > 0 | Saisir la quantite reelle produite. Si la production est nulle, utiliser l'annulation. |

### Annexe D : Seuils d'inventaire detailles

```
MATIERES PREMIERES PERISSABLES (ex. lait en poudre, matiere grasse)
  |--- 0% a 2%   : AUTO_APPROVED (risque LOW)
  |--- 2% a 5%   : PENDING_VALIDATION (risque MEDIUM/HIGH)
  |--- > 5%       : PENDING_DOUBLE_VALIDATION (risque CRITICAL)
  |--- > 50 000 DA: PENDING_DOUBLE_VALIDATION (independamment du %)

MATIERES PREMIERES NON PERISSABLES (ex. emballages, sels de fonte)
  |--- 0% a 3%   : AUTO_APPROVED (risque LOW)
  |--- 3% a 8%   : PENDING_VALIDATION (risque MEDIUM/HIGH)
  |--- > 8%       : PENDING_DOUBLE_VALIDATION (risque CRITICAL)
  |--- > 50 000 DA: PENDING_DOUBLE_VALIDATION (independamment du %)

PRODUITS FINIS (fromage fondu, fromage a tartiner)
  |--- 0% a 1%   : AUTO_APPROVED (risque LOW)
  |--- 1% a 3%   : PENDING_VALIDATION (risque MEDIUM/HIGH)
  |--- > 3%       : PENDING_DOUBLE_VALIDATION (risque CRITICAL)
  |--- > 50 000 DA: PENDING_DOUBLE_VALIDATION (independamment du %)
```

### Annexe E : Procedures d'urgence

**Procedure U1 : Perte totale de connexion en livraison**
1. Basculer immediatement sur la procedure papier.
2. Remplir le bon de livraison manuscrit (duplicata carbone si disponible).
3. Faire signer le receptionnaire sur le bon papier.
4. Prendre une photo du bon signe (stockage local telephone).
5. Au retour de la connexion, saisir chaque livraison dans le systeme.
6. Signaler l'incident au superviseur pour traçabilite.

**Procedure U2 : Decouverte d'un lot contamine ou suspect**
1. STOP : arreter immediatement toute utilisation du lot.
2. ISOLER : placer le lot dans la zone de quarantaine.
3. IDENTIFIER : noter le numero de lot, le produit, la quantite.
4. ALERTER : prevenir le chef de production et le responsable qualite.
5. BLOQUER : demander le passage du lot en statut BLOCKED dans le systeme.
6. TRACER : verifier si ce lot a deja ete utilise dans des productions (via `GET /production/lots/search`).

**Procedure U3 : Erreur de demarrage production (mauvais lot consomme)**
1. NE PAS completer la production.
2. Alerter immediatement le chef de production.
3. Demander l'annulation de l'OF (`POST /production/:id/cancel`).
4. L'annulation reversera automatiquement les consommations FIFO (restauration des lots MP).
5. Un mouvement `PRODUCTION_CANCEL` est cree pour la tracabilite.
6. Relancer la production correctement apres verification.

**Procedure U4 : Terminal de scan perdu ou vole**
1. Alerter immediatement l'ADMIN.
2. L'ADMIN desactive le terminal dans le module Device (`isActive: false`).
3. Toute validation depuis ce terminal sera refusee (`DEVICE_NOT_ACTIVE`).
4. Les validations precedentes depuis ce terminal restent valides (journal immutable).

### Annexe F : Contacts utiles

| Role | Responsabilite | Quand contacter |
|---|---|---|
| Chef de production | Planification OF, validation recettes | OF bloque, anomalie recette, rupture MP |
| ADMIN systeme | Gestion utilisateurs, parametres | Probleme de connexion, blocage de lot, desactivation terminal |
| Responsable qualite | Normes HACCP, defauts qualite | Decouverte lot suspect, defaut majeur, DLC depassee |
| Responsable logistique | Tournees livraison, planning | QR defectueux, annulation livraison, probleme chargement |
| Support technique ERP | Infrastructure, bugs systeme | Erreur systeme repetee, lenteur, panne reseau |

### Annexe G : References de formation

| Module | Duree | Prerequis | Certificat |
|---|---|---|---|
| Formation initiale ERP (Modules 1-5) | 8h | Aucun | Obligatoire avant acces systeme |
| Recyclage semestriel | 2h | Formation initiale | Maintien de l'habilitation |
| Formation HACCP | 16h | Aucun | Obligatoire (reglementaire) |
| Formation securite alimentaire | 4h | HACCP | Recommandee |

---

**FIN DU MANUEL -- VERSION 1.0.0**

*Document genere le 2026-02-24 pour Manchengo Smart ERP.*
*Classification : INTERNE -- USAGE OPERATIONNEL.*
*Toute modification doit etre validee par le responsable qualite et l'ADMIN systeme.*

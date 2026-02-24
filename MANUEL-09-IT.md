# MANUEL-09-IT : Responsable IT Interne

**Manchengo Smart ERP -- Manuel Utilisateur**
**Role RBAC : ADMIN**
**Version : 2.0 -- Fevrier 2026**
**Classification : CONFIDENTIEL -- Usage interne**

---

> **Destinataire principal :** Le Responsable IT Interne (administrateur systeme) de l'entreprise agroalimentaire/fromagerie exploitant Manchengo Smart ERP.
> **Prerequis :** Connaissances en administration systeme Linux/Cloud, bases de donnees PostgreSQL, protocoles HTTP/HTTPS, concepts de cybersecurite, et familiarite avec les outils CI/CD (GitHub Actions).

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

### 1.1 Definition du poste

Le Responsable IT Interne occupe le role RBAC **ADMIN** dans Manchengo Smart ERP. Il est l'unique garant de l'infrastructure technique, de la securite du systeme d'information, de la continuite de service et de la conformite technique de la plateforme. Son perimetre couvre l'ensemble de la pile technique : backend NestJS deploye sur Railway, frontend Next.js 14 deploye sur Vercel, base de donnees PostgreSQL 17, cache Redis, pipeline CI/CD GitHub Actions, et la gestion de tous les appareils mobiles connectes.

### 1.2 Perimetre fonctionnel

| Domaine | Responsabilite | Endpoints API concernes |
|---|---|---|
| **Gestion des utilisateurs** | Creation, modification de role, reset mot de passe, activation/desactivation, blocage/deblocage | `GET/POST /admin/users`, `PUT /admin/users/:id`, `POST /admin/users/:id/reset-password`, `POST /admin/users/:id/toggle-status`, `POST /admin/users/:id/block`, `POST /admin/users/:id/unblock`, `POST /admin/users/:id/role` |
| **Gestion des appareils** | Enregistrement, surveillance synchronisation, revocation, reactivation | `GET /admin/devices`, `GET /admin/devices/:id`, `POST /admin/devices/:id/revoke`, `POST /admin/devices/:id/reactivate` |
| **Securite** | Logs de securite, audit trail, detection d'intrusion, mode urgence | `GET /admin/security-logs`, `GET /security/audit`, `GET /security/audit/security-events`, `GET /security/audit/stats` |
| **Monitoring** | KPIs systeme, alertes operationnelles, verifications manuelles | `GET /monitoring/kpis`, `GET /monitoring/alerts`, `POST /monitoring/alerts/:id/ack`, `POST /monitoring/alerts/:id/close`, `POST /monitoring/check` |
| **Gouvernance** | Retention de donnees, securite renforcee, feature flags, mode urgence | `GET /governance/retention/*`, `GET /governance/security/*`, `POST /governance/security/emergency-mode`, `GET/POST /governance/features/*` |
| **Licensing** | Gestion licences SaaS, entreprises, appareils | `GET /licensing/status`, `POST /licensing/activate`, `GET /licensing/company/:id`, `POST /licensing/company` |
| **Backup** | Sauvegarde PostgreSQL, test de restauration, verification d'integrite | Workflow GitHub Actions `backup.yml` |
| **CI/CD** | Pipeline de deploiement, scans de securite, tests automatises | Workflow GitHub Actions `ci.yml`, `deploy.yml` |
| **Sante systeme** | Verification de l'etat du backend | `GET /api/health` |
| **Cache** | Gestion du cache Redis, rate limiting | Module RedisCacheModule, RedisThrottlerStorage |

### 1.3 Roles RBAC dans le systeme

Le systeme definit quatre roles : `ADMIN`, `APPRO`, `PRODUCTION`, `COMMERCIAL`. Seul le role **ADMIN** a acces aux endpoints d'administration. Tous les controllers d'administration sont proteges par les guards `JwtAuthGuard` et `RolesGuard` avec le decorateur `@Roles('ADMIN')`.

### 1.4 Indicateurs de performance du role

- **Disponibilite systeme** : objectif 99.5% uptime mensuel
- **Temps de detection d'incident** (MTTD) : < 15 minutes (alertes automatiques toutes les 10 minutes)
- **Temps de resolution d'incident** (MTTR) : < 2 heures pour les incidents critiques
- **Backup** : 100% des sauvegardes quotidiennes reussies avec test de restauration
- **Vulnerabilites** : zero vulnerabilite HIGH/CRITICAL non resolue a plus de 7 jours
- **Compliance** : 100% des evenements de securite traces dans l'AuditLog

---

## 2. WORKFLOW COMPLET (STEP-BY-STEP)

### Workflow A : Gestion des utilisateurs

**Objectif :** Gerer le cycle de vie complet des comptes utilisateurs, de la creation a la desactivation.

#### A.1 -- Creer un nouvel utilisateur

1. **Se connecter** en tant qu'ADMIN via `POST /auth/login` (limite a 5 tentatives/minute).
2. **Naviguer** vers la page d'administration des utilisateurs dans le frontend ou appeler l'API directement.
3. **Appeler** `POST /admin/users` ou `POST /auth/users` avec le corps suivant :
   ```json
   {
     "email": "operateur@fromagerie.dz",
     "firstName": "Mohamed",
     "lastName": "Benali",
     "password": "MotDePasse!Temporaire1",
     "role": "PRODUCTION",
     "code": "USR-007"
   }
   ```
4. **Verifier** la creation : le systeme retourne l'utilisateur cree avec `mustChangePassword: true` si c'est un compte initial (seed).
5. **Communiquer** les identifiants temporaires au nouvel utilisateur par un canal securise (jamais par email non chiffre).
6. **Verifier** dans les logs de securite que l'evenement `USER_CREATED` apparait dans l'AuditLog avec la severite `INFO`.

**Points de controle :** Le mot de passe est hache avec bcrypt 12 rounds. Le code utilisateur doit etre unique. L'email doit etre unique (contrainte Prisma `@unique`).

#### A.2 -- Modifier le role d'un utilisateur

1. **Consulter** les roles existants : `GET /admin/users?role=COMMERCIAL` pour lister les utilisateurs par role.
2. **Changer le role** via `POST /admin/users/:id/role` avec `{ "role": "ADMIN" }`.
3. **L'evenement** `ROLE_CHANGE` est automatiquement inscrit dans les SecurityLog avec l'ancien role et le nouveau role.
4. **Verifier** que les sessions existantes ne donnent plus acces aux anciens endpoints (le guard verifie le role a chaque requete via le JWT).

**Attention :** Ne jamais promouvoir un utilisateur en ADMIN sans validation hierarchique prealable. Chaque changement de role est irreversible dans les logs d'audit.

#### A.3 -- Reinitialiser un mot de passe

1. **Appeler** `POST /admin/users/:id/reset-password` avec `{ "newPassword": "NouveauMdP!Temp2026" }`.
2. Le systeme met a jour le hash bcrypt (12 rounds) et positionne `mustChangePassword: true`.
3. L'evenement `PASSWORD_RESET` est inscrit dans l'AuditLog avec severite `CRITICAL`.
4. **Notifier** l'utilisateur qu'il devra changer son mot de passe a la prochaine connexion via `POST /auth/change-password`.

#### A.4 -- Desactiver / Bloquer un utilisateur

Deux mecanismes distincts existent :

- **Toggle status** (`POST /admin/users/:id/toggle-status`) : bascule le champ `isActive` du modele User. L'action est tracee dans les SecurityLog.
- **Block** (`POST /admin/users/:id/block`) : desactive le compte ET invalide immediatement tous les refresh tokens de l'utilisateur. L'evenement `USER_BLOCK` est enregistre. Toutes les sessions en cours deviennent invalides.

Pour debloquer : `POST /admin/users/:id/unblock` qui reactive le compte et inscrit `USER_UNBLOCK` dans les logs.

#### A.5 -- Analyser les logs d'un utilisateur

1. **Consulter les SecurityLog** : `GET /admin/security-logs?userId=<uuid>&action=LOGIN_FAILURE` pour voir les tentatives echouees.
2. **Consulter l'AuditLog** : `GET /security/audit?actorId=<uuid>&from=2026-02-01T00:00:00Z` pour l'historique complet des actions.
3. **Correler par requestId** : `GET /security/audit/request/:requestId` pour voir toutes les operations liees a une requete unique.
4. **Obtenir l'historique d'une entite** : `GET /security/audit/entity/:entityType/:entityId` pour reconstituer la chronologie d'un objet metier.

---

### Workflow B : Gestion des appareils

**Objectif :** Controler le parc d'appareils connectes (Android, iOS, Windows, macOS, Web) et leur synchronisation.

#### B.1 -- Lister et surveiller les appareils

1. **Lister tous les appareils** : `GET /admin/devices` avec les filtres optionnels `userId`, `isActive`, `limit`, `offset`.
2. Pour chaque appareil, les informations cles sont : `name`, `platform` (ANDROID/IOS/WINDOWS/MACOS/WEB), `appVersion`, `lastSyncAt`, `isActive`, `registeredAt`.
3. **Consulter un appareil specifique** : `GET /admin/devices/:id` retourne les details complets.
4. **Surveiller la synchronisation** : `GET /dashboard/sync/status` retourne l'etat de synchronisation de tous les appareils. `GET /dashboard/sync/events` retourne les evenements recents.
5. **Verifier la sante du systeme de sync** : `GET /sync/health` donne l'etat du module de synchronisation.

#### B.2 -- Revoquer un appareil

1. **Identifier l'appareil** a revoquer dans la liste.
2. **Appeler** `POST /admin/devices/:id/revoke` avec `{ "reason": "Appareil perdu - employe Mohamed" }`.
3. Le systeme positionne `isActive: false` sur l'appareil et inscrit l'evenement `DEVICE_REVOKE` dans les SecurityLog.
4. **L'appareil revoque** sera refuse lors de sa prochaine tentative de login ou de synchronisation.
5. **L'alerte** de type `DEVICE_REVOKED` est automatiquement creee dans le systeme d'alertes.

#### B.3 -- Reactiver un appareil

1. **Appeler** `POST /admin/devices/:id/reactivate`.
2. Le systeme remet `isActive: true`.
3. **Verifier** que l'appareil peut a nouveau synchroniser en consultant les evenements sync ulterieurs.

#### B.4 -- Onboarding d'un nouvel appareil

1. L'utilisateur se connecte depuis le nouvel appareil via `POST /auth/login`.
2. Le systeme enregistre automatiquement l'appareil et inscrit `DEVICE_REGISTER` dans les SecurityLog.
3. Le licensing verifie que le nombre d'appareils ne depasse pas la limite de la licence : `POST /licensing/register-device`.
4. L'IT valide l'appareil dans la console d'administration.
5. La synchronisation initiale (bootstrap) se fait via `POST /sync/bootstrap`.

---

### Workflow C : Monitoring securite

**Objectif :** Detecter, analyser et traiter les incidents de securite en temps reel.

#### C.1 -- Consulter les logs de securite

Le systeme enregistre 12 types d'evenements de securite (`SecurityAction`) :

| Action | Description | Criticite |
|---|---|---|
| `LOGIN_SUCCESS` | Connexion reussie | Normale |
| `LOGIN_FAILURE` | Echec de connexion | Surveillance |
| `LOGOUT` | Deconnexion | Normale |
| `DEVICE_REGISTER` | Enregistrement d'un nouvel appareil | Attention |
| `DEVICE_REVOKE` | Revocation d'un appareil | Critique |
| `USER_BLOCK` | Blocage d'un utilisateur | Critique |
| `USER_UNBLOCK` | Deblocage d'un utilisateur | Attention |
| `ROLE_CHANGE` | Changement de role | Critique |
| `SYNC_PUSH` | Push de synchronisation | Normale |
| `SYNC_PULL` | Pull de synchronisation | Normale |
| `ACCESS_DENIED` | Acces refuse | Surveillance |

**Requete type :** `GET /admin/security-logs?action=LOGIN_FAILURE&startDate=2026-02-24T00:00:00Z&limit=50`

#### C.2 -- Gestion des alertes

Le systeme de monitoring automatise (`AlertsService`) execute des verifications toutes les **10 minutes** (CRON) et detecte 13 types d'alertes :

**Alertes de securite :**
- `ACCESS_DENIED_SPIKE` : Plus de 10 acces refuses par heure -> severite CRITICAL
- `FAILED_LOGIN_SPIKE` : Plus de 15 echecs de connexion par heure -> severite CRITICAL
- `DEVICE_REVOKED` : Appareil revoque

**Alertes de synchronisation :**
- `DEVICE_OFFLINE` : Appareil n'ayant pas synchronise depuis 24 heures
- `SYNC_FAILURE` : Echec d'une operation de synchronisation
- `PENDING_EVENTS` : Plus de 50 evenements en attente (WARNING) ou 200 (CRITICAL)

**Alertes stock et fiscal :** `LOW_STOCK_MP`, `LOW_STOCK_PF`, `STOCK_EXPIRING`, `HIGH_CASH_SALES`, `MISSING_STAMP_DUTY`, `VAT_THRESHOLD`

**Cycle de vie d'une alerte :** `OPEN` -> `ACKNOWLEDGED` (vu par admin) -> `CLOSED` (resolu). Les alertes avec une date d'expiration (`expiresAt`) sont automatiquement fermees apres expiration.

**Actions :**
1. **Consulter** : `GET /monitoring/alerts?status=OPEN&severity=CRITICAL`
2. **Accuser reception** : `POST /monitoring/alerts/:id/ack` avec `{ "note": "En cours d'investigation" }`
3. **Fermer** : `POST /monitoring/alerts/:id/close` avec `{ "note": "Resolu - IP bloquee au firewall" }`
4. **Verifications manuelles** : `POST /monitoring/check` pour declencher un cycle de detection hors cron.

#### C.3 -- Audit trail et forensics

Le systeme d'audit (`AuditService`) est de grade forensique avec les proprietes suivantes :

- **Append-only** : aucune modification ni suppression possible (impose au niveau service).
- **Hash-chain SHA256** : chaque entree contient le hash de l'entree precedente, formant une chaine inviolable. Le premier hash reference `GENESIS`.
- **Verrouillage transactionnel** : `pg_advisory_xact_lock(42)` previent les conditions de course sur la chaine de hash.
- **Auto-contenu** : chaque entree capture WHO (actorId, actorRole, actorEmail), WHAT (action, severity), ON WHAT (entityType, entityId), WHEN (timestamp), et le contexte (requestId, ipAddress, userAgent, beforeState, afterState).

**30+ types d'actions** sont traces, couvrant : Stock (4), Production (4), Approvisionnement (5), Bons de commande (6), Fournisseurs (2), Securite (6), Administration (7), Overrides manuels (1).

**Reconstituer un incident :**
1. Identifier la plage temporelle : `GET /security/audit?from=2026-02-24T08:00:00Z&to=2026-02-24T10:00:00Z&severity=SECURITY`
2. Identifier l'acteur suspect : filtrer par `actorId`.
3. Correler les evenements par `requestId` pour reconstituer le flux d'une requete.
4. Verifier l'integrite de la chaine de hash en recalculant les hash SHA256 sequentiellement depuis GENESIS.
5. Exporter les resultats pour le rapport d'incident.

---

### Workflow D : Maintenance base de donnees

**Objectif :** Garantir l'integrite, la disponibilite et la recuperabilite des donnees PostgreSQL 17.

#### D.1 -- Backup automatise

Le workflow `backup.yml` (GitHub Actions) s'execute quotidiennement a **02:00 UTC** :

1. **Installation** de `pg_dump` version 17 (correspondant a la version Railway).
2. **Dump** en format custom avec compression maximale : `pg_dump "$DATABASE_URL" --format=custom --compress=9`.
3. **Verification d'integrite** : comptage des tables dans le dump via `pg_restore --list`.
4. **Test de restauration** : restauration complete sur une base PostgreSQL 17 de test ephemere.
5. **Validation** : comptage des lignes dans les tables cles (users, products_mp, clients, audit_logs).
6. **Archivage** : upload de l'artifact avec retention de 30 jours.

**Declenchement manuel :** Le workflow supporte `workflow_dispatch` pour un backup a la demande.

#### D.2 -- Restauration

1. Telecharger le fichier `.dump` depuis les artifacts GitHub Actions.
2. Provisionner une base PostgreSQL 17 vierge.
3. Executer : `pg_restore --no-owner --no-privileges --dbname=<target_db> <fichier.dump>`.
4. Verifier les tables critiques : `users`, `audit_logs`, `security_logs`, `products_mp`, `products_pf`, `invoices`.
5. Regenerer le client Prisma : `npx prisma generate`.
6. Valider la chaine de hash de l'AuditLog pour confirmer l'absence de corruption.

#### D.3 -- Gestion de la retention (Governance)

Le module de gouvernance permet de gerer la retention des donnees :

1. **Consulter les politiques** : `GET /governance/retention/policies`
2. **Voir l'etat de retention** : `GET /governance/retention/status`
3. **Purger des entites** (avec precaution) : `POST /governance/retention/purge` avec `{ "entityType": "SecurityLog", "dryRun": true }`. Le mode `dryRun` est active par defaut pour securite.

---

### Workflow E : Gestion CI/CD

**Objectif :** Maintenir un pipeline de deploiement continu fiable et securise.

#### E.1 -- Pipeline CI (ci.yml)

Le pipeline s'execute sur chaque push/PR vers `main` ou `develop`, plus un scan hebdomadaire (lundi 06:00 UTC). Il comprend 4 jobs paralleles :

1. **Backend** : npm ci -> Prisma generate -> Security audit -> Lint -> Type-check -> DB push -> Tests (201/201) -> Coverage -> Build
2. **Frontend** : npm ci -> Security audit -> Lint -> Type-check -> Unit tests -> Build
3. **Security Scan** : Audit vulnerabilites backend + frontend via `audit-ci --high`, detection de secrets hardcodes dans le code source
4. **Dependency Scan** : Scan approfondi des vulnerabilites HIGH/CRITICAL, generation de rapports JSON, archivage 30 jours

**Procedure en cas d'echec :**
1. Consulter les logs GitHub Actions pour identifier le job en echec.
2. Pour les echecs de tests : reproduire localement avec `npm test -- --ci`.
3. Pour les vulnerabilites : evaluer avec `npm audit` et appliquer `npm audit fix` ou upgrader la dependance.
4. Pour les echecs de build : verifier la compatibilite TypeScript avec `npx tsc --noEmit`.

#### E.2 -- Deploiement

- **Backend (Railway)** : deploiement automatique a chaque push sur `main`. Railway detecte le Dockerfile ou le buildpack Node.js.
- **Frontend (Vercel)** : deploiement automatique a chaque push sur `main`. Vercel execute `npm run build` dans `apps/web`.

**Rollback :**
- **Railway** : utiliser le dashboard Railway pour redeployer un commit anterieur ou restaurer depuis l'historique.
- **Vercel** : utiliser le dashboard Vercel > Deployments > selectionner un deploiement precedent > Promote to Production.
- **Base de donnees** : restaurer depuis le dernier backup valide (voir Workflow D.2).

---

### Workflow F : Gestion du cache Redis et rate limiting

**Objectif :** Optimiser les performances et proteger le systeme contre les abus.

#### F.1 -- Architecture du cache

Le module `RedisCacheModule` fournit un cache Redis global avec fallback automatique en memoire si Redis est indisponible :

- **TTL par defaut** : 300 secondes (5 minutes), configurable via `CACHE_TTL_DEFAULT`.
- **Reconnexion automatique** : backoff exponentiel (200ms x tentative, cap 5s), maximum 10 tentatives.
- **TCP probe** : verification de connectivite avec timeout de 2 secondes avant tentative de connexion.
- **Resilience** : les erreurs Redis sont loguees mais ne font jamais crasher le processus.

#### F.2 -- Rate limiting a 3 niveaux

Le rate limiting utilise `RedisThrottlerStorage` (implementation custom remplacant le stockage en memoire) :

| Niveau | Limite | Fenetre | Usage |
|---|---|---|---|
| **Short** | 10 requetes | 1 minute | Protection contre le spam |
| **Medium** | 100 requetes | 10 minutes | Limitation des automatisations |
| **Long** | 1000 requetes | 1 heure | Protection contre le scraping |

**Endpoints avec rate limiting specifique :**
- `POST /auth/login` : 5 tentatives par minute
- `POST /auth/refresh` : 20 tentatives par minute
- `POST /auth/change-password` : 5 tentatives par minute

**Surveillance :** En cas de rate limiting declenche, le serveur repond HTTP 429 (Too Many Requests). Les evenements sont traces dans les logs applicatifs.

---

### Workflow G : Audit trail et forensics

**Objectif :** Exploiter la chaine de hash de l'AuditLog pour reconstituer un incident de bout en bout.

#### G.1 -- Procedure de reconstitution d'incident

**Etape 1 -- Delimitation temporelle :**
```
GET /security/audit?from=2026-02-24T06:00:00Z&to=2026-02-24T18:00:00Z&severity=SECURITY&limit=100
```

**Etape 2 -- Identification de l'acteur :**
```
GET /security/audit?actorId=<uuid-suspect>&from=2026-02-24T06:00:00Z
```

**Etape 3 -- Correlation par requestId :**
```
GET /security/audit/request/<request-id>
```
Cette requete retourne TOUTES les entrees d'audit generees lors d'une meme requete HTTP, permettant de voir l'enchainement exact des operations.

**Etape 4 -- Historique d'une entite impactee :**
```
GET /security/audit/entity/StockMovement/123
```
Retourne la chronologie complete des modifications sur cette entite, avec `beforeState` et `afterState` pour chaque operation.

**Etape 5 -- Verification d'integrite de la chaine :**
Pour chaque entree N, recalculer :
```
hash_N = SHA256(JSON.stringify({
  previousHash: hash_{N-1},
  actorId, action, entityType, entityId, timestamp
}))
```
Si `hash_N` calcule differe de `hash_N` stocke, la chaine a ete falsifiee entre les entrees N-1 et N.

**Etape 6 -- Statistiques d'audit :**
```
GET /security/audit/stats
```
Retourne le total des logs aujourd'hui, cette semaine, et les evenements securite des dernieres 24 heures.

---

### Workflow H : Licensing et gestion multi-entreprise

**Objectif :** Gerer les licences SaaS et les tenants multi-entreprise.

**Note :** Ces endpoints sont prevus pour l'evolutivite SaaS et ne sont pas exposes dans le frontend actuel.

#### H.1 -- Creer une entreprise avec licence d'essai

```
POST /licensing/company
{
  "name": "Fromagerie Atlas",
  "email": "contact@atlas-fromage.dz",
  "taxId": "000123456789",
  "address": "Zone Industrielle Blida",
  "phone": "+213 555 123 456"
}
```
Le systeme cree automatiquement une licence TRIAL.

#### H.2 -- Activer une licence

```
POST /licensing/activate
{ "licenseKey": "MCG-PRO-2026-XXXX", "companyId": "<uuid>" }
```
Les niveaux de licence sont : `TRIAL`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`.

#### H.3 -- Gerer les utilisateurs d'une entreprise

```
POST /licensing/company/:id/add-user
{ "userId": "<uuid>", "isAdmin": true }
```

#### H.4 -- Desactiver un appareil d'entreprise

```
POST /licensing/company/:id/deactivate-device
{ "deviceId": "<uuid>" }
```

#### H.5 -- Verifier les permissions d'ecriture

```
GET /licensing/check-write
```
Retourne `{ "writeAllowed": true/false }` selon l'etat de la licence (mode lecture seule si licence expiree).

---

## 3. SCENARIOS REELS

### Scenario 1 : Attaque brute force detectee

**Contexte :** A 03:47 du matin, le systeme de monitoring detecte un pic d'echecs de connexion.

**Detection :**
1. Le CRON de l'`AlertsService` (toutes les 10 minutes) compte les `LOGIN_FAILURE` de la derniere heure.
2. Le seuil de 15 echecs/heure est depasse -> creation d'une alerte `FAILED_LOGIN_SPIKE` avec severite `CRITICAL` et expiration automatique dans 2 heures.
3. Le rate limiting sur `POST /auth/login` (5 tentatives/minute) est deja en action et retourne HTTP 429 aux requetes excessives.

**Reponse de l'IT :**
1. **Constater** l'alerte : `GET /monitoring/alerts?status=OPEN&severity=CRITICAL`.
2. **Accuser reception** : `POST /monitoring/alerts/:id/ack` avec note "Investigation en cours".
3. **Analyser les logs** : `GET /admin/security-logs?action=LOGIN_FAILURE&startDate=2026-02-24T02:00:00Z`.
4. **Identifier les IP sources** dans les champs `ipAddress` des SecurityLog.
5. **Verifier les comptes cibles** : si un seul compte est vise, le bloquer immediatement via `POST /admin/users/:id/block`.
6. **Bloquer les IP** au niveau du firewall Railway ou Cloudflare si utilise.
7. **Fermer l'alerte** : `POST /monitoring/alerts/:id/close` avec note detaillee incluant les IP bloquees et les comptes proteges.

**Mesures preventives :**
- Le systeme track deja les `failedLoginAttempts` par utilisateur dans le modele User.
- Le verrouillage automatique est actif apres le seuil configure.
- Envisager l'activation du mode urgence : `POST /governance/security/emergency-mode` avec `{ "mode": "LOCKDOWN", "reason": "Brute force attack detected" }`.

---

### Scenario 2 : Panne Redis ou base de donnees

**Contexte :** Le backend repond lentement ou retourne des erreurs 500.

**Panne Redis :**
1. Le `RedisCacheModule` detecte la panne via le TCP probe (timeout 2 secondes).
2. Le systeme bascule automatiquement en cache in-memory avec le message log : "Redis connection failed, using in-memory cache".
3. La reconnexion est tentee avec backoff exponentiel (200ms, 400ms, ... cap 5s, max 10 tentatives).
4. Le rate limiting continue de fonctionner en memoire (degradation gracieuse).

**Actions IT :**
1. Verifier l'etat de Redis sur Railway : dashboard Railway > Service Redis > Logs.
2. Si Redis est tombe : redemarrer le service depuis Railway.
3. Verifier que le backend a bien rebasculer sur Redis apres restauration (log "Redis connected").
4. Aucune perte de donnees car Redis ne contient que du cache et du rate limiting (donnees ephemeres).

**Panne PostgreSQL :**
1. Toutes les requetes Prisma echouent -> erreurs 500 en cascade.
2. Verifier sur Railway : dashboard > PostgreSQL service > Metrics.
3. Si la base est corrompue : restaurer depuis le dernier backup (Workflow D.2).
4. Apres restauration : `npx prisma db push` pour s'assurer que le schema est a jour.
5. Verifier l'integrite de la chaine d'audit apres restauration.
6. Redemarrer le backend Railway pour reinitialiser toutes les connexions.

---

### Scenario 3 : Onboarding d'un nouvel appareil mobile

**Contexte :** Un nouveau commercial reçoit une tablette Android pour les tournees de livraison.

**Procedure :**
1. **Creer le compte utilisateur** (Workflow A.1) avec le role `COMMERCIAL`.
2. **Installer l'application** Manchengo sur la tablette Android.
3. **Premiere connexion** : l'utilisateur entre ses identifiants. Le systeme :
   - Authentifie via `POST /auth/login` (JWT + refresh token en httpOnly cookies).
   - Enregistre l'appareil automatiquement (evenement `DEVICE_REGISTER` dans SecurityLog).
   - Valide la licence via `POST /licensing/register-device` (verifie la limite d'appareils).
4. **Changement de mot de passe obligatoire** si `mustChangePassword: true` (flag seed).
5. **Bootstrap de synchronisation** : `POST /sync/bootstrap` pour telecharger les donnees initiales.
6. **Verification IT** :
   - `GET /admin/devices` -> verifier que le nouvel appareil apparait avec `isActive: true`.
   - `GET /dashboard/sync/status` -> verifier que la synchronisation initiale est terminee.
   - `GET /admin/security-logs?action=DEVICE_REGISTER` -> confirmer l'enregistrement.
7. **Formation** : s'assurer que l'utilisateur sait synchroniser manuellement si besoin.

---

### Scenario 4 : Audit de securite externe

**Contexte :** Un auditeur externe demande des preuves de conformite securitaire.

**Elements a fournir :**

1. **Architecture securitaire** :
   - JWT httpOnly cookies + CSRF tokens (timing-safe comparison)
   - Bcrypt 12 rounds pour les mots de passe
   - HSTS (max-age=31536000), X-Frame-Options DENY, X-Content-Type-Options nosniff
   - CSP (Content Security Policy), Referrer-Policy strict-origin-when-cross-origin
   - TLS 1.3 impose par Railway
   - Swagger desactive en production (`GET /docs` retourne 404)

2. **Audit trail** :
   - Exporter les logs d'audit : `GET /security/audit?from=<debut>&to=<fin>&limit=100`
   - Demontrer la chaine de hash : fournir les hash SHA256 et prouver l'integrite GENESIS -> dernier enregistrement
   - Prouver l'append-only : montrer l'absence de methodes update/delete dans `AuditService`

3. **Rate limiting** : documenter les 3 niveaux (short/medium/long) et les limites specifiques par endpoint.

4. **Gestion des incidents** :
   - `GET /monitoring/alerts?status=CLOSED` : historique des alertes resolues
   - `GET /security/audit/security-events?hours=720` : evenements securite des 30 derniers jours
   - `GET /governance/security/status` : statistiques de securite et mode urgence

5. **Pipeline CI/CD** : fournir les resultats des scans de vulnerabilites (`dependency-audit-reports` artifacts, retention 30 jours).

6. **Backup** : fournir les preuves de sauvegardes quotidiennes et tests de restauration (artifacts `backup-*`, retention 30 jours).

---

### Scenario 5 : Migration / Mise a jour systeme

**Contexte :** Mise a jour majeure du backend NestJS ou de PostgreSQL.

**Procedure de migration :**

1. **Preparation :**
   - Declencher un backup manuel : GitHub Actions > `backup.yml` > Run workflow.
   - Verifier que le backup est valide (test de restauration dans le workflow).
   - Creer une branche `feature/migration-v2` depuis `main`.

2. **Mise a jour des dependances :**
   - `npm update` dans `apps/backend` et `apps/web`.
   - `npx prisma migrate dev` pour les changements de schema.
   - Lancer les tests : `npm test -- --ci` (les 201 tests doivent passer).

3. **Deploiement :**
   - Merger la branche vers `main` via Pull Request.
   - Le pipeline CI valide automatiquement (4 jobs).
   - Railway deploie automatiquement le nouveau backend.
   - Vercel deploie automatiquement le nouveau frontend.

4. **Post-deploiement :**
   - `GET /api/health` -> verifier `{ "status": "ok" }`.
   - `GET /monitoring/kpis` -> verifier les KPIs systeme.
   - `GET /sync/health` -> verifier la sante de la synchronisation.
   - Tester manuellement un login, une creation de produit, une synchronisation mobile.

5. **Rollback si probleme :**
   - Railway : redeployer le commit precedent.
   - Vercel : promouvoir le deploiement precedent.
   - Base de donnees : restaurer le backup pre-migration si necessaire.

---

## 4. ERREURS HUMAINES FREQUENTES

### Erreur 1 : Oublier de tester le backup apres restauration
**Risque :** Decouvrir lors d'une panne reelle que le backup est corrompu ou incomplet.
**Prevention :** Le workflow `backup.yml` inclut deja un test de restauration automatise. Verifier regulierement les artifacts et les logs du workflow.

### Erreur 2 : Promouvoir un utilisateur en ADMIN sans necessitee
**Risque :** Elevation de privileges non justifiee, surface d'attaque elargie.
**Prevention :** Appliquer le principe du moindre privilege. Chaque promotion en ADMIN est tracee dans les SecurityLog (`ROLE_CHANGE`) et l'AuditLog. Exiger une validation ecrite prealable.

### Erreur 3 : Ne pas revoquer les appareils des employes partants
**Risque :** Acces non autorise aux donnees de l'entreprise apres depart.
**Prevention :** Integrer la revocation des appareils dans la procedure de depart RH : `POST /admin/devices/:id/revoke` + `POST /admin/users/:id/block`.

### Erreur 4 : Ignorer les alertes WARNING en se concentrant uniquement sur les CRITICAL
**Risque :** Les WARNING non traitees s'accumulent et deviennent des CRITICAL (ex: pending events 50 -> 200).
**Prevention :** Traiter les alertes WARNING dans les 4 heures. Utiliser `GET /monitoring/alerts?severity=WARNING&status=OPEN` dans la checklist quotidienne.

### Erreur 5 : Modifier les variables d'environnement Railway sans tester
**Risque :** Erreur de configuration qui casse le backend en production (ex: JWT_SECRET modifie -> tous les tokens invalides).
**Prevention :** Tester toute modification dans un environnement staging avant de l'appliquer en production. Les variables critiques sont : `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.

### Erreur 6 : Effectuer un purge de retention sans dry run prealable
**Risque :** Suppression irreversible de donnees historiques.
**Prevention :** Le systeme active `dryRun: true` par defaut sur `POST /governance/retention/purge`. Toujours executer d'abord en mode dry run pour verifier l'impact.

### Erreur 7 : Ne pas surveiller la taille de la base de donnees
**Risque :** PostgreSQL atteint la limite de stockage Railway -> crash et indisponibilite.
**Prevention :** Monitorer mensuellement la taille via Railway Dashboard > PostgreSQL > Metrics. Configurer des alertes de seuil.

### Erreur 8 : Reinitialiser un mot de passe avec un mot de passe faible
**Risque :** Compromission immediate du compte.
**Prevention :** Utiliser un generateur de mots de passe et respecter la politique : minimum 12 caracteres, majuscule, minuscule, chiffre, caractere special. Le hachage bcrypt 12 rounds protege en cas de fuite, mais un mot de passe faible reste vulnerable au dictionnaire.

### Erreur 9 : Ne pas mettre a jour les dependances npm regulierement
**Risque :** Accumulation de vulnerabilites connues exploitables.
**Prevention :** Le pipeline CI execute `npm audit` a chaque push et un scan approfondi hebdomadaire. Traiter les vulnerabilites HIGH/CRITICAL sous 7 jours.

### Erreur 10 : Utiliser le mode urgence (Emergency Mode) de maniere excessive
**Risque :** Bloquer les operations metier legitimement critiques (facturation, livraisons).
**Prevention :** Le mode urgence (`POST /governance/security/emergency-mode`) est reserve aux situations de compromission active. Documenter chaque activation avec raison et duree prevue. Desactiver des que la menace est ecartee.

---

## 5. RISQUES METIER CRITIQUES

### 5.1 Cybersecurite

| Risque | Impact | Probabilite | Mitigation en place |
|---|---|---|---|
| Attaque brute force sur l'authentification | Compromission de comptes | Moyenne | Rate limiting 5/min sur login, compteur `failedLoginAttempts` par utilisateur, alerte `FAILED_LOGIN_SPIKE` |
| Vol de session (JWT) | Usurpation d'identite | Faible | JWT httpOnly cookies, CSRF tokens timing-safe, refresh tokens en base avec expiration |
| Injection SQL | Fuite de donnees, corruption | Tres faible | Prisma ORM (requetes parametrees), pas de SQL brut sauf `pg_advisory_xact_lock` (constante) |
| XSS / CSRF | Actions non autorisees | Faible | CSP headers, X-Frame-Options DENY, CSRF token double-submit cookie pattern |
| Elevation de privileges | Acces admin non autorise | Faible | Guards RBAC sur tous les controllers admin, role verifie a chaque requete JWT |
| Compromission de la chaine CI/CD | Code malveillant deploye | Faible | GitHub Actions avec secrets isoles, branches protegees, scans de securite automatiques |

### 5.2 Disponibilite

| Risque | Impact | Probabilite | Mitigation en place |
|---|---|---|---|
| Panne Railway (backend) | ERP inaccessible | Faible | Monitoring Railway, health check `GET /api/health` |
| Panne Vercel (frontend) | Interface web indisponible | Tres faible | CDN distribue Vercel, pages statiques en cache |
| Panne Redis | Degradation performances | Moyenne | Fallback automatique en cache in-memory, reconnexion avec backoff exponentiel |
| Panne PostgreSQL | Perte totale de service | Faible | Backups quotidiens avec test de restauration, retention 30 jours |
| Saturation disque PostgreSQL | Crash de la base | Moyenne | Monitoring taille, politiques de retention des donnees |

### 5.3 Integrite des donnees

| Risque | Impact | Probabilite | Mitigation en place |
|---|---|---|---|
| Falsification de l'audit trail | Non-conformite reglementaire | Tres faible | Hash-chain SHA256, append-only, pg_advisory_xact_lock |
| Conflit de synchronisation mobile | Donnees incoherentes | Moyenne | `SyncConflictResolver`, idempotency keys (24h TTL), `SyncEventApplier` |
| Corruption de backup | Restauration impossible | Faible | Test de restauration automatique dans le workflow backup |
| Perte de donnees par soft-delete non maitrise | Donnees considees perdues | Faible | Soft delete avec raison (`isDeleted`, `deletedReason`) trace dans AuditLog |

---

## 6. CHECKLISTS QUOTIDIENNE / HEBDOMADAIRE / MENSUELLE

### 6.1 Checklist quotidienne (15 minutes)

- [ ] Verifier `GET /api/health` retourne `{ "status": "ok" }`
- [ ] Consulter `GET /monitoring/alerts?status=OPEN` : traiter toute alerte CRITICAL immediatement
- [ ] Verifier `GET /monitoring/kpis` : indicateurs systeme dans les normes
- [ ] Consulter `GET /admin/security-logs?action=LOGIN_FAILURE&limit=10` : verifier l'absence de pattern d'attaque
- [ ] Verifier `GET /dashboard/sync/status` : tous les appareils actifs ont synchronise dans les 24 dernieres heures
- [ ] Verifier le workflow `backup.yml` sur GitHub Actions : le dernier run est en succes
- [ ] Consulter `GET /security/audit/stats` : comparer avec les tendances habituelles

### 6.2 Checklist hebdomadaire (45 minutes)

- [ ] Revoir toutes les alertes WARNING non resolues : `GET /monitoring/alerts?status=OPEN&severity=WARNING`
- [ ] Analyser les evenements de securite de la semaine : `GET /security/audit/security-events?hours=168`
- [ ] Verifier les resultats du scan de dependances hebdomadaire (GitHub Actions > ci.yml > dependency-scan)
- [ ] Revoir les appareils inactifs : `GET /admin/devices?isActive=true` puis identifier ceux sans `lastSyncAt` recent
- [ ] Verifier les utilisateurs avec `failedLoginAttempts > 0` et investiguer si necessaire
- [ ] Consulter les metriques Railway : CPU, memoire, stockage PostgreSQL
- [ ] Verifier les deploiements Vercel : aucun deploiement en echec
- [ ] Tester manuellement un login + navigation sur l'interface web
- [ ] Revoir les feature flags : `GET /governance/features/rollout-status`

### 6.3 Checklist mensuelle (2 heures)

- [ ] **Audit complet des comptes** : `GET /admin/users` -> verifier que chaque compte est encore necessaire, desactiver les comptes inutilises
- [ ] **Audit complet des appareils** : `GET /admin/devices` -> revoquer les appareils non utilises depuis plus de 30 jours
- [ ] **Test de restauration manuelle** : telecharger le dernier backup, restaurer localement, verifier l'integrite
- [ ] **Verification de la chaine d'audit** : echantillonnage aleatoire de 10 entrees, verification du hash chain
- [ ] **Revue des politiques de retention** : `GET /governance/retention/status` -> ajuster si necessaire
- [ ] **Mise a jour des dependances** : `npm audit` sur backend et frontend, planifier les mises a jour
- [ ] **Revue des seuils d'alerte** : evaluer si les seuils actuels (deviceOfflineHours: 24, failedLoginSpikePerHour: 15, etc.) sont adaptes
- [ ] **Documentation** : mettre a jour la documentation technique si des changements ont ete effectues
- [ ] **Rapport mensuel** : rediger un rapport incluant uptime, incidents, alertes, mises a jour, et recommandations
- [ ] **Verification des secrets** : s'assurer que les secrets GitHub Actions (DATABASE_URL, etc.) n'ont pas ete compromis

---

## 7. SCRIPTS DE FORMATION VIDEO

### Module 1 : Prise en main du tableau de bord IT (20 minutes)

**Sequence 1 (0:00 - 5:00) -- Connexion et navigation :**
"Bonjour et bienvenue dans ce module de formation sur le tableau de bord IT de Manchengo Smart ERP. Je suis connecte en tant qu'administrateur systeme. Apres la connexion via la page de login, je suis redirige vers le dashboard principal. En tant que role ADMIN, j'ai acces a toutes les sections du systeme. Commencons par l'endpoint de sante : GET /api/health, qui doit retourner status ok. C'est le premier reflexe chaque matin."

**Sequence 2 (5:00 - 12:00) -- Vue d'ensemble des KPIs :**
"Naviguons vers la section Monitoring. L'endpoint GET /monitoring/kpis nous donne une vue synthetique : sante de la synchronisation, niveaux de stock matieres premieres et produits finis, metriques fiscales du jour, et statut de securite. Chaque indicateur est calcule en temps reel depuis PostgreSQL. Si un indicateur est en rouge, cela signifie qu'une alerte a ete ou sera creee."

**Sequence 3 (12:00 - 17:00) -- Gestion des alertes :**
"La section Alertes affiche toutes les alertes actives. Elles sont triees par statut puis par severite. Une alerte CRITICAL en statut OPEN doit etre traitee immediatement. Je clique sur l'alerte pour voir les details, puis j'accuse reception via le bouton Acknowledge. Une fois le probleme resolu, je ferme l'alerte avec une note explicative."

**Sequence 4 (17:00 - 20:00) -- Recapitulatif :**
"En resume, votre routine quotidienne comprend trois etapes : verifier la sante, consulter les KPIs, et traiter les alertes. Cela prend environ 15 minutes par jour. Dans le prochain module, nous verrons la gestion des utilisateurs."

---

### Module 2 : Gestion des utilisateurs et des acces (25 minutes)

**Sequence 1 (0:00 - 8:00) -- Creation d'utilisateur :**
"Dans ce module, nous allons creer un utilisateur de type PRODUCTION pour un nouvel operateur de la fromagerie. Je navigue vers Administration > Utilisateurs et je clique sur Creer. Je remplis les champs : email, prenom, nom, code unique (format USR-XXX), role PRODUCTION, et un mot de passe temporaire. Le systeme hache le mot de passe avec bcrypt 12 rounds. L'operateur devra changer ce mot de passe a sa premiere connexion."

**Sequence 2 (8:00 - 15:00) -- Modification de role et reset mot de passe :**
"Imaginons qu'un employe passe du service production au service commercial. Je modifie son role de PRODUCTION a COMMERCIAL. L'evenement ROLE_CHANGE est immediatement inscrit dans les logs de securite. Pour le reset de mot de passe, j'utilise le bouton correspondant et je genere un nouveau mot de passe temporaire."

**Sequence 3 (15:00 - 20:00) -- Blocage et analyse des logs :**
"En cas de suspicion de compromission, je peux bloquer immediatement un utilisateur. Cette action invalide tous ses tokens de session en cours. Je consulte ensuite les logs de securite filtres par cet utilisateur pour comprendre ce qui s'est passe."

**Sequence 4 (20:00 - 25:00) -- Bonnes pratiques :**
"Rappelons les regles d'or : principe du moindre privilege pour les roles, mots de passe temporaires toujours communiques par canal securise, verification hebdomadaire des comptes actifs, et revocation systematique lors du depart d'un employe."

---

### Module 3 : Gestion des appareils mobiles et synchronisation (20 minutes)

**Sequence 1 (0:00 - 7:00) -- Vue d'ensemble du parc :**
"Le systeme gere cinq plateformes d'appareils : ANDROID, IOS, WINDOWS, MACOS, et WEB. Chaque appareil est associe a un utilisateur et trace par son identifiant unique, sa version d'application, et sa derniere synchronisation. Naviguons vers la liste des appareils pour voir l'etat du parc."

**Sequence 2 (7:00 - 13:00) -- Surveillance de la synchronisation :**
"Le module Sync est le coeur du fonctionnement offline-first. Les appareils envoient des evenements via POST /sync/push et recuperent les mises a jour via GET /sync/pull. Le systeme utilise l'idempotence (IdempotencyKey avec TTL 24h) pour eviter les doublons et le SyncConflictResolver pour gerer les conflits. Je surveille les evenements en attente : si leur nombre depasse 50, une alerte WARNING est creee ; au-dessus de 200, c'est CRITICAL."

**Sequence 3 (13:00 - 18:00) -- Revocation et onboarding :**
"Pour revoquer un appareil perdu, je selectionne l'appareil et je clique sur Revoquer en precisant la raison. L'appareil sera refuse a sa prochaine tentative de connexion. Pour l'onboarding d'un nouvel appareil, le processus est largement automatise : premiere connexion, enregistrement automatique, verification de licence, puis bootstrap de synchronisation."

**Sequence 4 (18:00 - 20:00) -- Points d'attention :**
"Surveillez les appareils qui n'ont pas synchronise depuis plus de 24 heures : ils generent une alerte DEVICE_OFFLINE. Verifiez regulierement que les versions d'application sont a jour sur tous les appareils."

---

### Module 4 : Securite avancee -- Audit trail et forensics (30 minutes)

**Sequence 1 (0:00 - 10:00) -- Comprendre la chaine de hash :**
"L'AuditLog de Manchengo est concu selon des principes forensiques. Chaque entree contient un hash SHA256 calcule a partir du hash precedent, de l'acteur, de l'action, de l'entite et du timestamp. Cela forme une chaine ou toute modification d'une entree rompt la chaine a partir de ce point. La premiere entree reference le hash GENESIS. Le verrou transactionnel pg_advisory_xact_lock(42) garantit qu'aucune ecriture concurrente ne peut casser la sequence."

**Sequence 2 (10:00 - 20:00) -- Investigation d'un incident :**
"Simulons une investigation : un ecart de stock a ete detecte sur le produit PF-003. J'utilise GET /security/audit/entity/StockMovement/PF-003 pour obtenir la chronologie complete. Chaque entree montre le beforeState (etat avant) et afterState (etat apres). Je peux identifier exactement qui a effectue chaque modification, depuis quelle adresse IP, et a quel moment. Si je veux voir toutes les operations d'une meme requete, j'utilise le requestId pour la correlation."

**Sequence 3 (20:00 - 27:00) -- Verification d'integrite :**
"Pour un audit externe, je dois prouver que la chaine n'a pas ete alteree. Je recupere un echantillon d'entrees consecutives et je recalcule les hash. Si chaque hash calcule correspond au hash stocke, l'integrite est prouvee. Le fait que le service AuditService ne contient aucune methode de mise a jour ou de suppression renforce cette garantie."

**Sequence 4 (27:00 - 30:00) -- Statistiques et reporting :**
"L'endpoint GET /security/audit/stats fournit les metriques pour les tableaux de bord : total des logs aujourd'hui, cette semaine, et evenements securite des dernieres 24 heures. Ces chiffres servent de base au rapport mensuel de securite."

---

### Module 5 : CI/CD, backups et gestion des incidents (25 minutes)

**Sequence 1 (0:00 - 8:00) -- Pipeline CI/CD :**
"Le pipeline de deploiement continu comprend 4 jobs paralleles declenchees a chaque push ou pull request. Le job Backend execute les 201 tests unitaires et d'integration avec PostgreSQL 16 et Redis 7 comme services containers. Le job Frontend verifie le lint, le typage et compile l'application. Le job Security cherche les vulnerabilites connues et les secrets en dur dans le code. Le job Dependency Scan analyse les dependances avec retention des rapports pendant 30 jours."

**Sequence 2 (8:00 - 15:00) -- Gestion des backups :**
"Le backup quotidien s'execute a 02:00 UTC via GitHub Actions. Il utilise pg_dump version 17 en format custom avec compression maximale. Apres le dump, il verifie l'integrite en listant les tables, puis effectue une restauration complete sur une base de test. Les artifacts sont conserves 30 jours. Pour un backup a la demande, j'utilise le bouton Run workflow dans GitHub Actions."

**Sequence 3 (15:00 - 22:00) -- Gestion d'un incident en production :**
"En cas d'incident, la procedure est : 1) Constater via health check et alertes. 2) Communiquer aux equipes metier. 3) Diagnostiquer via les logs Railway, les security logs et l'audit trail. 4) Remedier : rollback, restauration de backup, ou correction et redeploiement. 5) Post-mortem : documenter l'incident, les causes, et les actions correctives."

**Sequence 4 (22:00 - 25:00) -- Mode urgence :**
"En cas de compromission active, le mode urgence via POST /governance/security/emergency-mode permet de verrouiller le systeme. Le kill switch sur les feature flags via POST /governance/features/kill-switch permet de desactiver rapidement une fonctionnalite defaillante. Ces mecanismes sont des outils de dernier recours."

---

## 8. MATRICE RACI

| Activite | IT (ADMIN) | Direction | APPRO | PRODUCTION | COMMERCIAL |
|---|:---:|:---:|:---:|:---:|:---:|
| Creation de compte utilisateur | **R/A** | I | - | - | - |
| Attribution / modification de role | **R** | **A** | I | I | I |
| Reset de mot de passe | **R/A** | I | - | - | - |
| Blocage / deblocage utilisateur | **R/A** | I | - | - | - |
| Enregistrement d'appareil | **R** | I | C | C | C |
| Revocation d'appareil | **R/A** | I | - | - | - |
| Surveillance des alertes securite | **R/A** | I | - | - | - |
| Reponse a un incident de securite | **R** | **A** | I | I | I |
| Backup quotidien | **R/A** | I | - | - | - |
| Test de restauration mensuel | **R/A** | I | - | - | - |
| Mise a jour des dependances | **R/A** | I | - | - | - |
| Deploiement en production | **R** | **A** | I | I | I |
| Rollback en production | **R** | **A** | I | I | I |
| Audit de securite externe | **R** | **A** | - | - | - |
| Gestion des licences | **R** | **A** | - | - | - |
| Politiques de retention | **R** | **A** | C | C | C |
| Feature flags / kill switch | **R/A** | I | - | - | - |
| Mode urgence (LOCKDOWN) | **R** | **A** | I | I | I |
| Formation des utilisateurs | **R** | **A** | C | C | C |
| Documentation technique | **R/A** | I | - | - | - |

**Legende :** R = Responsable (execute), A = Accountable (approuve), C = Consulte, I = Informe

---

## 9. NIVEAUX DE MATURITE

### Niveau 1 -- Reactif (Initial)

- Les alertes sont traitees manuellement et de facon ad hoc.
- Les backups sont configures mais pas toujours verifies.
- La gestion des utilisateurs est faite a la demande sans processus formel.
- Aucune revue periodique des comptes ou des appareils.
- Les mises a jour de securite sont appliquees quand un probleme survient.
- Les incidents sont resolus sans documentation post-mortem.

**Indicateurs :** MTTR > 4 heures, alertes non traitees accumulees, backups non verifies.

### Niveau 2 -- Discipline (Gere)

- Les checklists quotidiennes et hebdomadaires sont suivies.
- Les backups sont verifies automatiquement (test de restauration dans le workflow).
- Les comptes et appareils sont revus mensuellement.
- Les alertes CRITICAL sont traitees dans l'heure, les WARNING dans les 4 heures.
- Chaque incident fait l'objet d'un post-mortem ecrit.
- Les mises a jour de dependances sont planifiees mensuellement.

**Indicateurs :** MTTR < 2 heures, zero alerte CRITICAL non traitee a plus d'1 heure, 100% backups verifies.

### Niveau 3 -- Proactif (Defini)

- Les seuils d'alerte sont ajustes trimestriellement en fonction des tendances.
- Des tests de penetration sont effectues annuellement.
- La chaine d'audit est verifiee par echantillonnage mensuel.
- Un plan de reprise d'activite (PRA) est documente et teste semestriellement.
- Les feature flags sont utilises pour les deploiements progressifs.
- Les metriques de securite sont reportees mensuellement a la direction.

**Indicateurs :** MTTD < 10 minutes, zero vulnerabilite HIGH non resolue a plus de 3 jours, PRA teste.

### Niveau 4 -- Optimise (Maitrise)

- Monitoring synthétique avec alertes predictives (anticipation des pannes).
- Deploiement canary/blue-green avec rollback automatique.
- Tests de chaos engineering periodiques (simuler la panne Redis, la panne DB).
- Compliance continue : verification automatisee de la chaine d'audit.
- SOC (Security Operations Center) ou SIEM integre.
- Zero-trust architecture avec mTLS entre les services.

**Indicateurs :** Disponibilite > 99.9%, MTTD < 5 minutes, MTTR < 30 minutes, zero incident de securite par an.

### Niveau 5 -- Excellence (Optimise)

- Auto-remediation : les incidents courants sont resolus automatiquement (ex: restart Redis, scale backend).
- Intelligence artificielle pour la detection d'anomalies dans les patterns de securite.
- Infrastructure as Code (IaC) complete avec Terraform/Pulumi.
- Disaster Recovery multi-region.
- Conformite ISO 27001 / SOC 2 certifiee.
- Budget IT aligne sur la valeur metier avec metriques ROI.

**Indicateurs :** Disponibilite > 99.99%, incidents auto-remedies > 80%, certification obtenue.

---

## 10. RECOMMANDATIONS D'OPTIMISATION

### 10.1 Court terme (0-3 mois)

1. **Implementer des notifications en temps reel pour les alertes CRITICAL.** Actuellement, les alertes sont detectees toutes les 10 minutes par CRON. Integrer un webhook vers un canal Slack ou Telegram pour les alertes CRITICAL afin de reduire le MTTD a moins de 2 minutes.

2. **Configurer un monitoring externe (uptime).** Utiliser un service comme UptimeRobot ou Betterstack pour surveiller `GET /api/health` toutes les minutes et alerter en cas de non-reponse. Cela detecte les pannes meme si le systeme de monitoring interne est lui-meme en panne.

3. **Ajouter des metriques Prometheus/Grafana.** Le module `metrics` existe deja dans le codebase. L'exposer via un endpoint `/metrics` et le connecter a un stack Prometheus + Grafana pour des dashboards visuels.

4. **Automatiser la rotation des refresh tokens expires.** Ajouter un CRON de nettoyage des RefreshToken expires dans la base pour eviter l'accumulation.

5. **Documenter les runbooks d'incidents.** Creer un runbook pour chaque type d'alerte (FAILED_LOGIN_SPIKE, DEVICE_OFFLINE, etc.) avec les etapes exactes de diagnostic et de remediation.

### 10.2 Moyen terme (3-6 mois)

6. **Mettre en place un environnement staging.** Deployer un second environnement Railway+Vercel avec une copie anonymisee des donnees pour tester les mises a jour avant production.

7. **Implementer le monitoring des WebSockets.** Le module `websocket` existe deja. Monitorer les connexions WebSocket pour la synchronisation en temps reel et detecter les deconnexions anormales.

8. **Augmenter la retention des backups.** Passer de 30 jours d'artifacts GitHub Actions a un stockage S3/GCS pour une retention plus longue avec des politiques de lifecycle.

9. **Implementer le chiffrement des donnees au repos.** PostgreSQL sur Railway supporte le chiffrement au repos. Verifier qu'il est active et documenter la gestion des cles.

10. **Automatiser les tests de restauration de backup.** Etendre le workflow backup pour inclure un test fonctionnel post-restauration (ex: appeler les endpoints API sur la base restauree).

### 10.3 Long terme (6-12 mois)

11. **Deployer l'application desktop Tauri 2.x.** Le module `apps/desktop` est prevu dans l'architecture. Le desktop offrira de meilleures performances et un acces offline-first natif.

12. **Deployer l'application mobile Flutter.** Le module `apps/mobile` est prevu. Cela remplacera les WebViews par une experience native Android/iOS.

13. **Implementer un SIEM (Security Information and Event Management).** Centraliser les SecurityLog, AuditLog, et les logs applicatifs dans un SIEM pour la detection avancee de menaces.

14. **Preparer la certification ISO 27001.** L'infrastructure de securite actuelle (audit trail, RBAC, chiffrement, rate limiting) constitue une base solide. Identifier les ecarts restants et planifier la remediation.

15. **Evoluer vers une architecture multi-region.** Pour les clients critiques, deployer le backend sur plusieurs regions Railway avec replication PostgreSQL pour la haute disponibilite.

---

## 11. GLOSSAIRE METIER

### Termes IT et infrastructure

| Terme | Definition |
|---|---|
| **NestJS** | Framework backend Node.js utilise pour l'API REST de Manchengo Smart ERP. Structure modulaire avec controllers, services, et guards. |
| **Next.js 14** | Framework frontend React utilise pour l'interface web. Deploye sur Vercel avec rendu cote serveur et generation statique. |
| **Prisma ORM** | Object-Relational Mapping utilise pour interagir avec PostgreSQL. Genere un client type-safe a partir du schema `schema.prisma`. |
| **Railway** | Plateforme cloud hebergeant le backend NestJS, PostgreSQL 17, et Redis. |
| **Vercel** | Plateforme cloud hebergeant le frontend Next.js avec CDN global. |
| **BullMQ** | Systeme de files d'attente (queues) base sur Redis pour les taches asynchrones. |
| **TanStack Query** | Bibliotheque de gestion d'etat et de cache cote client pour les requetes API. |
| **Socket.io** | Bibliotheque WebSocket pour la communication temps reel entre le backend et le frontend. |
| **Tauri 2.x** | Framework pour application desktop, prevu pour la version desktop de l'ERP. |
| **Flutter** | Framework multi-plateforme mobile, prevu pour l'application mobile native. |

### Termes de securite

| Terme | Definition |
|---|---|
| **JWT (JSON Web Token)** | Token d'authentification signe contenant l'identite de l'utilisateur. Expire apres 15 minutes (configurable via `JWT_EXPIRES_IN`). |
| **httpOnly cookie** | Cookie inaccessible depuis JavaScript (protection XSS). Utilise pour stocker le access token et le refresh token. |
| **CSRF (Cross-Site Request Forgery)** | Attaque forcant un utilisateur authentifie a effectuer une action non desiree. Prevenue par le double-submit cookie pattern avec comparaison timing-safe. |
| **bcrypt** | Algorithme de hachage de mot de passe avec facteur de cout. Manchengo utilise 12 rounds (2^12 = 4096 iterations). |
| **Rate limiting** | Limitation du nombre de requetes par unite de temps pour prevenir les abus. Trois niveaux : short (10/min), medium (100/10min), long (1000/h). |
| **HSTS** | HTTP Strict Transport Security. Header forcant les navigateurs a utiliser HTTPS. Configure avec max-age=31536000 (1 an). |
| **CSP** | Content Security Policy. Header limitant les sources de contenu executables pour prevenir les injections XSS. |
| **TLS 1.3** | Derniere version du protocole de chiffrement des communications HTTPS. Impose par Railway. |
| **Hash-chain** | Chaine de hash ou chaque entree contient le hash de la precedente. Garantit l'integrite et la non-falsification de la sequence d'audit. |
| **SHA256** | Algorithme de hachage cryptographique produisant un hash de 256 bits. Utilise pour la chaine d'audit. |
| **Soft delete** | Suppression logique (marquage `isDeleted: true`) sans effacer physiquement les donnees, preservant la tracabilite. |
| **RBAC** | Role-Based Access Control. Modele de controle d'acces ou les permissions sont attribuees par role (ADMIN, APPRO, PRODUCTION, COMMERCIAL). |
| **Idempotency key** | Cle unique garantissant qu'une operation n'est executee qu'une seule fois meme si la requete est rejouee. TTL de 24 heures. |

### Termes ERP et metier

| Terme | Definition |
|---|---|
| **MP (Matiere Premiere)** | Ingrediants bruts utilises dans la fabrication (lait, presure, ferments, etc.). |
| **PF (Produit Fini)** | Fromages et autres produits finis prets a la vente. |
| **Lot** | Unite de tracabilite identifiant un ensemble de produits fabriques dans les memes conditions. |
| **Timbre fiscal** | Droit de timbre obligatoire sur les factures payees en especes en Algerie. |
| **TVA** | Taxe sur la Valeur Ajoutee, taux applicable selon la reglementation algerienne. |
| **Bon de Commande (BC)** | Document d'achat adresse a un fournisseur pour l'approvisionnement en matieres premieres. |
| **Sync (Synchronisation)** | Mecanisme permettant aux appareils mobiles de fonctionner hors ligne et de synchroniser les donnees avec le serveur. |
| **Bootstrap** | Synchronisation initiale d'un nouvel appareil, telechargeant l'ensemble des donnees necessaires. |
| **Feature flag** | Indicateur permettant d'activer ou desactiver une fonctionnalite sans deploiement de code. |
| **Kill switch** | Mecanisme de desactivation d'urgence d'une fonctionnalite en production. |
| **Emergency mode** | Mode systeme restreignant les operations en cas de compromission active (LOCKDOWN). |

---

## 12. ANNEXES

### 12.1 URLs de production

| Service | URL | Description |
|---|---|---|
| Backend API | `https://<project>.railway.app/api` | API REST NestJS |
| Frontend Web | `https://<project>.vercel.app` | Interface web Next.js 14 |
| Health Check | `https://<project>.railway.app/api/health` | Endpoint de sante |
| Railway Dashboard | `https://railway.app/dashboard` | Console d'administration infrastructure |
| Vercel Dashboard | `https://vercel.com/dashboard` | Console d'administration frontend |
| GitHub Actions | `https://github.com/<org>/<repo>/actions` | Pipeline CI/CD |
| GitHub Backups | `https://github.com/<org>/<repo>/actions/workflows/backup.yml` | Workflow de sauvegarde |

**Note :** Swagger est desactive en production (`GET /docs` retourne 404). Utiliser l'environnement de developpement pour consulter la documentation API interactive.

### 12.2 Ports et services

| Service | Port par defaut | Environnement |
|---|---|---|
| Backend NestJS | 3000 (local), attribue par Railway (prod) | `PORT` |
| PostgreSQL | 5432 | `DATABASE_URL` |
| Redis | 6379 | `REDIS_HOST`, `REDIS_PORT` |
| Frontend Next.js | 3001 (local), attribue par Vercel (prod) | `NEXT_PUBLIC_API_URL` |

### 12.3 Variables d'environnement critiques

| Variable | Description | Criticite |
|---|---|---|
| `DATABASE_URL` | URL de connexion PostgreSQL 17 | CRITIQUE -- ne jamais exposer |
| `JWT_SECRET` | Secret de signature des access tokens | CRITIQUE -- rotation recommandee annuellement |
| `JWT_REFRESH_SECRET` | Secret de signature des refresh tokens | CRITIQUE |
| `JWT_EXPIRES_IN` | Duree de validite du access token (defaut: 15m) | Configuration |
| `QR_SECRET_KEY` | Secret pour la generation de QR codes | CRITIQUE |
| `REDIS_HOST` | Hote du serveur Redis | Configuration |
| `REDIS_PORT` | Port du serveur Redis (defaut: 6379) | Configuration |
| `REDIS_PASSWORD` | Mot de passe Redis | SENSIBLE |
| `REDIS_DB` | Numero de la base Redis (defaut: 0) | Configuration |
| `CACHE_STORE` | Type de cache : "redis" ou "memory" (defaut: redis) | Configuration |
| `CACHE_TTL_DEFAULT` | TTL du cache en secondes (defaut: 300) | Configuration |
| `NODE_ENV` | Environnement : development, test, production | Configuration |

### 12.4 Commandes CLI essentielles

**Backend (depuis `apps/backend`) :**
```bash
# Demarrer en developpement
npm run start:dev

# Executer les tests
npm test -- --ci --coverage --forceExit

# Lint
npm run lint

# Type-check
npx tsc --noEmit

# Generer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma db push

# Ouvrir Prisma Studio (interface visuelle DB)
npx prisma studio

# Build production
npm run build
```

**Frontend (depuis `apps/web`) :**
```bash
# Demarrer en developpement
npm run dev

# Tests unitaires
npm run test:unit -- --ci

# Lint
npm run lint

# Type-check
npx tsc --noEmit

# Build production
npm run build
```

**Backup manuel (depuis la racine) :**
```bash
# Dump PostgreSQL 17 (utiliser le binaire v17 explicitement)
/usr/lib/postgresql/17/bin/pg_dump "$DATABASE_URL" --format=custom --compress=9 -f "manchengo_$(date +%Y%m%d_%H%M%S).dump"

# Verifier l'integrite du backup
pg_restore --list manchengo_XXXXXXXX_XXXXXX.dump | grep "TABLE DATA"

# Restaurer sur une base de test
pg_restore --no-owner --no-privileges --dbname=restore_test manchengo_XXXXXXXX_XXXXXX.dump
```

**Commandes utiles Railway CLI :**
```bash
# Se connecter
railway login

# Voir les logs du backend
railway logs

# Variables d'environnement
railway variables

# Redemarrer le service
railway up
```

### 12.5 Architecture du systeme

```
+------------------------------------------------------------------+
|                    MANCHENGO SMART ERP                            |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+     +------------------+                     |
|  |   Vercel (CDN)   |     |    Railway       |                     |
|  |                   |     |                   |                    |
|  |  +-------------+ |     | +---------------+ |                    |
|  |  | Next.js 14  | |---->| | NestJS API    | |                    |
|  |  | (Frontend)  | | API | | (Backend)     | |                    |
|  |  +-------------+ |     | +-------+-------+ |                    |
|  |  - Tailwind CSS  |     |         |         |                    |
|  |  - Radix UI      |     |    +----+----+    |                    |
|  |  - TanStack Query|     |    |         |    |                    |
|  |  - Socket.io     |     | +--v--+  +---v--+ |                    |
|  |  - PWA Ready     |     | |PgSQL|  |Redis | |                    |
|  +------------------+     | | 17  |  |Cache | |                    |
|                           | +-----+  +------+ |                    |
|                           +------------------+ |                    |
|                                                                    |
|  +------------------+     +------------------+                     |
|  | GitHub Actions   |     |  Appareils       |                     |
|  | - CI (4 jobs)    |     |  - Android       |                     |
|  | - Backup daily   |     |  - iOS           |                     |
|  | - Security scan  |     |  - Windows       |                     |
|  | - Deploy         |     |  - macOS         |                     |
|  +------------------+     |  - Web (PWA)     |                     |
|                           +------------------+                     |
+------------------------------------------------------------------+

Flux de securite :
  Client --> HTTPS/TLS 1.3 --> Rate Limiting (3 tiers)
    --> JWT Auth (httpOnly cookie) --> CSRF Check
      --> RBAC Guard (@Roles) --> Controller --> Service
        --> Prisma ORM --> PostgreSQL
        --> AuditLog (hash-chain SHA256)
        --> SecurityLog (12 event types)
```

### 12.6 Seuils d'alerte configures

| Parametre | Valeur | Description |
|---|---|---|
| `deviceOfflineHours` | 24 | Heures sans synchronisation avant alerte DEVICE_OFFLINE |
| `pendingEventsWarning` | 50 | Nombre d'evenements en attente avant alerte WARNING |
| `pendingEventsCritical` | 200 | Nombre d'evenements en attente avant alerte CRITICAL |
| `cashSalesPercentWarning` | 80% | Pourcentage de ventes en especes avant alerte |
| `accessDeniedSpikePerHour` | 10 | Acces refuses par heure avant alerte CRITICAL |
| `failedLoginSpikePerHour` | 15 | Echecs de connexion par heure avant alerte CRITICAL |
| `stockExpiryDays` | 7 | Jours avant peremption pour alerte STOCK_EXPIRING |

### 12.7 Contacts et escalade

| Niveau | Responsable | Delai de reponse | Canal |
|---|---|---|---|
| **N1 -- Monitoring** | IT interne (ce role) | 15 minutes | Dashboard + alertes automatiques |
| **N2 -- Incident** | IT interne + Direction | 1 heure | Email + telephone |
| **N3 -- Crise** | IT + Direction + Prestataire externe | 30 minutes | Telephone + reunion d'urgence |
| **Support Railway** | Railway Support | Variable | https://railway.app/help |
| **Support Vercel** | Vercel Support | Variable | https://vercel.com/support |
| **GitHub Support** | GitHub Support | Variable | https://support.github.com |

### 12.8 Matrice des endpoints API (reference rapide)

**Authentification :**
| Methode | Endpoint | Rate Limit | Roles |
|---|---|---|---|
| POST | `/auth/login` | 5/min | Public |
| POST | `/auth/refresh` | 20/min | Public (cookie) |
| POST | `/auth/logout` | Aucun | Authentifie |
| POST | `/auth/users` | Standard | ADMIN |
| GET | `/auth/me` | Standard | Authentifie |
| GET | `/auth/csrf-token` | Standard | Authentifie |
| POST | `/auth/change-password` | 5/min | Authentifie |

**Administration :**
| Methode | Endpoint | Description |
|---|---|---|
| GET | `/admin/users` | Liste paginee (page, limit, role) |
| POST | `/admin/users` | Creer un utilisateur |
| PUT | `/admin/users/:id` | Modifier un utilisateur |
| POST | `/admin/users/:id/reset-password` | Reset mot de passe |
| POST | `/admin/users/:id/toggle-status` | Activer/desactiver |
| POST | `/admin/users/:id/block` | Bloquer + invalider sessions |
| POST | `/admin/users/:id/unblock` | Debloquer |
| POST | `/admin/users/:id/role` | Changer de role |
| GET | `/admin/devices` | Liste tous les appareils |
| GET | `/admin/devices/:id` | Details d'un appareil |
| POST | `/admin/devices/:id/revoke` | Revoquer (avec raison) |
| POST | `/admin/devices/:id/reactivate` | Reactiver |
| GET | `/admin/security-logs` | Logs securite (action, userId, dates) |

**Monitoring :**
| Methode | Endpoint | Description |
|---|---|---|
| GET | `/monitoring/kpis` | KPIs systeme temps reel |
| GET | `/monitoring/alerts` | Alertes (status, type, severity) |
| POST | `/monitoring/alerts/:id/ack` | Accuser reception |
| POST | `/monitoring/alerts/:id/close` | Fermer une alerte |
| POST | `/monitoring/check` | Declencher verification manuelle |

**Audit :**
| Methode | Endpoint | Description |
|---|---|---|
| GET | `/security/audit` | Requete avec filtres (actorId, action, severity, dates) |
| GET | `/security/audit/entity/:type/:id` | Historique d'une entite |
| GET | `/security/audit/request/:requestId` | Correlation par requete |
| GET | `/security/audit/security-events` | Evenements securite (hours, limit) |
| GET | `/security/audit/stats` | Statistiques d'audit |

**Gouvernance :**
| Methode | Endpoint | Description |
|---|---|---|
| GET | `/governance/retention/policies` | Politiques de retention |
| GET | `/governance/retention/status` | Etat de retention |
| POST | `/governance/retention/purge` | Purge (dryRun par defaut) |
| GET | `/governance/security/status` | Statut securite |
| GET | `/governance/security/thresholds` | Seuils de securite |
| POST | `/governance/security/emergency-mode` | Activer mode urgence |
| GET | `/governance/features` | Feature flags |
| POST | `/governance/features/toggle` | Activer/desactiver un flag |
| POST | `/governance/features/kill-switch` | Kill switch d'urgence |
| POST | `/governance/features/rollout` | Definir pourcentage rollout |

---

**Fin du document MANUEL-09-IT**

*Document genere pour Manchengo Smart ERP v2.0 -- Fevrier 2026*
*Classification : CONFIDENTIEL -- Usage interne*
*Prochaine revision : Mars 2026*

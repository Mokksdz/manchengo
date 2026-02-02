# PHASE 5: INDUSTRIALIZATION & COMPLIANCE

**Date**: 5 Janvier 2026  
**Statut**: ✅ IMPLÉMENTÉ  
**Objectif**: ERP scalable, conforme, déployable, gouvernable

---

## 1. ARCHITECTURE DE GOUVERNANCE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOVERNANCE LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  RETENTION       │  │  SECURITY        │  │  FEATURE FLAGS   │          │
│  │  SERVICE         │  │  HARDENING       │  │  SERVICE         │          │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤          │
│  │ • Policies       │  │ • Rate limiting  │  │ • Toggles        │          │
│  │ • Auto-purge     │  │ • Brute-force    │  │ • Kill switches  │          │
│  │ • Legal export   │  │ • Anomaly detect │  │ • Gradual rollout│          │
│  │ • Archive        │  │ • Emergency mode │  │ • Per-role flags │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     GOVERNANCE CONTROLLER                           │   │
│  │  /api/governance/retention/*   /security/*   /features/*           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DATA GOVERNANCE & RETENTION

### 2.1 Politiques de rétention (Conformité Algérie)

| Type de donnée | Rétention | Base légale | Auto-purge |
|----------------|-----------|-------------|------------|
| **Factures** | 10 ans | Code de Commerce Art. 12 | ❌ Manuel |
| **Paiements** | 10 ans | Code de Commerce Art. 12 | ❌ Manuel |
| **Mouvements stock** | 10 ans | Traçabilité fiscale TVA | ❌ Manuel |
| **Ordres production** | 10 ans | Normes agroalimentaires | ❌ Manuel |
| **Bons réception** | 10 ans | Traçabilité appro | ❌ Manuel |
| **Logs audit** | 10 ans | Piste d'audit fiscale | ❌ Manuel |
| **Logs sécurité** | 5 ans | Sécurité informatique | ✅ Après archive |
| **Livraisons** | 5 ans | Traçabilité | ✅ Après archive |
| **Lots MP/PF** | 5 ans | Traçabilité FIFO | ✅ Après archive |
| **Tokens session** | 1 an | Données techniques | ✅ Auto |
| **Events sync** | 1 an | Données techniques | ✅ Auto |

### 2.2 Cycle de vie des données

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ ACTIF   │────▶│ ARCHIVE │────▶│ COLD    │────▶│ PURGE   │
│         │     │         │     │ STORAGE │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │
   Prod DB      Backup chaud    S3/Blob froid   Destruction
   < 2 ans       2-5 ans          5-10 ans      > 10 ans
```

### 2.3 API Retention

```bash
# Voir les politiques
GET /api/governance/retention/policies

# Statut de rétention
GET /api/governance/retention/status

# Purge (dry-run par défaut)
POST /api/governance/retention/purge
{ "entityType": "SecurityLog", "dryRun": true }
```

---

## 3. SECURITY HARDENING

### 3.1 Seuils de sécurité par défaut

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `maxLoginAttemptsPerHour` | 10 | Tentatives avant blocage |
| `lockoutDurationMinutes` | 30 | Durée de blocage |
| `maxAdminActionsPerMinute` | 20 | Rate limit actions admin |
| `maxStockMovementsPerMinute` | 50 | Rate limit mouvements |
| `maxBulkOperationsPerHour` | 5 | Opérations en masse |
| `unusualHoursStart` | 22h | Début heures suspectes |
| `unusualHoursEnd` | 5h | Fin heures suspectes |
| `maxValueChangePercent` | 50% | Seuil anomalie stock |
| `securityEventsAlertThreshold` | 5 | Alertes/heure |
| `failedLoginsAlertThreshold` | 3 | Échecs login/heure |

### 3.2 Modes d'urgence

| Mode | Accès | Écriture | Usage |
|------|-------|----------|-------|
| `NORMAL` | Tous | ✅ Oui | Production normale |
| `READ_ONLY` | Tous | ❌ Non | Maintenance planifiée |
| `LOCKDOWN` | ADMIN | ❌ Non | Incident sécurité |
| `MAINTENANCE` | ADMIN | ❌ Non | Mise à jour système |

### 3.3 API Security

```bash
# Statut sécurité
GET /api/governance/security/status

# Activer mode urgence
POST /api/governance/security/emergency-mode
{ "mode": "READ_ONLY", "reason": "Maintenance DB planifiée" }

# Voir seuils
GET /api/governance/security/thresholds
```

---

## 4. FEATURE FLAGS

### 4.1 Flags par catégorie

| Flag | Catégorie | Risque | Défaut | Kill Switch |
|------|-----------|--------|--------|-------------|
| `stock_movements` | core | critical | ON | ✅ |
| `production_orders` | core | critical | ON | ✅ |
| `invoicing` | core | critical | ON | ✅ |
| `auto_reorder_suggestions` | beta | medium | ON | ✅ |
| `bulk_stock_import` | beta | high | ON | ✅ |
| `ocr_reception` | experimental | medium | OFF | ✅ |
| `mobile_sync` | experimental | high | OFF | ✅ |
| `predictive_stock` | experimental | low | OFF | ✅ |
| `data_export_full` | core | high | ON | ✅ |
| `manual_stock_override` | deprecated | critical | OFF | ✅ |

### 4.2 Rollout progressif

```
  0%        25%        50%        75%       100%
   │─────────│──────────│──────────│─────────│
   ▼                                         ▼
 Test       Beta        Pilote     Général   Stable
 interne    users       sites      rollout   
```

### 4.3 API Feature Flags

```bash
# Liste des flags
GET /api/governance/features

# Vérifier un flag
GET /api/governance/features/check?key=bulk_stock_import

# Toggle flag
POST /api/governance/features/toggle
{ "key": "ocr_reception", "enabled": true }

# KILL SWITCH (urgence)
POST /api/governance/features/kill-switch
{ "key": "bulk_stock_import", "reason": "Corruption données détectée" }

# Rollout progressif
POST /api/governance/features/rollout
{ "key": "mobile_sync", "percent": 25 }
```

---

## 5. ENVIRONMENT SEPARATION

### 5.1 Environnements

| Env | Base URL | Database | Usage |
|-----|----------|----------|-------|
| `development` | localhost:3000 | manchengo_dev | Dev local |
| `staging` | staging.manchengo.dz | manchengo_staging | Tests UAT |
| `production` | app.manchengo.dz | manchengo_prod | Production |

### 5.2 Variables d'environnement

```bash
# .env.development
NODE_ENV=development
DATABASE_URL="postgresql://dev:dev@localhost:5432/manchengo_dev"
JWT_SECRET="dev-secret-not-for-production"
LOG_LEVEL=debug
FEATURE_FLAGS_STRICT=false

# .env.staging
NODE_ENV=staging
DATABASE_URL="postgresql://staging:xxx@staging-db:5432/manchengo_staging"
JWT_SECRET="${JWT_SECRET_STAGING}"
LOG_LEVEL=info
FEATURE_FLAGS_STRICT=true

# .env.production
NODE_ENV=production
DATABASE_URL="${DATABASE_URL_PROD}"
JWT_SECRET="${JWT_SECRET_PROD}"
LOG_LEVEL=warn
FEATURE_FLAGS_STRICT=true
SECURITY_MAX_LOGIN_ATTEMPTS=5
SECURITY_LOCKOUT_MINUTES=60
```

### 5.3 Secrets Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECRETS NEVER IN CODE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Development     │  .env.local (gitignored)                    │
│  Staging         │  GitHub Secrets / Vault                     │
│  Production      │  Azure Key Vault / AWS Secrets Manager      │
│                                                                 │
│  RÈGLE: Si c'est dans git, ce n'est pas un secret             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. DEPLOYMENT CHECKLIST

### 6.1 Pré-déploiement

```
□ 1. BACKUP
  □ Backup base de données complet
  □ Backup fichiers de configuration
  □ Vérifier restauration possible

□ 2. TESTS
  □ Tous les tests passent (npm test)
  □ Tests E2E validés
  □ Pas de régression critique

□ 3. MIGRATIONS
  □ Revue des migrations Prisma
  □ Migration testée sur staging
  □ Plan de rollback préparé

□ 4. FEATURE FLAGS
  □ Nouvelles features en mode OFF
  □ Kill switches testés
  □ Rollback features identifiées

□ 5. COMMUNICATION
  □ Fenêtre de maintenance communiquée
  □ Équipe support informée
  □ Numéro urgence disponible
```

### 6.2 Déploiement

```
□ 1. ACTIVER MODE MAINTENANCE
  POST /api/governance/security/emergency-mode
  { "mode": "MAINTENANCE", "reason": "Déploiement v1.X.X" }

□ 2. DÉPLOYER
  □ Pull dernière version
  □ npm install
  □ npx prisma migrate deploy
  □ npm run build
  □ Redémarrer services

□ 3. VÉRIFICATION
  □ Health check OK
  □ Logs sans erreurs critiques
  □ Endpoints principaux répondent

□ 4. DÉSACTIVER MODE MAINTENANCE
  POST /api/governance/security/emergency-mode
  { "mode": "NORMAL", "reason": "Déploiement terminé" }

□ 5. VALIDATION
  □ Smoke tests manuels
  □ Vérifier audit logs
  □ Confirmer aux équipes
```

### 6.3 Rollback

```bash
# 1. Activer mode maintenance
curl -X POST /api/governance/security/emergency-mode \
  -d '{"mode":"MAINTENANCE","reason":"Rollback urgence"}'

# 2. Rollback database (si migration problématique)
npx prisma migrate resolve --rolled-back "migration_name"

# 3. Redéployer version précédente
git checkout v1.X.X-1
npm install
npm run build
# Redémarrer

# 4. Désactiver mode maintenance
curl -X POST /api/governance/security/emergency-mode \
  -d '{"mode":"NORMAL","reason":"Rollback terminé"}'
```

---

## 7. INCIDENT RESPONSE PLAYBOOK

### 7.1 Classification des incidents

| Niveau | Impact | Exemples | SLA Réponse |
|--------|--------|----------|-------------|
| **P1 - Critique** | Production arrêtée | DB down, Auth cassée | 15 min |
| **P2 - Majeur** | Fonctionnalité bloquée | Stock impossible | 1 heure |
| **P3 - Modéré** | Dégradation | Lenteurs, erreurs partielles | 4 heures |
| **P4 - Mineur** | Cosmétique | UI bugs, messages | 24 heures |

### 7.2 Playbook P1 - Système down

```
┌─────────────────────────────────────────────────────────────────┐
│ PLAYBOOK P1: SYSTÈME DOWN                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ÉTAPE 1: TRIAGE (0-5 min)                                      │
│ □ Confirmer l'incident                                         │
│ □ Vérifier health endpoint: GET /health                        │
│ □ Vérifier logs: tail -f /var/log/manchengo/error.log          │
│ □ Identifier le composant en cause                             │
│                                                                 │
│ ÉTAPE 2: CONTAINMENT (5-15 min)                                │
│ □ Activer LOCKDOWN si nécessaire                               │
│ □ Kill switch features suspectes                               │
│ □ Notifier équipe et management                                │
│                                                                 │
│ ÉTAPE 3: DIAGNOSE (15-30 min)                                  │
│ □ Analyser logs par requestId                                  │
│ □ Vérifier DB: pg_isready, connections                         │
│ □ Vérifier mémoire/CPU serveur                                 │
│ □ Identifier root cause                                        │
│                                                                 │
│ ÉTAPE 4: RESOLVE                                               │
│ □ Appliquer fix ou rollback                                    │
│ □ Vérifier restauration service                                │
│ □ Smoke tests                                                  │
│                                                                 │
│ ÉTAPE 5: POST-MORTEM (24h)                                     │
│ □ Documenter timeline                                          │
│ □ Root cause analysis                                          │
│ □ Actions préventives                                          │
│ □ Mettre à jour runbooks                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Playbook Sécurité - Brute Force

```
┌─────────────────────────────────────────────────────────────────┐
│ PLAYBOOK: ATTAQUE BRUTE FORCE DÉTECTÉE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DÉCLENCHEUR:                                                   │
│ - SecurityHardeningService.shouldAlertSecurity() = true        │
│ - failedLogins > 3/heure                                       │
│                                                                 │
│ ACTIONS:                                                       │
│                                                                 │
│ 1. VÉRIFIER L'ATTAQUE                                          │
│    GET /api/governance/security/status                         │
│    → Voir lockedUsers, failedLogins                            │
│                                                                 │
│ 2. SI ATTAQUE CONFIRMÉE:                                       │
│    □ Augmenter seuils temporairement                           │
│      POST /api/governance/security/thresholds                  │
│      { "maxLoginAttemptsPerHour": 3 }                          │
│                                                                 │
│    □ Si massive, activer LOCKDOWN                              │
│      POST /api/governance/security/emergency-mode              │
│      { "mode": "LOCKDOWN", "reason": "Attaque brute force" }   │
│                                                                 │
│ 3. INVESTIGATION                                               │
│    □ Identifier IPs sources (audit logs)                       │
│    □ Bloquer au niveau firewall si nécessaire                  │
│    □ Vérifier si comptes compromis                             │
│                                                                 │
│ 4. RÉSOLUTION                                                  │
│    □ Restaurer mode NORMAL                                     │
│    □ Réinitialiser mots de passe si nécessaire                │
│    □ Documenter incident                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Playbook Stock - Anomalie détectée

```
┌─────────────────────────────────────────────────────────────────┐
│ PLAYBOOK: ANOMALIE STOCK DÉTECTÉE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DÉCLENCHEUR:                                                   │
│ - Changement stock > 50% en une opération                      │
│ - Opération hors heures normales (22h-5h)                      │
│                                                                 │
│ ACTIONS:                                                       │
│                                                                 │
│ 1. NE PAS BLOQUER L'OPÉRATION                                  │
│    → Laisser passer mais logger avec SEVERITY=WARNING          │
│                                                                 │
│ 2. ALERTE ADMIN                                                │
│    → Notification temps réel (email/SMS)                       │
│    → Dashboard alertes visible                                  │
│                                                                 │
│ 3. INVESTIGATION                                               │
│    □ Vérifier requestId dans audit                             │
│    □ Identifier acteur (userId, role)                          │
│    □ Contexte: inventaire? réception massive?                  │
│                                                                 │
│ 4. SI FRAUDE SUSPECTÉE                                         │
│    □ Kill switch: manual_stock_override                        │
│    □ Activer READ_ONLY temporairement                          │
│    □ Investigation approfondie                                  │
│                                                                 │
│ 5. RÉSOLUTION                                                  │
│    □ Documenter justification si légitime                      │
│    □ Corriger si erreur                                        │
│    □ Ajuster seuils si faux positif récurrent                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. OPERATOR MANUAL (Non-Dev)

### 8.1 Actions quotidiennes

| Action | Fréquence | Comment |
|--------|-----------|---------|
| Vérifier alertes | Matin | Dashboard → Alertes |
| Vérifier IRS | Matin | APPRO → Dashboard |
| Backup check | Quotidien | Vérifier logs backup |
| Security check | Quotidien | Governance → Security Status |

### 8.2 Actions hebdomadaires

| Action | Jour | Comment |
|--------|------|---------|
| Revue retention | Lundi | Governance → Retention Status |
| Revue feature flags | Lundi | Governance → Features |
| Export audit | Vendredi | Security → Audit Export |

### 8.3 Que faire si...

| Situation | Action |
|-----------|--------|
| "Je ne peux pas me connecter" | Attendre 30 min (lockout) ou contacter admin |
| "Le système est lent" | Vérifier /health, contacter support si KO |
| "Erreur stock insuffisant" | Normal - vérifier stock réel, ajuster quantité |
| "Accès refusé" | Vérifier rôle, contacter admin si erreur |
| "Système en lecture seule" | Maintenance en cours, attendre notification |

---

## 9. AUDIT CHECKLIST (Pré-audit)

### 9.1 Préparation audit fiscal

```
□ DONNÉES
  □ Export complet factures (10 ans)
  □ Export paiements (10 ans)
  □ Export mouvements stock (10 ans)
  □ Vérifier cohérence TVA

□ AUDIT TRAIL
  □ Export audit logs (période demandée)
  □ Vérifier continuité (pas de gaps)
  □ Préparer explication des actions critiques

□ ACCÈS
  □ Créer compte auditeur (lecture seule)
  □ Préparer exports PDF si accès système refusé
  □ Documenter procédure extraction

□ DOCUMENTATION
  □ Schéma architecture
  □ Politiques de rétention
  □ Procédures de sauvegarde
```

### 9.2 Préparation audit sécurité

```
□ LOGS
  □ Export security logs (5 ans)
  □ Liste des incidents de sécurité
  □ Actions correctives documentées

□ CONTRÔLES
  □ Liste des utilisateurs actifs
  □ Matrice rôles/permissions
  □ Politique mots de passe

□ INFRASTRUCTURE
  □ Schéma réseau
  □ Liste des accès externes
  □ Certificats SSL valides
```

---

## 10. FICHIERS CRÉÉS

```
apps/backend/src/governance/
├── governance.module.ts           # Module principal
├── governance.controller.ts       # API endpoints
├── retention.service.ts           # Data lifecycle
├── security-hardening.service.ts  # Security controls
└── feature-flags.service.ts       # Feature toggles

docs/
└── PHASE5_INDUSTRIALIZATION.md    # Cette documentation
```

---

## CONCLUSION

Phase 5 établit les fondations pour un **ERP de production industrielle**:

- ✅ **Data Governance**: Rétention conforme loi algérienne (10 ans fiscal)
- ✅ **Security**: Rate limiting, détection anomalies, modes urgence
- ✅ **Feature Flags**: Rollout progressif, kill switches
- ✅ **Deployment**: Checklists, rollback, migrations sûres
- ✅ **Incident Response**: Playbooks pour P1-P4
- ✅ **Operability**: Manuels opérateurs, checklists audit

**L'ERP est maintenant prêt pour un déploiement multi-site, long-terme, avec gouvernance d'entreprise.**

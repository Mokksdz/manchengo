# 🧊 MANCHENGO ERP — STRATÉGIE DE GEL FONCTIONNEL

> **Objectif:** Mise en production sans régression ni stress

---

## 📋 RÉSUMÉ EXÉCUTIF

| Paramètre | Valeur |
|-----------|--------|
| **Durée du gel** | 14 jours (J-7 → J+7 prod) |
| **Périmètre** | Module APPRO complet + dépendances |
| **Responsable** | CTO / Tech Lead |
| **Date prévue prod** | À définir (J0) |

---

## 1️⃣ RÈGLE DE GEL FONCTIONNEL

### Définition

Le **gel fonctionnel** est une période durant laquelle **AUCUNE modification fonctionnelle** n'est autorisée sur le périmètre de production.

### Durée

```
┌─────────────────────────────────────────────────────────────────┐
│  J-7        J-3        J0           J+3        J+7              │
│   │          │          │            │          │               │
│   ▼          ▼          ▼            ▼          ▼               │
│ DÉBUT     FREEZE     PROD        MONITOR    FIN GEL            │
│  GEL      TOTAL                  INTENSIF                       │
│                                                                  │
│ ←─── Préparation ───→←── Production ──→←── Stabilisation ──→   │
└─────────────────────────────────────────────────────────────────┘
```

| Phase | Période | Actions |
|-------|---------|---------|
| **Pré-gel** | J-7 → J-3 | Tests finaux, derniers ajustements mineurs |
| **Gel total** | J-3 → J0 | ZÉRO modification, même cosmétique |
| **Production** | J0 | Déploiement |
| **Surveillance** | J0 → J+3 | Monitoring intensif 24/7 |
| **Stabilisation** | J+3 → J+7 | Hotfixes critiques uniquement |
| **Fin gel** | J+7 | Reprise développement normal |

### Périmètre du gel

```
GELÉ (APPRO + dépendances):
├── apps/backend/src/appro/
├── apps/backend/src/demandes-mp/
├── apps/backend/src/common/locks/
├── apps/backend/src/common/middleware/idempotency.middleware.ts
├── apps/backend/src/domain/workflows/
├── apps/web/src/app/(dashboard)/dashboard/appro/
└── prisma/schema.prisma (modèles APPRO)

NON GELÉ (développement autorisé):
├── apps/web/src/app/(dashboard)/dashboard/production/  ← Feature future
├── apps/mobile/                                         ← Autre timeline
└── docs/                                                ← Documentation
```

---

## 2️⃣ CE QUI EST AUTORISÉ PENDANT LE GEL

### ✅ AUTORISÉ

| Type | Description | Exemple |
|------|-------------|---------|
| **Hotfix P0** | Bug bloquant production | Crash serveur, perte données |
| **Hotfix P1** | Bug critique métier | Calcul stock faux, BC non généré |
| **Config** | Ajustement configuration | Timeout, limites, feature flags |
| **Logs** | Amélioration observabilité | Ajout log diagnostic |
| **Docs** | Documentation | README, guides utilisateur |
| **Monitoring** | Alertes et dashboards | Grafana, alertes Slack |

### Critères d'un hotfix autorisé

1. ✅ Impact **bloquant** pour l'utilisateur
2. ✅ Pas de contournement possible
3. ✅ Changement **minimal** et ciblé
4. ✅ Testé manuellement + review obligatoire
5. ✅ Approuvé par Tech Lead ET Product Owner

---

## 3️⃣ CE QUI EST STRICTEMENT INTERDIT

### 🚫 INTERDIT

| Type | Description | Exemple |
|------|-------------|---------|
| **Nouvelle feature** | Toute fonctionnalité | "Ajouter export PDF" |
| **Refactorisation** | Restructuration code | "Renommer service" |
| **Amélioration UX** | Changement interface | "Bouton plus grand" |
| **Optimisation** | Performance non critique | "Requête plus rapide" |
| **Dette technique** | Nettoyage code | "Supprimer code mort" |
| **Dépendances** | Mise à jour packages | "Upgrade React 19" |
| **Migration DB** | Changement schéma | "Ajouter colonne" |

### Critères de refus

- ❌ "Ce serait mieux si..."
- ❌ "Ça ne prend que 5 minutes..."
- ❌ "C'est juste un petit changement..."
- ❌ "Le client a demandé..."
- ❌ "J'ai trouvé un bug mineur..."

**Réponse standard:** "Noté dans le backlog post-production."

---

## 4️⃣ PROCESS CORRECTION BUG CRITIQUE

### Workflow Hotfix

```
┌──────────────────────────────────────────────────────────────────┐
│                      PROCESS HOTFIX P0/P1                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DÉTECTION                                                    │
│     └─→ Alerte monitoring / Ticket utilisateur                  │
│                                                                  │
│  2. QUALIFICATION (≤15 min)                                      │
│     ├─→ Est-ce bloquant ? (Oui/Non)                             │
│     ├─→ Nombre d'utilisateurs impactés ?                        │
│     └─→ Contournement possible ?                                │
│                                                                  │
│  3. DÉCISION GO/NO-GO                                           │
│     └─→ Tech Lead + Product Owner                               │
│                                                                  │
│  4. DÉVELOPPEMENT (branche hotfix/*)                            │
│     ├─→ Fix minimal et ciblé                                    │
│     ├─→ Pas de refactorisation                                  │
│     └─→ Tests manuels obligatoires                              │
│                                                                  │
│  5. REVIEW (≤30 min)                                            │
│     ├─→ Code review par 2ème dev                                │
│     └─→ Validation Tech Lead                                    │
│                                                                  │
│  6. DÉPLOIEMENT                                                  │
│     ├─→ Merge dans main                                         │
│     ├─→ Deploy staging → test rapide                            │
│     └─→ Deploy production                                       │
│                                                                  │
│  7. VÉRIFICATION POST-DEPLOY                                    │
│     ├─→ Confirmer fix en production                             │
│     └─→ Monitoring 1h intensif                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Template ticket hotfix

```markdown
## 🚨 HOTFIX: [Titre court]

**Sévérité:** P0 / P1
**Détecté:** [Date heure]
**Reporter:** [Nom]

### Symptôme
[Description précise du bug]

### Impact
- Utilisateurs affectés: [Nombre]
- Fonctionnalité bloquée: [Oui/Non]
- Contournement: [Possible/Impossible]

### Cause identifiée
[Analyse technique]

### Fix proposé
[Description du changement minimal]

### Fichiers modifiés
- [ ] `path/to/file1.ts`
- [ ] `path/to/file2.ts`

### Tests effectués
- [ ] Test manuel local
- [ ] Test staging
- [ ] Non-régression vérifiée

### Approbations
- [ ] Tech Lead: @name
- [ ] Product Owner: @name
- [ ] Review: @name
```

---

## 5️⃣ PROCESS VALIDATION HOTFIX

### Critères de validation

| Critère | Obligatoire | Vérificateur |
|---------|-------------|--------------|
| Impact minimal | ✅ | Tech Lead |
| Pas d'effet de bord | ✅ | Reviewer |
| Tests manuels OK | ✅ | Développeur |
| Staging OK | ✅ | QA / Tech Lead |
| Documentation | ⚠️ Si nécessaire | Développeur |

### Checklist validation

```
AVANT MERGE:
[ ] Le fix résout uniquement le bug signalé
[ ] Aucune modification non liée au bug
[ ] Aucune dépendance ajoutée
[ ] Aucune migration DB
[ ] Code review effectuée
[ ] Tests manuels documentés
[ ] Tech Lead a approuvé

AVANT DEPLOY PROD:
[ ] Staging validé
[ ] Rollback plan défini
[ ] Communication équipe faite
[ ] Monitoring prêt
```

### Matrice d'approbation

| Sévérité | Approbateurs requis | Délai max |
|----------|---------------------|-----------|
| **P0** (crash) | Tech Lead seul | 30 min |
| **P1** (bloquant) | Tech Lead + PO | 2h |
| **P2** (majeur) | Attendre fin gel | - |

---

## 6️⃣ SIGNAUX DE SORTIE DU GEL

### Conditions de sortie (TOUTES requises)

| Signal | Critère | Mesure |
|--------|---------|--------|
| **Stabilité** | 0 incident P0/P1 depuis 48h | Logs + monitoring |
| **Métriques** | Taux erreur < 0.1% | Dashboard |
| **Performance** | Temps réponse P95 < 500ms | APM |
| **Utilisateurs** | Pas de plainte bloquante | Support |
| **Données** | Intégrité vérifiée | Audit logs |

### Checklist sortie de gel

```
VALIDATION TECHNIQUE:
[ ] Aucun P0/P1 ouvert
[ ] Monitoring stable 48h
[ ] Logs sans erreur critique
[ ] Performances nominales
[ ] Backups fonctionnels

VALIDATION MÉTIER:
[ ] Flux nominal APPRO testé en prod
[ ] BC générés correctement
[ ] Réceptions enregistrées
[ ] Stocks mis à jour

VALIDATION PROCESSUS:
[ ] Retro post-prod planifiée
[ ] Backlog post-gel priorisé
[ ] Communication fin gel envoyée
```

### Décision formelle

```
┌─────────────────────────────────────────────────────────────┐
│              DÉCISION FIN DE GEL FONCTIONNEL                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Date: _______________                                      │
│                                                             │
│  Critères remplis:                                         │
│  [ ] Stabilité 48h                                         │
│  [ ] Métriques OK                                          │
│  [ ] Validation métier                                     │
│                                                             │
│  Décision:  ☐ FIN DU GEL    ☐ PROLONGATION                │
│                                                             │
│  Si prolongation, motif: _____________________________     │
│                                                             │
│  Signatures:                                               │
│  - Tech Lead: _______________                              │
│  - Product Owner: _______________                          │
│  - CTO: _______________                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 CHECKLISTS

### CHECKLIST AVANT GEL (J-7)

```
PRÉPARATION TECHNIQUE:
[ ] Tests E2E passent à 100%
[ ] Aucun console.log en production
[ ] Logging structuré en place
[ ] Monitoring configuré
[ ] Alertes définies
[ ] Rollback testé
[ ] Backup vérifié

PRÉPARATION CODE:
[ ] Branche main stable
[ ] Aucun PR en attente critique
[ ] Feature flags configurés
[ ] Migrations DB appliquées
[ ] Seed data à jour

PRÉPARATION ÉQUIPE:
[ ] Astreinte planifiée
[ ] Contacts d'urgence diffusés
[ ] Runbook hotfix distribué
[ ] Formation support faite

PRÉPARATION DOCUMENTATION:
[ ] Guide utilisateur à jour
[ ] FAQ support prête
[ ] Changelog rédigé
```

### CHECKLIST PENDANT GEL (J-3 → J+7)

```
QUOTIDIEN:
[ ] Review monitoring matin
[ ] Review tickets support
[ ] Standup stabilité (15 min)
[ ] Review logs erreur

SI INCIDENT:
[ ] Qualifier sévérité (P0/P1/P2)
[ ] Si P0/P1: process hotfix
[ ] Si P2+: noter backlog
[ ] Communiquer statut

HEBDOMADAIRE:
[ ] Rapport stabilité
[ ] Métriques performance
[ ] Satisfaction utilisateur
```

### CHECKLIST SORTIE GEL (J+7)

```
VALIDATION:
[ ] Tous critères sortie OK
[ ] Décision formelle signée
[ ] Communication envoyée

TRANSITION:
[ ] Backlog post-gel priorisé
[ ] Sprint planning fait
[ ] Retro post-prod schedulée

REPRISE:
[ ] PR en attente reviewés
[ ] Branches feature rebasées
[ ] Développement normal reprend
```

---

## 📌 EXEMPLES CONCRETS

### ✅ EXEMPLE BUG CRITIQUE AUTORISÉ

```
TITRE: Génération BC échoue silencieusement

SYMPTÔME:
- Utilisateur clique "Générer BC"
- Bouton devient grisé
- Aucune erreur affichée
- BC non créé en base

IMPACT:
- 100% des utilisateurs APPRO
- Flux APPRO complètement bloqué
- Aucun contournement possible

CAUSE:
- Exception non catchée dans generatePurchaseOrder()
- Transaction rollback silencieux

FIX PROPOSÉ:
- Ajouter try/catch
- Retourner erreur explicite
- 5 lignes modifiées

DÉCISION: ✅ HOTFIX AUTORISÉ (P0)
```

### 🚫 EXEMPLE MODIFICATION REFUSÉE

```
DEMANDE: "Le bouton 'Valider' devrait être vert au lieu de bleu"

JUSTIFICATION DEMANDEUR:
- "C'est plus intuitif"
- "Ça prend 2 minutes"
- "Le client préfère"

ANALYSE:
- Aucun impact fonctionnel
- Aucun blocage
- Purement cosmétique

RÉPONSE:
"Modification notée dans le backlog UX.
Sera traitée après la période de gel (J+7).
Priorité: Basse"

DÉCISION: ❌ REFUSÉ — Backlog post-gel
```

### 🚫 AUTRE EXEMPLE REFUSÉ

```
DEMANDE: "J'ai optimisé la requête de listing, 
          elle passe de 200ms à 50ms"

JUSTIFICATION DEMANDEUR:
- "C'est une amélioration pure"
- "Pas de changement fonctionnel"
- "J'ai déjà fait les tests"

ANALYSE:
- Modification de requête SQL
- Risque de régression
- Non critique (200ms acceptable)

RÉPONSE:
"Excellente optimisation, merci !
Mais nous sommes en période de gel.
PR à merge à J+8."

DÉCISION: ❌ REFUSÉ — Risque > Bénéfice pendant gel
```

---

## 🚨 CONTACTS D'URGENCE

| Rôle | Nom | Contact | Disponibilité |
|------|-----|---------|---------------|
| Tech Lead | [À remplir] | [Tel/Slack] | 24/7 pendant gel |
| CTO | [À remplir] | [Tel/Slack] | Escalade |
| DBA | [À remplir] | [Tel/Slack] | Incidents DB |
| DevOps | [À remplir] | [Tel/Slack] | Incidents infra |

---

## 📊 MÉTRIQUES DE SUCCÈS

| Métrique | Objectif | Seuil alerte |
|----------|----------|--------------|
| Incidents P0 | 0 | ≥1 |
| Incidents P1 | ≤2 | ≥5 |
| Taux erreur API | <0.1% | ≥0.5% |
| Temps réponse P95 | <500ms | ≥1000ms |
| Satisfaction users | ≥4/5 | <3/5 |

---

**Document approuvé par:** [CTO / Tech Lead]  
**Date:** [À compléter]  
**Version:** 1.0  
**Prochaine révision:** Post-production

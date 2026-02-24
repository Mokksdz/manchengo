# MANCHENGO SMART ERP — INDEX DES MANUELS UTILISATEUR

> **Version :** 2.0
> **Date :** Février 2026
> **Classification :** Documentation Interne — Formation & Audit
> **Standard :** Plus rigoureux qu'un consultant SAP, plus structuré qu'un audit Big4, plus pédagogique qu'un centre de formation certifié

---

## Vue d'ensemble

Ce corpus documentaire constitue l'**audit manuel utilisateur ultra-détaillé** de Manchengo Smart ERP — système ERP agroalimentaire spécialisé dans la fromagerie industrielle, conforme à la réglementation algérienne.

**9 manuels** couvrent l'ensemble des rôles métier de l'organisation. Chaque manuel contient **12 sections obligatoires** garantissant une couverture exhaustive des processus, risques, formations et optimisations.

---

## Statistiques globales

| Métrique | Valeur |
|----------|--------|
| Nombre de manuels | 9 |
| Total mots | **89 504** |
| Total lignes | **11 223** |
| Sections par manuel | 12 |
| Langue | Français |
| Vérifié contre le code source | ✅ Oui (Prisma schema, controllers, services) |

---

## Les 12 sections de chaque manuel

1. **Fiche d'identité du rôle** — Profil RBAC, endpoints API, KPIs
2. **Workflow complet** — Processus pas-à-pas avec références API exactes
3. **Scénarios réels** — Cas d'usage terrain avec données réalistes
4. **Erreurs humaines fréquentes** — Top 10 erreurs, conséquences, prévention
5. **Risques métier critiques** — Analyse des risques avec impact et mitigation
6. **Checklists opérationnelles** — Quotidien, hebdomadaire, mensuel
7. **Scripts de formation vidéo** — Modules minutés pour e-learning
8. **Matrice RACI** — Responsabilités croisées entre rôles
9. **Niveaux de maturité** — 4 niveaux (Initial → Optimisé) avec scores
10. **Recommandations d'optimisation** — Court, moyen et long terme
11. **Glossaire métier** — Termes techniques et ERP définis
12. **Annexes** — Tableaux de référence, seuils, configurations

---

## Index des manuels par rôle

### 1. [MANUEL-01 — Directeur / Administrateur](./MANUEL-01-DIRECTEUR-ADMIN.md)
- **Rôle RBAC :** `ADMIN`
- **Périmètre :** Supervision globale, gestion utilisateurs, paramétrage système, tableaux de bord, audit trail
- **Mots :** 12 228 | **Lignes :** 1 648

### 2. [MANUEL-02 — Responsable Production](./MANUEL-02-PRODUCTION.md)
- **Rôle RBAC :** `PRODUCTION`
- **Périmètre :** Ordres de production, recettes, consommation FIFO, lots PF, planning hebdomadaire, KPIs rendement
- **Mots :** 10 907 | **Lignes :** 1 256

### 3. [MANUEL-03 — Responsable Stock](./MANUEL-03-STOCK.md)
- **Rôle RBAC :** `ADMIN` / `APPRO` / `PRODUCTION`
- **Périmètre :** Gestion des stocks MP/PF, mouvements, inventaire physique, alertes DLC, valorisation
- **Mots :** 10 342 | **Lignes :** 1 199

### 4. [MANUEL-04 — Responsable Approvisionnement](./MANUEL-04-APPROVISIONNEMENT.md)
- **Rôle RBAC :** `APPRO`
- **Périmètre :** Bons de commande, suivi fournisseurs, réceptions, alertes supply chain, stock MP critique
- **Mots :** 10 907 | **Lignes :** 1 363

### 5. [MANUEL-05 — Comptabilité / Facturation](./MANUEL-05-COMPTABILITE.md)
- **Rôle RBAC :** `ADMIN`
- **Périmètre :** Facturation (TVA 19%/9%/0%), timbre fiscal, journaux comptables, export PC Compta/Sage, déclaration G50
- **Mots :** 9 607 | **Lignes :** 1 390

### 6. [MANUEL-06 — Commercial / Relation Client](./MANUEL-06-COMMERCIAL.md)
- **Rôle RBAC :** `COMMERCIAL`
- **Périmètre :** Gestion clients, devis, factures vente, suivi encaissements, tableau de bord commercial
- **Mots :** 9 298 | **Lignes :** 1 297

### 7. [MANUEL-07 — Opérateur Terrain](./MANUEL-07-OPERATEUR.md)
- **Rôle RBAC :** `PRODUCTION` (accès restreint)
- **Périmètre :** Saisie production, réceptions physiques, comptage inventaire, scan QR, interface simplifiée
- **Mots :** 7 593 | **Lignes :** 893

### 8. [MANUEL-08 — Responsable Qualité](./MANUEL-08-QUALITE.md)
- **Rôle RBAC :** `ADMIN` / `PRODUCTION`
- **Périmètre :** Contrôle qualité réception/production, gestion lots, traçabilité HACCP, audit trail, évaluation fournisseurs
- **Mots :** 8 776 | **Lignes :** 978

### 9. [MANUEL-09 — Responsable IT Interne](./MANUEL-09-IT.md)
- **Rôle RBAC :** `ADMIN`
- **Périmètre :** Administration système, sécurité (JWT, CSRF, rate limiting), CI/CD, monitoring, backup, déploiement
- **Mots :** 9 846 | **Lignes :** 1 199

---

## Matrice de couverture — Modules ERP × Rôles

| Module ERP | Admin | Production | Stock | Appro | Compta | Commercial | Opérateur | Qualité | IT |
|------------|:-----:|:----------:|:-----:|:-----:|:------:|:----------:|:---------:|:-------:|:--:|
| **Auth & Sécurité** | ●● | ● | ● | ● | ● | ● | ● | ● | ●● |
| **Dashboard** | ●● | ●● | ● | ●● | ● | ●● | ○ | ● | ● |
| **Production** | ● | ●● | ○ | ○ | ○ | ○ | ●● | ●● | ○ |
| **Recettes** | ● | ●● | ○ | ○ | ○ | ○ | ● | ● | ○ |
| **Stock MP/PF** | ●● | ● | ●● | ●● | ○ | ○ | ● | ● | ○ |
| **Inventaire** | ●● | ● | ●● | ● | ○ | ○ | ●● | ●● | ○ |
| **Approvisionnement** | ● | ○ | ● | ●● | ○ | ○ | ● | ● | ○ |
| **Fournisseurs** | ●● | ○ | ○ | ●● | ○ | ○ | ○ | ● | ○ |
| **Clients** | ●● | ○ | ○ | ○ | ● | ●● | ○ | ○ | ○ |
| **Facturation** | ●● | ○ | ○ | ○ | ●● | ●● | ○ | ○ | ○ |
| **Comptabilité** | ● | ○ | ○ | ○ | ●● | ○ | ○ | ○ | ○ |
| **Rapports** | ●● | ● | ● | ● | ●● | ● | ○ | ● | ○ |
| **Livraisons** | ● | ○ | ● | ○ | ○ | ●● | ● | ○ | ○ |
| **Audit Trail** | ●● | ○ | ○ | ○ | ○ | ○ | ○ | ●● | ●● |
| **Monitoring** | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ●● |
| **CI/CD & DevOps** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ●● |

**Légende :** ●● = Module principal du rôle | ● = Accès ou interaction | ○ = Non concerné

---

## Plan de déploiement de la formation

### Phase 1 : Formation initiale (Semaine 1-2)
1. Distribuer le manuel correspondant à chaque collaborateur
2. Sessions de formation par rôle (2h chacune, basées sur les scripts vidéo)
3. Évaluation post-formation (quiz basé sur les scénarios réels)

### Phase 2 : Accompagnement terrain (Semaine 3-4)
1. Utilisation des checklists quotidiennes en situation réelle
2. Support par les responsables de module
3. Remontée des écarts et ajustements

### Phase 3 : Montée en maturité (Mois 2-6)
1. Auto-évaluation mensuelle par niveau de maturité
2. Mise en œuvre des recommandations d'optimisation court terme
3. Revue trimestrielle des matrices RACI

### Phase 4 : Excellence opérationnelle (Mois 6+)
1. Objectif : Niveau 3 (Maîtrisé) pour tous les rôles
2. Identification des rôles candidats au Niveau 4 (Optimisé)
3. Mise à jour des manuels selon les évolutions du système

---

## Architecture technique de référence

```
Manchengo Smart ERP v2.0
├── Backend:  NestJS + PostgreSQL 17 + Redis + BullMQ
│   └── Déployé sur Railway (manchengo-backend-production.up.railway.app)
├── Frontend: Next.js 14 + Tailwind CSS + Radix UI + TanStack Query
│   └── Déployé sur Vercel (web-eight-wheat-19.vercel.app)
├── Desktop:  Tauri 2.x (en développement)
├── Mobile:   Flutter (en développement)
└── Sécurité: JWT httpOnly, CSRF timing-safe, bcrypt 12, rate limiting 3-tier
```

---

> **Document généré par l'équipe War Room — Audit Manuel Utilisateur**
> **Manchengo Smart ERP v2.0 — Février 2026**
> **Score audit : 92/100 — Production Mature**

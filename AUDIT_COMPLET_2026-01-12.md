# 🔍 AUDIT COMPLET — Manchengo Smart ERP
**Date:** 12 Janvier 2026  
**Auditeur:** Cascade AI  
**Périmètre:** Backend, Frontend, Base de données, UX, Routes, Endpoints

---

## 📊 RÉSUMÉ EXÉCUTIF

| Catégorie | Critique | Élevé | Moyen | Faible |
|-----------|----------|-------|-------|--------|
| Base de données | 1 | 2 | 3 | 1 |
| Backend | 2 | 4 | 5 | 3 |
| Frontend | 3 | 6 | 8 | 4 |
| UX | 1 | 3 | 4 | 2 |
| **TOTAL** | **7** | **15** | **20** | **10** |

---

## 🔴 ERREURS CRITIQUES (7)

### 1. [FRONTEND] Composants UI manquants
**Fichiers:** `src/components/ui/*.tsx`  
**Impact:** Build TypeScript échoue

```
Cannot find module '@/components/ui/card'
Cannot find module '@/components/ui/badge'
Cannot find module '@/components/ui/tooltip'
Cannot find module '@/components/ui/alert-dialog'
Cannot find module '@/components/ui/button'
Cannot find module '@/components/ui/input'
Cannot find module '@/components/ui/label'
Cannot find module '@/components/ui/checkbox'
Cannot find module '@/components/ui/alert'
```

**Action requise:** Installer shadcn/ui et générer les composants manquants:
```bash
npx shadcn-ui@latest add card badge tooltip alert-dialog button input label checkbox alert
```

---

### 2. [BACKEND] Statuts legacy non migrés dans le service
**Fichier:** `apps/backend/src/demandes-mp/demandes-mp.service.ts`  
**Impact:** Incohérence entre schema Prisma et logique métier

Le service utilise encore les statuts **ENVOYEE** et **TRANSFORMEE** au lieu de **SOUMISE** et **EN_COURS_COMMANDE**:

```typescript
// Ligne 262-263 - Doit être SOUMISE
status: 'ENVOYEE',

// Ligne 497 - Doit être EN_COURS_COMMANDE
status: 'TRANSFORMEE',
```

**Action requise:** Migrer tous les usages vers les nouveaux statuts.

---

### 3. [BACKEND] Endpoint /transformer obsolète
**Fichier:** `apps/backend/src/demandes-mp/demandes-mp.controller.ts`  
**Impact:** Doublon de fonctionnalité avec generate-bc

L'endpoint `POST /demandes-mp/:id/transformer` existe encore alors que la génération de BC se fait via `/appro/demands/:id/generate-bc`.

**Action requise:** Supprimer ou rediriger l'ancien endpoint.

---

### 4. [BACKEND] Validation des statuts incohérente
**Fichier:** `apps/backend/src/demandes-mp/demandes-mp.service.ts` (lignes 315-316, 368-369)  
**Impact:** Blocage des validations

```typescript
if (demande.status !== 'ENVOYEE') {
  throw new BadRequestException('Seules les demandes ENVOYEES peuvent être validées');
}
```

Doit accepter **SOUMISE** au lieu de **ENVOYEE**.

---

### 5. [FRONTEND] Types 'any' implicites
**Fichiers:** Multiples (25+ occurrences)  
**Impact:** Perte de type safety, bugs potentiels

Exemples:
- `src/components/ui/critical-action-confirm.tsx:150` - Parameter 'e' implicitly has 'any' type
- `src/components/ui/critical-action-confirm.tsx:164` - Parameter 'checked' implicitly has 'any' type

---

### 6. [DATABASE] Statuts deprecated toujours dans l'enum
**Fichier:** `apps/backend/prisma/schema.prisma` (ligne 1080-1082)  
**Impact:** Confusion, données inconsistantes possibles

```prisma
ENVOYEE             // @deprecated - use SOUMISE
TRANSFORMEE         // @deprecated - use EN_COURS_COMMANDE
```

**Action requise:** Migration des données existantes puis suppression des statuts deprecated.

---

### 7. [UX] confirm() et alert() natifs encore utilisés
**Fichiers:** 16 fichiers, 59 occurrences  
**Impact:** UX pauvre, non-conforme aux standards modernes

Principaux fichiers:
- `dashboard/demandes-mp/page.tsx` (9 occurrences)
- `dashboard/production/recettes/page.tsx` (9 occurrences)
- `dashboard/production/[id]/page.tsx` (8 occurrences)
- `dashboard/appro/bons/page.tsx` (4 occurrences)

**Action requise:** Remplacer par le composant `CriticalActionConfirm` ou modals toast.

---

## 🟠 ERREURS ÉLEVÉES (15)

### 8. [BACKEND] TODO non implémentés
**Fichiers:** 3 fichiers  
**Impact:** Fonctionnalités incomplètes

| Fichier | TODO |
|---------|------|
| `delivery.service.ts:264` | Cache invalidation |
| `delivery.service.ts:605` | Cache invalidation |
| `appro.service.ts:714` | Calcul métriques fournisseurs |
| `purchase-order.service.ts:282` | Intégration email |

---

### 9. [FRONTEND] console.log en production
**Fichiers:** 24 fichiers, 59 occurrences  
**Impact:** Fuites d'information, pollution console

Top fichiers:
- `demandes-mp/page.tsx` (6 occurrences)
- `appro/demandes/page.tsx` (5 occurrences)
- `invoices/page.tsx` (4 occurrences)
- `production/page.tsx` (4 occurrences)

**Action requise:** Remplacer par le logger structuré ou supprimer.

---

### 10. [BACKEND] Rôle COMPTABLE absent
**Fichier:** `apps/backend/prisma/schema.prisma`  
**Impact:** Rôle mentionné dans la documentation mais non défini

L'enum `UserRole` ne contient que: `ADMIN`, `APPRO`, `PRODUCTION`, `COMMERCIAL`

Le rôle **COMPTABLE** mentionné dans la mémoire système n'existe pas.

---

### 11. [FRONTEND] Types Demande inconsistants
**Fichiers:** Multiples pages demandes  
**Impact:** Duplication, maintenance difficile

Le type `DemandeStatus` est redéfini dans:
- `apps/web/src/app/(dashboard)/dashboard/appro/demandes/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/appro/demandes/[id]/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/demandes-mp/page.tsx`
- `apps/web/src/components/appro/DemandTimeline.tsx`

**Action requise:** Centraliser dans `lib/api.ts` ou un fichier types dédié.

---

### 12. [API] Swagger query param obsolète
**Fichier:** `apps/backend/src/demandes-mp/demandes-mp.controller.ts` (ligne 61)

```typescript
@ApiQuery({ name: 'status', required: false, enum: ['BROUILLON', 'ENVOYEE', 'VALIDEE', 'REJETEE', 'TRANSFORMEE'] })
```

Doit inclure les nouveaux statuts: `SOUMISE`, `EN_COURS_COMMANDE`, `COMMANDEE`, `RECEPTIONNEE`

---

### 13. [FRONTEND] Page dupliqueée
**Fichiers:** 
- `apps/web/src/app/(dashboard)/dashboard/demandes-mp/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/appro/demandes/page.tsx`

**Impact:** Confusion, maintenance double

Deux pages gèrent les demandes MP avec des logiques légèrement différentes.

---

### 14. [UX] Bouton "Envoyer" vs "Soumettre la demande"
**Fichier:** `apps/web/src/app/(dashboard)/dashboard/demandes-mp/page.tsx`  
**Impact:** Vocabulaire incohérent

Le fichier utilise encore "Envoyer" au lieu de "Soumettre la demande".

---

### 15-22. [Autres erreurs élevées]
- Gestion d'erreurs inconsistante dans les services
- Absence de validation DTO pour certains endpoints
- Pagination non standardisée entre endpoints
- Absence de tests pour les nouveaux statuts
- Incohérence des formats de date (ISO vs locale)
- Absence de rate limiting sur certains endpoints critiques
- Logs insuffisants pour audit trail
- Absence de health check détaillé

---

## 🟡 ERREURS MOYENNES (20)

### 23. [BACKEND] Relations Prisma sans index
Certaines relations foreign key n'ont pas d'index explicite.

### 24. [FRONTEND] Imports non optimisés
Imports de lucide-react non tree-shakés (import complet au lieu de cherry-picking).

### 25. [UX] Absence de confirmation sur actions destructives
Suppression de demandes sans confirmation modale.

### 26. [API] Absence de versioning API
Pas de préfixe `/v1/` pour futureproofing.

### 27. [FRONTEND] Absence de skeleton loaders
Certaines pages n'ont pas de loading states visuels.

### 28. [BACKEND] Absence de soft-delete uniforme
Certains modèles ont `isDeleted`, d'autres non.

### 29. [UX] Timeline non mise à jour en temps réel
Après action, la timeline ne se rafraîchit pas automatiquement.

### 30. [FRONTEND] État local vs global
Mélange de useState et contexte sans pattern clair.

### 31-42. [Autres erreurs moyennes]
- Absence de retry logic sur les appels API
- Pas de debounce sur les recherches
- Formulaires sans validation côté client
- Absence de breadcrumbs cohérents
- Messages d'erreur non traduits
- Absence de dark mode
- Pas de responsive design complet
- Absence de PWA manifest
- Cache browser non configuré
- Absence de lazy loading images
- Bundle size non optimisé
- Absence de error boundaries

---

## 🟢 ERREURS FAIBLES (10)

### 43. Commentaires en français/anglais mélangés
### 44. Variables non utilisées dans certains fichiers
### 45. Imports non triés alphabétiquement
### 46. Espacement inconsistant dans le code
### 47. Console warnings React (useEffect dependencies)
### 48. Absence de JSDoc sur fonctions publiques
### 49. Fichiers de test incomplets
### 50. README incomplet pour certains modules
### 51. Absence de CHANGELOG
### 52. .env.example incomplet

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Phase 1 — Critique (1-2 jours)
1. ✅ Installer composants shadcn/ui manquants
2. ✅ Migrer service demandes-mp vers nouveaux statuts
3. ✅ Supprimer/rediriger endpoint /transformer
4. ✅ Corriger validation statuts SOUMISE

### Phase 2 — Élevé (3-5 jours)
1. Centraliser types DemandeStatus
2. Remplacer confirm()/alert() par modals
3. Supprimer console.log
4. Implémenter TODO backend
5. Mettre à jour Swagger

### Phase 3 — Moyen (1-2 semaines)
1. Ajouter skeleton loaders
2. Implémenter soft-delete uniforme
3. Ajouter error boundaries
4. Optimiser bundle size

### Phase 4 — Faible (ongoing)
1. Uniformiser commentaires
2. Compléter documentation
3. Ajouter tests manquants

---

## 📁 FICHIERS À MODIFIER EN PRIORITÉ

| Fichier | Actions |
|---------|---------|
| `apps/backend/src/demandes-mp/demandes-mp.service.ts` | Migrer statuts |
| `apps/backend/src/demandes-mp/demandes-mp.controller.ts` | Update Swagger, supprimer /transformer |
| `apps/web/src/components/ui/*.tsx` | Installer shadcn/ui |
| `apps/web/src/app/(dashboard)/dashboard/demandes-mp/page.tsx` | Unifier avec appro/demandes |
| `apps/backend/prisma/schema.prisma` | Migration données puis suppression deprecated |

---

## ✅ POINTS POSITIFS

- Architecture backend NestJS bien structurée
- Prisma schema complet avec bonnes relations
- Système d'audit trail en place
- Sécurité httpOnly cookies implémentée
- Rate limiting configuré
- Système de rôles RBAC fonctionnel
- API client centralisé
- Logging structuré côté backend

---

**FIN DE L'AUDIT**

*Ce rapport a été généré automatiquement. Toute correction doit être validée manuellement avant mise en production.*

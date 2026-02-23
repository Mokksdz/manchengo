# AUDIT APPLICATION MOBILE — Manchengo Smart ERP

**Date:** 2026-02-22
**Score:** 58/100
**Plateforme:** Flutter (Dart)
**Status:** Alpha — ~40-50% production-ready

---

## RESUME

L'application mobile Flutter presente une architecture propre (Provider + go_router + sqflite) mais souffre de lacunes critiques qui empechent tout deploiement: authentification factice, pas de certificate pinning, tokens stockes en clair, et 21 TODO non resolus.

---

## ARCHITECTURE

```
apps/mobile/
├── lib/
│   ├── core/
│   │   ├── state/app_state.dart     # Provider state management
│   │   ├── data/sqlite_repository.dart  # 14 tables SQLite
│   │   └── api/api_service.dart     # HTTP client
│   ├── features/
│   │   ├── auth/login_screen.dart   # TODO: "Implement actual authentication"
│   │   ├── sales/sales_create_screen.dart
│   │   ├── sync/sync_screen.dart
│   │   └── ...
│   └── main.dart
├── pubspec.yaml
└── test/fiscal_test.dart            # Seul fichier de test
```

### Stack Technique
- **State:** Provider (ChangeNotifier)
- **Navigation:** go_router
- **DB locale:** sqflite (14 tables)
- **HTTP:** http package
- **Scanner:** mobile_scanner (QR codes)
- **Routing:** GoRouter avec guards

---

## FAILLES CRITIQUES

### 1. Authentification Factice
**Fichier:** `lib/features/auth/login_screen.dart`
**Probleme:** Le login est un dummy — le TODO indique "Implement actual authentication"
**Impact:** Tout utilisateur peut acceder a l'app sans credentials
**Fix:** Implementer le flow JWT complet avec le backend NestJS

### 2. Tokens en Clair dans SQLite
**Fichier:** `lib/core/data/sqlite_repository.dart`
**Probleme:** Les tokens d'authentification sont stockes sans chiffrement
**Impact:** Extraction triviale sur device roote/jailbreake
**Fix:** Utiliser flutter_secure_storage (Keychain iOS / Keystore Android)

### 3. Pas de Certificate Pinning
**Probleme:** Les requetes HTTP ne verifient pas le certificat serveur
**Impact:** Attaque MITM (Man-in-the-Middle) possible sur reseau non-securise
**Fix:** Ajouter ssl_pinning_plugin ou configurer le NetworkSecurityConfig Android

### 4. Chargement Complet en Memoire
**Fichier:** `lib/core/state/app_state.dart`
**Probleme:** AppState charge toutes les donnees en memoire au demarrage
**Impact:** Crash OOM sur devices avec peu de RAM (< 2GB)
**Fix:** Implementer lazy loading + pagination

---

## MODULES ET COMPLETUDE

| Module | Complete | Production-Ready | Notes |
|--------|----------|------------------|-------|
| Login/Auth | 30% | NON | Dummy implementation |
| Sales/Ventes | 70% | NON | UI presente, business logic incomplete |
| Sync | 60% | NON | Ecran de status, pas de conflict resolution |
| Scanner QR | 50% | NON | Integration partielle |
| Stock | 40% | NON | Vues basiques |
| Dashboard | 50% | NON | KPIs statiques |

---

## TESTING

| Metrique | Valeur |
|----------|--------|
| Fichiers de test | 1 (`fiscal_test.dart`) |
| Tests | 13 cas (calculs fiscaux algeriens) |
| Coverage | ~5% |
| Widget tests | 0 |
| Integration tests | 0 |

---

## SCORING DETAILLE

| Categorie | Score | Notes |
|-----------|-------|-------|
| Architecture | 70/100 | Propre, Provider + GoRouter + SQLite |
| Securite | 25/100 | Auth factice, tokens en clair, pas de pinning |
| Features | 50/100 | ~50% des modules implementes |
| Testing | 15/100 | 1 seul fichier de test |
| Performance | 55/100 | Chargement memoire complet |
| UX/UI | 65/100 | Design coherent avec le web |
| Offline | 60/100 | SQLite present, sync incomplete |
| **GLOBAL** | **58/100** | **Alpha, non deployable** |

---

## PLAN D'ACTION

### Phase 1: Securite (1-2 semaines)
1. Implementer auth reelle (JWT flow complet)
2. Migrer tokens vers flutter_secure_storage
3. Ajouter certificate pinning
4. Chiffrer la DB locale (sqflite_cipher)

### Phase 2: Features (3-4 semaines)
1. Completer module Sales avec validation
2. Implementer sync conflict resolution
3. Scanner QR: validation complete avec backend
4. Dashboard: KPIs dynamiques

### Phase 3: Qualite (2 semaines)
1. Widget tests pour chaque ecran
2. Integration tests pour workflows critiques
3. Coverage target: 60%
4. Performance profiling sur low-end devices

---

*Rapport genere le 2026-02-22 — Agent 4 (Mobile Application)*

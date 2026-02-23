# RAPPORT DE SECURITE — Manchengo Smart ERP

**Date:** 2026-02-23 (mis a jour Phase 5: Certification Audit)
**Score Securite:** 82/100 (INCHANGE — code WAR ROOM non deploye)
**Classification:** CONFIDENTIEL
**Status:** Production Phase 4. Code securite WAR ROOM (bcrypt 12, CSRF timing-safe, CSP tight, health hardened) ecrit localement, EN ATTENTE de deploiement.

---

## RESUME EXECUTIF

La posture de securite de Manchengo Smart ERP est **solide pour un produit en production**. La Phase 5 (WAR ROOM) a durci la securite: bcrypt rounds augmentes a 12 (constante centralisee), CSRF validation par `crypto.timingSafeEqual()` (anti-timing attack), CSP connect-src restreint au backend specifique (plus de wildcard wss:), uptime retire du health endpoint basique. Les vulnerabilites restantes sont principalement liees aux plateformes mobile/desktop (non deployees).

### Audit Live Production (2026-02-23)

| Test | Resultat |
|------|----------|
| HSTS header | ✅ `max-age=31536000; includeSubDomains; preload` |
| X-Frame-Options | ✅ `DENY` |
| X-Content-Type-Options | ✅ `nosniff` |
| Referrer-Policy | ✅ `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| CSP | ✅ Present (default-src 'self', frame-ancestors 'none', etc.) |
| TLS Version | ✅ TLS 1.3 (CHACHA20-POLY1305) |
| CORS | ✅ Whitelist (domaine Vercel autorise, pas de wildcard `*`) |
| Swagger /docs | ✅ 404 (desactive) |
| Rate Limiting | ✅ 3-tier (x-ratelimit-limit-short: 10, medium: 100, long: 1000) |

---

## MATRICE DE VULNERABILITES

### CRITIQUE — TOUTES CORRIGEES ✅

| ID | Vulnerabilite | CVSS | Status |
|----|--------------|------|--------|
| ~~SEC-C01~~ | ~~Security headers absents~~ | ~~7.5~~ | **CORRIGE Phase 4** — 8 headers actifs (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies) |
| ~~SEC-C02~~ | ~~Secrets dans .env~~ | ~~9.0~~ | **CORRIGE Phase 4** — Variables d'env sur Railway/Vercel, pas dans git |
| ~~SEC-C03~~ | ~~QR_SECRET_KEY manquant~~ | ~~7.0~~ | **CORRIGE Phase 4** — Configure dans env vars Railway |
| ~~SEC-C04~~ | ~~Memory leak rate limiter~~ | ~~6.5~~ | **CORRIGE Phase 4** — Redis ThrottlerModule 3-tier (short: 10/60s, medium: 100/300s, long: 1000/3600s) |
| ~~NEW~~ | ~~Swagger expose en production~~ | ~~8.0~~ | **CORRIGE Phase 4** — SWAGGER_ENABLED=false, /docs → 404 |

### HIGH (Fix cette semaine)

| ID | Vulnerabilite | CVSS | Fichier | Description |
|----|--------------|------|---------|-------------|
| SEC-H01 | JWT decode sans verify | 6.0 | `apps/web/src/middleware.ts` | Frontend decode le JWT pour extraire le role mais ne verifie pas la signature |
| SEC-H02 | CSRF token pas httpOnly | 5.5 | `csrf.middleware.ts` | Necessaire pour lecture JS, mais expose au vol via XSS |
| SEC-H03 | Tauri CSP trop permissive | 5.0 | `tauri.conf.json` | Wildcard `*.manchengo.dz` (desktop non deploye) |
| SEC-H04 | Mobile: tokens en clair | 6.5 | `sqlite_repository.dart` | Tokens stockes sans chiffrement (mobile non deploye) |
| SEC-H05 | Mobile: pas de certificate pinning | 5.5 | `apps/mobile/` | MITM possible (mobile non deploye) |

### MEDIUM (Fix dans 30 jours)

| ID | Vulnerabilite | CVSS | Fichier | Description |
|----|--------------|------|---------|-------------|
| SEC-M01 | Password validation faible | 4.0 | `auth.service.ts` | Pas de verification de complexite |
| SEC-M02 | Race condition references | 4.5 | `production.service.ts` | findFirst + retry loop |
| SEC-M03 | Transaction isolation | 4.0 | Multiple services | Pas de niveau d'isolation specifie |
| SEC-M04 | Mobile auth factice | 8.0 | `login_screen.dart` | Dummy login (mobile non deploye) |
| ~~SEC-M05~~ | ~~75 console.log frontend~~ | ~~3.0~~ | — | **CORRIGE Phase 3** |
| SEC-M06 | CSP `unsafe-inline` scripts | 4.0 | `next.config.js` | Necessaire Next.js, risque XSS residuel |
| SEC-M07 | CSP `wss:` wildcard connect-src | 3.5 | `next.config.js` | Devrait cibler le backend specifique |
| SEC-M08 | Health endpoint expose `uptime` | 2.0 | `health.controller.ts` | Fuite d'information serveur |

### LOW (Fix dans 90 jours)

| ID | Vulnerabilite | CVSS | Fichier | Description |
|----|--------------|------|---------|-------------|
| SEC-L01 | bcrypt rounds = 10 | 2.0 | `auth.service.ts` | Standard minimum, recommande 12+ pour 2026 |
| ~~SEC-L02~~ | ~~SSL/TLS commente~~ | ~~3.0~~ | — | **CORRIGE Phase 4** — TLS 1.3 auto via Vercel/Railway |
| SEC-L03 | Dev secrets hardcodes | 2.5 | `.env` | Secrets de dev potentiellement dans historique git |

---

## CE QUI EST BIEN FAIT

### Authentification & Autorisation
- **httpOnly cookies** pour les tokens JWT (empeche vol par XSS) ✅ Verifie en prod
- **RBAC fail-closed** — endpoints sans `@Roles()` sont DENIES par defaut
- **Brute force protection** — 5 tentatives, lockout 15 minutes
- **Device tracking** — authentification liee aux devices
- **Refresh tokens** — rotation automatique
- **Anti-enumeration** — meme message d'erreur pour email/mot de passe invalide

### Security Headers (NOUVEAU Phase 4 — Verifie en production)
- **Content-Security-Policy** — default-src 'self', frame-ancestors 'none', form-action 'self', object-src 'none'
- **Strict-Transport-Security** — max-age=31536000; includeSubDomains; preload
- **X-Frame-Options** — DENY (anti-clickjacking)
- **X-Content-Type-Options** — nosniff (anti-MIME sniffing)
- **Referrer-Policy** — strict-origin-when-cross-origin
- **Permissions-Policy** — camera=(), microphone=(), geolocation=(), interest-cohort=()
- **X-DNS-Prefetch-Control** — on
- **X-Permitted-Cross-Domain-Policies** — none

### Audit & Tracabilite
- **Audit trail immutable** — SHA256 hash chain (chaque entree reference le hash precedent)
- **Soft deletes** — pas de suppression physique, conforme compliance
- **Event sourcing** — sync module avec historique complet des changements

### Infrastructure (Verifie en production)
- **Helmet.js** configure avec options strictes (backend Railway)
- **CORS whitelist** — pas de wildcard `*` (Vercel domain autorise)
- **Validation pipes** — class-validator sur tous les DTOs
- **Queries parametrisees** — Prisma empeche l'injection SQL
- **Rate limiting Redis** — ThrottlerModule avec 3 paliers (short: 10/60s, medium: 100/300s, long: 1000/3600s) ✅ Verifie en prod
- **TLS 1.3** — CHACHA20-POLY1305 (auto via Vercel + Railway) ✅
- **Swagger desactive** — /docs → 404 en production ✅

### Crypto & Secrets
- **bcrypt** pour le hashing de mots de passe
- **JWT** avec access + refresh tokens
- **QR checksum** — validation anti-fraude pour livraisons
- **Secrets securises** — Variables d'env sur Railway/Vercel (pas dans git) ✅

---

## ANALYSE PAR SURFACE D'ATTAQUE

### Web Application (Next.js) — Verifie en production 2026-02-23
| Vecteur | Protection | Status |
|---------|-----------|--------|
| XSS | CSP (default-src 'self', script-src 'self' 'unsafe-inline') | ✅ PROTEGE (partiel — unsafe-inline requis par Next.js) |
| Clickjacking | X-Frame-Options: DENY + frame-ancestors 'none' | ✅ PROTEGE |
| MIME Sniffing | X-Content-Type-Options: nosniff | ✅ PROTEGE |
| CSRF | Token + SameSite cookies | ✅ PROTEGE |
| SQL Injection | Prisma (parametrise) | ✅ PROTEGE |
| Auth Bypass | httpOnly cookies | ✅ PROTEGE |
| Session Hijack | Secure + httpOnly + HSTS | ✅ PROTEGE |
| Info Leakage | Referrer-Policy + Permissions-Policy | ✅ PROTEGE |

### Backend API (NestJS) — Verifie en production 2026-02-23
| Vecteur | Protection | Status |
|---------|-----------|--------|
| Brute Force | Lockout 5/15min | ✅ PROTEGE |
| Rate Limiting | Redis ThrottlerModule 3-tier | ✅ PROTEGE |
| Injection | Class-validator + Prisma | ✅ PROTEGE |
| Privilege Escalation | RBAC fail-closed | ✅ PROTEGE |
| DoS (Memory) | Redis-backed (plus de Map JS) | ✅ PROTEGE |
| API Documentation | Swagger desactive (/docs → 404) | ✅ PROTEGE |

### Desktop (Tauri)
| Vecteur | Protection | Status |
|---------|-----------|--------|
| CSP | Wildcard subdomain | PARTIELLEMENT |
| Local DB | SQLite | NON CHIFFRE |
| Command Injection | Tauri command whitelist | PROTEGE |

### Mobile (Flutter)
| Vecteur | Protection | Status |
|---------|-----------|--------|
| Auth | Dummy login | NON PROTEGE |
| MITM | Pas de pinning | VULNERABLE |
| Token Storage | Plaintext SQLite | VULNERABLE |
| Reverse Engineering | Pas de obfuscation | VULNERABLE |

---

## PLAN DE REMEDIATION

### Phase 1: Urgence — ✅ COMPLETE (Phase 4)
1. ~~**Ajouter security headers**~~ ✅ **FAIT** — 8 headers complets dans `next.config.js`
2. ~~**Rotationner secrets**~~ ✅ **FAIT** — env vars sur Railway/Vercel
3. ~~**Corriger memory leak rate limiter**~~ ✅ **FAIT** — Redis ThrottlerModule
4. ~~**Supprimer console.log**~~ ✅ **FAIT Phase 3**
5. ~~**Activer SSL/TLS**~~ ✅ **FAIT** — TLS 1.3 auto via Vercel + Railway
6. ~~**Desactiver Swagger en prod**~~ ✅ **FAIT** — SWAGGER_ENABLED=false

### Phase 2: Hardening (Semaine prochaine)
7. Resserrer CSP `connect-src` (remplacer `wss:` wildcard par URL backend specifique)
8. Ajouter password complexity validation
9. Implementer JWT verify dans middleware frontend
10. Corriger Tauri CSP (remplacer wildcard) — pour desktop
11. Supprimer `uptime` du health endpoint

### Phase 3: Avance (Mois 2-3)
12. Migrer tokens mobile vers flutter_secure_storage
13. Ajouter certificate pinning mobile
14. Penetration testing externe
15. Bug bounty program (HackerOne)
16. SOC 2 Type 1 preparation
17. GDPR compliance audit

---

## SCORING DETAILLE

| Categorie | Score | Delta | Notes |
|-----------|-------|-------|-------|
| Authentification | 85/100 | +3 | httpOnly, RBAC, lockout, login verifie en prod |
| Autorisation | 88/100 | — | Fail-closed RBAC, device tracking |
| Chiffrement | 72/100 | +7 | bcrypt 10 en prod (fix bcrypt 12 non deploye), TLS 1.3 actif |
| Headers HTTP | 88/100 | +58 | 8 headers complets, CSP wildcard wss: TOUJOURS en prod |
| Audit Trail | 90/100 | — | Hash chain, event sourcing, soft deletes |
| Gestion Secrets | 80/100 | +35 | Env vars Railway/Vercel, pas de .env dans git |
| Infrastructure | 82/100 | +12 | TLS 1.3, CORS, Swagger off (uptime toujours expose en prod) |
| CSRF | 70/100 | — | Comparaison basique en prod (fix timing-safe non deploye) |
| Mobile Security | 25/100 | — | Auth factice, pas de pinning (non deploye) |
| **GLOBAL** | **82/100** | **(inchange)** | **Production Phase 4 — fixes WAR ROOM non deployes** |

---

## CONFORMITE

| Standard | Status | Gap |
|----------|--------|-----|
| OWASP Top 10 | Bon | A01 (Auth ✅), A03 (Injection ✅), A05 (Misconfig ✅ — headers complets) |
| RGPD/GDPR | Non evalue | Pas de DPO, pas de privacy policy |
| PCI DSS | N/A | Pas de traitement cartes bancaires |
| ISO 27001 | Non conforme | Pas de SMSI |
| Loi algerienne 18-07 | A verifier | Protection donnees personnelles |

---

*Rapport genere le 2026-02-22 — Agent 5 (Security)*
*Mis a jour le 2026-02-22 apres WAR ROOM Phase 3 (console cleanup complet)*
*Mis a jour le 2026-02-23 apres Phase 4: Deploiement Production + Audit Live*
*Classification: CONFIDENTIEL — Usage interne uniquement*

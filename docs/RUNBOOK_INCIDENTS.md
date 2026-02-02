# Manchengo Smart ERP - Runbook Incidents

## Table des matières

1. [Contacts & Escalade](#contacts--escalade)
2. [Procédures de diagnostic](#procédures-de-diagnostic)
3. [Incidents courants](#incidents-courants)
4. [Procédures de recovery](#procédures-de-recovery)

---

## Contacts & Escalade

| Niveau | Responsable | Délai de réponse |
|--------|-------------|-----------------|
| L1 - Ops | Équipe opérations | 15 min |
| L2 - Dev | Lead développeur | 30 min |
| L3 - CTO | CTO / Architecte | 1h |

---

## Procédures de diagnostic

### Vérifier l'état global

```bash
# Health check backend
curl -s http://localhost:3000/api/health/detailed | jq .

# Vérifier les conteneurs
docker compose ps

# Logs récents backend
docker compose logs backend --tail=100

# État PostgreSQL
docker compose exec postgres pg_isready

# État Redis
docker compose exec redis redis-cli ping
```

### Métriques clés à surveiller

- **CPU/Memory** : `docker stats manchengo-backend`
- **Connexions DB** : `SELECT count(*) FROM pg_stat_activity;`
- **Cache hit rate** : `GET /api/health/detailed` → `cache.hitRate`
- **Erreurs Sentry** : Dashboard Sentry → filtrer par `manchengo-backend`

---

## Incidents courants

### INC-001: Backend ne répond plus (HTTP 502/503)

**Symptômes** : Erreur 502 nginx, health check échoue

**Diagnostic** :
```bash
docker compose ps backend
docker compose logs backend --tail=50
docker stats manchengo-backend
```

**Résolution** :
```bash
# 1. Restart du backend
docker compose restart backend

# 2. Si OOM (Out of Memory)
docker compose down backend
docker compose up -d backend

# 3. Si crash loop
docker compose logs backend --tail=200
# Corriger la cause, puis redéployer
```

**Prévention** : Monitoring mémoire + alertes > 80%

---

### INC-002: Base de données inaccessible

**Symptômes** : Erreurs Prisma "Connection refused", health/ready → database: down

**Diagnostic** :
```bash
docker compose ps postgres
docker compose logs postgres --tail=50
docker compose exec postgres pg_isready -U manchengo
```

**Résolution** :
```bash
# 1. Restart PostgreSQL
docker compose restart postgres

# 2. Si corruption
docker compose down postgres
docker compose up -d postgres

# 3. Si données corrompues → Restauration backup
./infra/backup/restore-postgres.sh /backups/manchengo/latest.sql.gz
```

**RTO** : 4 heures | **RPO** : 6 heures

---

### INC-003: Redis cache indisponible

**Symptômes** : Latence élevée, health/ready → cache: down

**Diagnostic** :
```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} ping
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} info memory
```

**Résolution** :
```bash
# 1. Restart Redis
docker compose restart redis

# 2. Flush cache si données corrompues
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL
```

**Impact** : Performance dégradée (fallback mémoire), pas de perte de données.

---

### INC-004: Rate limiting bloque des utilisateurs légitimes

**Symptômes** : HTTP 429 pour des utilisateurs normaux

**Diagnostic** :
```bash
# Vérifier les logs nginx
docker compose logs nginx | grep 429

# Vérifier la config rate limiting
cat infra/nginx/conf.d/default.conf | grep limit_req
```

**Résolution** :
```bash
# Temporaire : augmenter les limites dans .env
RATE_LIMIT_MAX=200

# Restart backend
docker compose restart backend
```

---

### INC-005: Erreurs de synchronisation mobile

**Symptômes** : Appareils mobiles ne synchronisent plus

**Diagnostic** :
```bash
# Vérifier les événements sync en erreur
docker compose exec postgres psql -U manchengo -d manchengo_erp \
  -c "SELECT status, COUNT(*) FROM sync_events GROUP BY status;"

# Vérifier les devices actifs
docker compose exec postgres psql -U manchengo -d manchengo_erp \
  -c "SELECT id, name, platform, last_sync_at FROM devices WHERE is_active = true;"
```

**Résolution** :
```bash
# Réinitialiser les événements en erreur
docker compose exec postgres psql -U manchengo -d manchengo_erp \
  -c "UPDATE sync_events SET status = 'PENDING' WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '24 hours';"
```

---

### INC-006: Certificat SSL expiré

**Symptômes** : ERR_CERT_DATE_INVALID dans le navigateur

**Résolution** :
```bash
# Renouveler le certificat Let's Encrypt
docker compose run --rm certbot renew

# Reload nginx
docker compose exec nginx nginx -s reload
```

**Prévention** : Cron job de renouvellement automatique tous les 60 jours.

---

## Procédures de recovery

### Restauration complète (Disaster Recovery)

```bash
# 1. Provisionner une nouvelle machine
# 2. Cloner le repository
git clone <repo-url> && cd manchengo-smart-erp

# 3. Configurer l'environnement
cp .env.production.example .env
# Remplir les variables

# 4. Lancer l'infrastructure
docker compose up -d postgres redis

# 5. Restaurer la base de données
./infra/backup/restore-postgres.sh /backups/latest.sql.gz

# 6. Lancer les applications
docker compose up -d backend web nginx

# 7. Vérifier
curl -s http://localhost:3000/api/health/detailed
```

### Rollback applicatif

```bash
./infra/deploy/rollback.sh
```

---

## Post-mortem template

Après chaque incident majeur, créer un document :

```
## Incident: [Titre]
- **Date** : YYYY-MM-DD HH:MM
- **Durée** : X heures
- **Impact** : Utilisateurs affectés, fonctionnalités down
- **Cause racine** : Description technique
- **Résolution** : Actions prises
- **Actions préventives** : Ce qu'on va faire pour éviter la récidive
```

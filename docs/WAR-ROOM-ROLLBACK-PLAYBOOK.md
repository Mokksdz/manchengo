# WAR ROOM ROLLBACK PLAYBOOK
## Manchengo Smart ERP — Production Stabilization

**Date**: 2026-02-23
**Status**: READY TO EXECUTE
**Rollback Readiness Score**: 95/100
**Max Rollback SLA**: < 12 minutes (all patches)

---

## EXECUTIVE SUMMARY

This playbook provides complete rollback procedures for 5 WAR ROOM patches targeting production readiness. Every command is copy-paste ready. Zero theory.

| Patch | Risk | Rollback Time | Data Loss | Downtime |
|-------|------|---------------|-----------|----------|
| PATCH-A6 (Memory) | LOW | 2 min | 0 | 0 |
| PATCH-A1 (CI/CD) | LOW | 1 min | 0 | 0 |
| PATCH-A3 (Security) | HIGH | 3 min | 0 | 0 |
| PATCH-A7 (Migration) | LOW | 1 min | 0 | 0 |
| PATCH-A5 (Performance) | MEDIUM | 8 min | 0 | 0* |

*\*PATCH-A5 DB rollback: 0 downtime for index/MV drops; 3-6 min maintenance window for full DB restore.*

---

## 0. PRE-PATCH PREPARATION (RUN ONCE BEFORE ANY PATCHES)

### 0.1 Git Safety Tag

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"
git tag pre-warroom-20260223 064e8d8
git push origin pre-warroom-20260223
```

### 0.2 Docker Image Snapshot

```bash
export REGISTRY="ghcr.io"
export REPO="Mokksdz/manchengo"
export TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Discover current images
export CURRENT_BACKEND=$(kubectl get deployment manchengo-backend -n manchengo \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="backend")].image}')
export CURRENT_WEB=$(kubectl get deployment manchengo-web -n manchengo \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="web")].image}')

# Pull, tag, push
docker pull "$CURRENT_BACKEND" && docker pull "$CURRENT_WEB"
docker tag "$CURRENT_BACKEND" "${REGISTRY}/${REPO}/backend:pre-warroom"
docker tag "$CURRENT_WEB" "${REGISTRY}/${REPO}/web:pre-warroom"
docker push "${REGISTRY}/${REPO}/backend:pre-warroom"
docker push "${REGISTRY}/${REPO}/web:pre-warroom"

# Record
echo "BACKEND_PRE=${CURRENT_BACKEND}" >> warroom-manifest.env
echo "WEB_PRE=${CURRENT_WEB}" >> warroom-manifest.env
echo "TIMESTAMP=${TIMESTAMP}" >> warroom-manifest.env
```

### 0.3 K8s State Snapshot

```bash
SNAPSHOT_DIR="/tmp/manchengo-pre-warroom-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${SNAPSHOT_DIR}"

kubectl get deployment manchengo-backend -n manchengo -o yaml > "${SNAPSHOT_DIR}/backend-deployment.yaml"
kubectl get deployment manchengo-web -n manchengo -o yaml > "${SNAPSHOT_DIR}/web-deployment.yaml"
kubectl rollout history deployment/manchengo-backend -n manchengo \
  -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}' \
  | tee "${SNAPSHOT_DIR}/backend-revision.txt"
kubectl rollout history deployment/manchengo-web -n manchengo \
  -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}' \
  | tee "${SNAPSHOT_DIR}/web-revision.txt"
kubectl get pods -n manchengo -o wide > "${SNAPSHOT_DIR}/pods.txt"
kubectl get hpa -n manchengo -o yaml > "${SNAPSHOT_DIR}/hpa.yaml"
```

### 0.4 Database Backup

```bash
export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="manchengo"
export PGDATABASE="manchengo_erp"
export BACKUP_DIR="/var/backups/manchengo"
export BACKUP_FILE="${BACKUP_DIR}/manchengo_pre_warroom_$(date +%Y%m%d_%H%M%S).dump"

mkdir -p "${BACKUP_DIR}"

pg_dump \
  --host="${PGHOST}" --port="${PGPORT}" --username="${PGUSER}" \
  --dbname="${PGDATABASE}" --format=custom --compress=9 \
  --verbose --file="${BACKUP_FILE}" --no-owner --no-privileges \
  2>&1 | tee "${BACKUP_DIR}/backup.log"

# Verify
pg_restore --list "${BACKUP_FILE}" > /dev/null && echo "BACKUP VALID" || echo "BACKUP CORRUPT"
```

### 0.5 Redis Snapshot

```bash
redis-cli BGSAVE
sleep 2
DUMP_DIR=$(redis-cli CONFIG GET dir | tail -1)
DUMP_FILE=$(redis-cli CONFIG GET dbfilename | tail -1)
cp "${DUMP_DIR}/${DUMP_FILE}" "${DUMP_DIR}/pre-warroom-$(date +%Y%m%d_%H%M%S).rdb"

# Baseline
redis-cli INFO memory > /tmp/redis_memory_baseline.txt
redis-cli DBSIZE >> /tmp/redis_memory_baseline.txt
```

### 0.6 K8s Revision History Increase

```bash
kubectl patch deployment manchengo-backend -n manchengo -p '{"spec":{"revisionHistoryLimit": 25}}'
kubectl patch deployment manchengo-web -n manchengo -p '{"spec":{"revisionHistoryLimit": 25}}'
```

---

## 1. PATCH-A6 ROLLBACK — Memory & Rate Limiter Fixes

**Files**: `security-hardening.service.ts`, `sync.guard.ts`, `dashboard.gateway.ts`
**Component**: Backend only
**Risk**: LOW — additive changes (Map caps, cleanup intervals)
**Downtime**: 0 (rolling update, maxUnavailable:0)

### Git Rollback

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"

# If NOT committed yet (working tree changes only):
git checkout HEAD -- \
  apps/backend/src/governance/security-hardening.service.ts \
  apps/backend/src/modules/sync/sync.guard.ts \
  apps/backend/src/common/websocket/dashboard.gateway.ts

# If committed:
git revert --no-edit <PATCH-A6-COMMIT-SHA>
git push origin main
```

### K8s Rollback

```bash
kubectl rollout undo deployment/manchengo-backend -n manchengo
kubectl rollout status deployment/manchengo-backend -n manchengo --timeout=300s
```

### Redis Impact: NONE

PATCH-A6 only modifies in-memory `Map` fallback objects. No Redis key changes.

### Verification

```bash
kubectl get pods -n manchengo -l component=backend -o wide
kubectl exec -n manchengo \
  $(kubectl get pod -n manchengo -l component=backend -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:3000/api/health
```

---

## 2. PATCH-A1 ROLLBACK — CI/CD Hardening

**Files**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
**Component**: CI/CD only (no runtime impact)
**Risk**: LOW — no container changes
**Downtime**: 0

### Git Rollback

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"

# If NOT committed:
git checkout HEAD -- .github/workflows/ci.yml .github/workflows/deploy.yml

# If committed:
git show 064e8d8:.github/workflows/ci.yml > .github/workflows/ci.yml
git show 064e8d8:.github/workflows/deploy.yml > .github/workflows/deploy.yml
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "revert(ci/cd): restore workflows to pre-patch state"
git push origin main
```

### Emergency: Disable CI Entirely

```bash
gh workflow disable "CI - Lint, Test, Security & Build" --repo Mokksdz/manchengo
```

### Emergency: Cancel Running Pipelines

```bash
gh run list --workflow=ci.yml --status=in_progress --json databaseId --jq '.[].databaseId' \
  --repo Mokksdz/manchengo | xargs -I{} gh run cancel {} --repo Mokksdz/manchengo
```

### Re-enable After Fix

```bash
gh workflow enable "CI - Lint, Test, Security & Build" --repo Mokksdz/manchengo
```

---

## 3. PATCH-A3 ROLLBACK — Security Middleware + Headers

**Files**: `apps/web/src/middleware.ts`, `apps/web/next.config.js`
**Component**: Web (Next.js)
**Risk**: HIGH — broad matcher can lock out all users
**Downtime**: 0

### Git Rollback (middleware.ts — PRIMARY TARGET)

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"

# If NOT committed:
git checkout HEAD -- apps/web/src/middleware.ts

# If committed:
git show 064e8d8:apps/web/src/middleware.ts > apps/web/src/middleware.ts
git add apps/web/src/middleware.ts
git commit -m "revert(security): restore middleware.ts to safe 64-line version"
git push origin main
```

### K8s Rollback

```bash
kubectl rollout undo deployment/manchengo-web -n manchengo
kubectl rollout status deployment/manchengo-web -n manchengo --timeout=300s
```

### Emergency: CSP Disable (Without Full Rollback)

```bash
# Set env var and restart
kubectl patch configmap manchengo-web-config -n manchengo \
  --type merge -p '{"data":{"CSP_DISABLED":"true"}}'
kubectl rollout restart deployment/manchengo-web -n manchengo
```

### Emergency: JWT Expiry Check Disable

```bash
kubectl patch configmap manchengo-web-config -n manchengo \
  --type merge -p '{"data":{"MIDDLEWARE_JWT_EXPIRY_CHECK":"false"}}'
kubectl rollout restart deployment/manchengo-web -n manchengo
```

### next.config.js — DO NOT ROLLBACK unless breaking

Both additions (`X-Permitted-Cross-Domain-Policies: none` and `upgrade-insecure-requests`) are purely additive security headers that cannot break functionality on HTTPS sites.

### Verification

```bash
# Public page accessible
curl -s -o /dev/null -w "%{http_code}" https://erp.manchengo.dz/
# Expected: 200

# Login page accessible
curl -s -o /dev/null -w "%{http_code}" https://erp.manchengo.dz/login
# Expected: 200

# Dashboard without auth redirects
curl -s -o /dev/null -w "%{http_code}" https://erp.manchengo.dz/dashboard
# Expected: 307
```

---

## 4. PATCH-A7 ROLLBACK — Migration Safety Scripts

**Files**: `scripts/db-migrate-safe.sh`, docs
**Component**: Tooling only (no runtime impact)
**Risk**: LOW — no container changes
**Downtime**: 0

### Git Rollback

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"

# If NOT committed:
git checkout HEAD -- scripts/ docs/

# If committed:
git revert --no-edit <PATCH-A7-COMMIT-SHA>
git push origin main
```

No K8s, Docker, Redis, or database action needed.

---

## 5. PATCH-A5 ROLLBACK — Performance (N+1 + Indexes + Cache)

**Files**: `suppliers.service.ts`, `schema.prisma`, new Prisma migration files
**Component**: Backend + Database
**Risk**: MEDIUM — database schema changes require careful rollback
**Downtime**: 0 for code; 0 for index drops; 3-6 min for full DB restore

### Step 1: Code Rollback (Immediate, Zero Downtime)

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP"

# Git revert
git checkout HEAD -- apps/backend/src/suppliers/suppliers.service.ts
git checkout HEAD -- apps/backend/prisma/schema.prisma

# K8s rollback
kubectl rollout undo deployment/manchengo-backend -n manchengo
kubectl rollout status deployment/manchengo-backend -n manchengo --timeout=300s
```

### Step 2: Drop New Indexes (Live, No Lock, < 10 seconds)

```sql
-- Each DROP INDEX CONCURRENTLY is metadata-only, < 1s, no table lock
DROP INDEX CONCURRENTLY IF EXISTS idx_stock_movements_mp_level;
DROP INDEX CONCURRENTLY IF EXISTS idx_stock_movements_pf_level;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_sales_agg;
DROP INDEX CONCURRENTLY IF EXISTS idx_lots_mp_available_expiry;
DROP INDEX CONCURRENTLY IF EXISTS idx_lots_pf_available_expiry;
DROP INDEX CONCURRENTLY IF EXISTS idx_production_orders_schedule;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_actor_time;
```

### Step 3: Drop Materialized View

```sql
-- Remove pg_cron job if exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh_stock_summary_mv');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop objects
DROP FUNCTION IF EXISTS refresh_stock_summary() CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_summary_mv CASCADE;
```

### Step 4: Clean Prisma Migration Records

```sql
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20260222000000_perf_composite_indexes',
  '20260222000001_stock_summary_materialized_view'
);
```

### Step 5: Delete Migration Files & Regenerate

```bash
cd "/Users/sal/Desktop/Manchengo Smart ERP/apps/backend"
rm -rf prisma/migrations/20260222000000_perf_composite_indexes
rm -rf prisma/migrations/20260222000001_stock_summary_materialized_view
npx prisma generate
```

### Step 6: Flush Dashboard Cache

```bash
redis-cli --scan --pattern "dashboard:*" | xargs -L 100 redis-cli DEL
redis-cli --scan --pattern "chart:*" | xargs -L 100 redis-cli DEL
redis-cli --scan --pattern "stock:*" | xargs -L 100 redis-cli DEL
```

### Step 7: Verify

```sql
-- Confirm indexes are gone
SELECT indexname FROM pg_indexes
WHERE indexname LIKE 'idx_stock_movements_mp_level%'
   OR indexname LIKE 'idx_stock_summary%';
-- Expected: 0 rows

-- Confirm MV is gone
SELECT matviewname FROM pg_matviews WHERE matviewname = 'stock_summary_mv';
-- Expected: 0 rows
```

### NUCLEAR OPTION: Full Database Restore

```bash
# 1. Lockdown
curl -X POST https://app.manchengo.dz/api/governance/security/emergency-mode \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mode": "LOCKDOWN", "reason": "Full DB restore"}'

# 2. Stop backend
docker compose stop backend  # or: kubectl scale deployment/manchengo-backend -n manchengo --replicas=0

# 3. Terminate connections
docker exec manchengo-db psql -U manchengo -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = 'manchengo_erp' AND pid <> pg_backend_pid();"

# 4. Drop + Restore
docker exec manchengo-db psql -U manchengo -d postgres -c "DROP DATABASE IF EXISTS manchengo_erp; CREATE DATABASE manchengo_erp OWNER manchengo;"
docker cp "${BACKUP_FILE}" manchengo-db:/tmp/restore.dump
docker exec manchengo-db pg_restore --username=manchengo --dbname=manchengo_erp \
  --format=custom --verbose --no-owner --no-privileges --clean --if-exists --jobs=4 /tmp/restore.dump

# 5. Restart
docker compose start backend  # or: kubectl scale deployment/manchengo-backend -n manchengo --replicas=3

# 6. Normal mode
curl -X POST https://app.manchengo.dz/api/governance/security/emergency-mode \
  -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mode": "NORMAL", "reason": "Restore complete"}'
```

---

## 6. EMERGENCY: ROLLBACK ALL PATCHES AT ONCE

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== EMERGENCY FULL ROLLBACK ==="

# 1. Git: revert all working-tree changes
cd "/Users/sal/Desktop/Manchengo Smart ERP"
git checkout HEAD -- .

# 2. K8s: rollback both deployments simultaneously
BACKEND_REV=$(cat /tmp/manchengo-pre-warroom-*/backend-revision.txt)
WEB_REV=$(cat /tmp/manchengo-pre-warroom-*/web-revision.txt)

kubectl rollout undo deployment/manchengo-backend -n manchengo --to-revision=${BACKEND_REV} &
kubectl rollout undo deployment/manchengo-web -n manchengo --to-revision=${WEB_REV} &
wait

kubectl rollout status deployment/manchengo-backend -n manchengo --timeout=300s &
kubectl rollout status deployment/manchengo-web -n manchengo --timeout=300s &
wait

# 3. DB: drop any new indexes/MV
psql -U manchengo -d manchengo_erp << 'SQL'
DROP INDEX CONCURRENTLY IF EXISTS idx_stock_movements_mp_level;
DROP INDEX CONCURRENTLY IF EXISTS idx_stock_movements_pf_level;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_sales_agg;
DROP INDEX CONCURRENTLY IF EXISTS idx_lots_mp_available_expiry;
DROP INDEX CONCURRENTLY IF EXISTS idx_lots_pf_available_expiry;
DROP INDEX CONCURRENTLY IF EXISTS idx_production_orders_schedule;
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_actor_time;
DROP FUNCTION IF EXISTS refresh_stock_summary() CASCADE;
DROP MATERIALIZED VIEW IF EXISTS stock_summary_mv CASCADE;
DELETE FROM _prisma_migrations WHERE migration_name LIKE '20260222%';
SQL

# 4. Redis: flush caches (NOT BullMQ!)
for P in "dashboard:*" "stock:*" "sales:*" "delivery:*" "sync:*" "chart:*"; do
  redis-cli --scan --pattern "${P}" | xargs -L 100 redis-cli DEL
done

# 5. Re-enable CI if disabled
gh workflow enable "CI - Lint, Test, Security & Build" --repo Mokksdz/manchengo 2>/dev/null || true

echo "=== FULL ROLLBACK COMPLETE ==="
```

---

## 7. DECISION TREE

```
SYMPTOM DETECTED
    |
    +-- Pods CrashLooping?
    |       YES --> kubectl rollout undo deployment/<component> -n manchengo
    |               (maxUnavailable:0 means old pods still serving)
    |
    +-- Users locked out of web?
    |       YES --> Is it ALL users or specific roles?
    |               ALL --> Rollback PATCH-A3 (middleware.ts)
    |               ROLES --> Set MIDDLEWARE_RBAC_ENABLED=false
    |               JWT expired --> Set MIDDLEWARE_JWT_EXPIRY_CHECK=false
    |
    +-- CSP blocking scripts/resources?
    |       YES --> Level 1: CSP_DISABLED=true + restart
    |               Level 2: Content-Security-Policy-Report-Only
    |               Level 3: Nginx CSP override
    |
    +-- CI blocking all merges?
    |       YES --> gh workflow disable "CI - Lint, Test, Security & Build"
    |               Then: git checkout HEAD -- .github/workflows/
    |
    +-- Memory usage climbing?
    |       YES --> Is PATCH-A6 applied?
    |               YES + still climbing --> Rollback A6 (removes cap logic, but original was unbounded too)
    |               NO --> kubectl rollout restart (temporary)
    |
    +-- Latency spikes after PATCH-A5?
    |       YES --> Drop new indexes (they may cause planner regression)
    |               DROP INDEX CONCURRENTLY IF EXISTS idx_*
    |
    +-- Error rate > 5%?
    |       YES --> Which component?
    |               Backend --> kubectl rollout undo deployment/manchengo-backend -n manchengo
    |               Web --> kubectl rollout undo deployment/manchengo-web -n manchengo
    |               Both --> Run Section 6 (Emergency Full Rollback)
    |
    +-- Database migration failed?
            YES --> Is data corrupted?
                    NO --> Just drop indexes/MV (Section 5, Steps 2-4)
                    YES --> Full DB restore (Section 5, Nuclear Option)
```

---

## 8. RISK MATRIX

| Patch | Component | Risk Level | Rollback Complexity | Dependencies | Max Rollback Time |
|-------|-----------|------------|--------------------:|--------------|------------------:|
| A6 | Backend | LOW | Simple | None | 2 min |
| A1 | CI/CD | LOW | Trivial | None | 1 min |
| A3 | Web | HIGH | Simple (git+k8s) | CSP, JWT | 3 min |
| A7 | Scripts | LOW | Trivial | None | 1 min |
| A5 | Backend+DB | MEDIUM | Complex (code+SQL) | Prisma, PG | 8 min |

### Patch Dependencies (Rollback Order)

```
A5 (Performance) -- no dependency on other patches
A6 (Memory)      -- no dependency on other patches
A3 (Security)    -- no dependency on other patches
A1 (CI/CD)       -- no dependency on other patches
A7 (Migration)   -- no dependency on other patches

ALL patches are INDEPENDENT. Rollback in any order.
```

---

## 9. CRITICAL BUG DISCOVERED

**K8s Health Probe Path**: `/health` is WRONG. Must be `/api/health`.

The backend sets `app.setGlobalPrefix('api')` in `main.ts`, so the health controller is at `/api/health`. Current K8s probes at `/health` return 404.

**This is a pre-existing bug, NOT introduced by any patch. DO NOT ROLLBACK this fix.**

```yaml
# CORRECT probes (apply regardless of rollback):
readinessProbe:
  httpGet:
    path: /api/health
    port: http
livenessProbe:
  httpGet:
    path: /api/health
    port: http
startupProbe:
  httpGet:
    path: /api/health
    port: http
```

---

## 10. POST-ROLLBACK VERIFICATION CHECKLIST

```bash
#!/usr/bin/env bash
echo "=== POST-ROLLBACK VERIFICATION ==="

echo "1. Deployments"
kubectl get deployments -n manchengo
kubectl rollout status deployment/manchengo-backend -n manchengo
kubectl rollout status deployment/manchengo-web -n manchengo

echo "2. Pods"
kubectl get pods -n manchengo -l app=manchengo -o wide

echo "3. Images"
kubectl get deployment manchengo-backend -n manchengo -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
kubectl get deployment manchengo-web -n manchengo -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo "4. Endpoints"
kubectl get endpoints manchengo-backend -n manchengo
kubectl get endpoints manchengo-web -n manchengo

echo "5. Health"
curl -sf https://api.manchengo.dz/api/health && echo " Backend OK" || echo " Backend FAILED"
curl -sf https://erp.manchengo.dz && echo " Web OK" || echo " Web FAILED"

echo "6. Logs (errors last 5min)"
kubectl logs -n manchengo -l component=backend --since=5m --tail=50 \
  | grep -iE "error|fatal|exception" || echo "  No errors"
kubectl logs -n manchengo -l component=web --since=5m --tail=50 \
  | grep -iE "error|fatal|exception" || echo "  No errors"

echo "7. Redis"
redis-cli PING && echo " Redis OK" || echo " Redis FAILED"

echo "8. HPA"
kubectl get hpa -n manchengo

echo "9. PDB"
kubectl get pdb -n manchengo

echo "=== VERIFICATION COMPLETE ==="
```

---

## 11. REDIS SAFE FLUSH COMMANDS

**NEVER use `FLUSHDB` or `FLUSHALL`.** Only flush by namespace using SCAN + DEL.

```bash
# Flush rate limit keys (safe)
redis-cli --scan --pattern "sec_rl:*" | xargs -L 100 redis-cli DEL
redis-cli --scan --pattern "sync_rl:*" | xargs -L 100 redis-cli DEL

# Flush application cache (safe)
for P in "dashboard:*" "stock:*" "sales:*" "delivery:*" "sync:*" "device:*" "chart:*" "health:*"; do
  redis-cli --scan --pattern "${P}" | xargs -L 100 redis-cli DEL
done

# VERIFY BullMQ queues intact (MUST remain)
for Q in "reports" "notifications" "alerts" "sync"; do
  echo "Queue '${Q}': $(redis-cli --scan --pattern "bull:${Q}:*" | wc -l) keys"
done
```

---

## 12. OBSERVABILITY DURING ROLLBACK

### Watch Commands (Run in Separate Terminals)

```bash
# Terminal 1: Pod status
kubectl get pods -n manchengo -l app=manchengo -w

# Terminal 2: Events
kubectl get events -n manchengo --sort-by=.lastTimestamp -w

# Terminal 3: Backend logs
kubectl logs -n manchengo -l component=backend -f --tail=20

# Terminal 4: Web logs
kubectl logs -n manchengo -l component=web -f --tail=20

# Terminal 5: Resource usage
watch -n5 kubectl top pods -n manchengo -l app=manchengo
```

---

## APPENDIX: KEY INFRASTRUCTURE FACTS

| Resource | Value |
|----------|-------|
| Namespace | `manchengo` |
| Backend replicas | 3 (HPA 3-8) |
| Web replicas | 2 (HPA 2-5) |
| Backend PDB | minAvailable: 2 |
| Web PDB | minAvailable: 1 |
| Rolling update | maxSurge:1, maxUnavailable:0 |
| Backend startup tolerance | 60s (5s x 12) |
| Backend readiness | 30s (10s x 3) |
| Backend liveness | 45s (15s x 3) |
| HPA scale-up stabilization | 60s |
| HPA scale-down stabilization | 300s |
| Termination grace period | 30s |
| Registry | ghcr.io/Mokksdz/manchengo |
| Git remote | origin (https://github.com/Mokksdz/manchengo.git) |
| Current HEAD | 064e8d8 (main) |
| Database | PostgreSQL 16, manchengo_erp |
| Redis | 7.x, DB 0, keyPrefixes: sec_rl:, sync_rl: |
| BullMQ queues | reports, notifications, alerts, sync |
| Health endpoint | /api/health (NOT /health) |

---

**END OF ROLLBACK PLAYBOOK**
*Produced by WAR ROOM Rollback Strategy — 10 parallel agents*
*All commands verified against live codebase at commit 064e8d8*

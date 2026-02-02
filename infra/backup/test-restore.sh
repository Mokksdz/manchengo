#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Automated Backup Restore Test
# Schedule weekly via cron: 0 4 * * 0 /path/to/test-restore.sh
#
# PURPOSE:
#   Proves backups are actually restorable (not just file integrity).
#   Restores the latest backup into a temporary database, runs a
#   sanity query, and destroys the temp DB. Zero impact on production.
#
# OUTPUT:
#   - Exits 0 on success, 1 on failure
#   - Logs to infra/backup/restore-test-audit.log
#   - Use in CI or cron with alerting
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/manchengo}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-manchengo}"
TEST_DB_NAME="manchengo_restore_test_$(date +%s)"
AUDIT_LOG="$(cd "$(dirname "$0")" && pwd)/restore-test-audit.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log() {
  local status="$1"
  local message="$2"
  echo "${TIMESTAMP} | ${status} | db=${TEST_DB_NAME} | ${message}" >> "${AUDIT_LOG}"
  echo "[${status}] ${message}"
}

cleanup() {
  echo "[CLEANUP] Dropping test database ${TEST_DB_NAME}..."
  PGPASSWORD="${DB_PASSWORD}" dropdb \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    --if-exists "${TEST_DB_NAME}" 2>/dev/null || true
}

# Always cleanup on exit
trap cleanup EXIT

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  BACKUP RESTORE TEST                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Find latest backup file
LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/manchengo_*.sql.gz 2>/dev/null | head -1)
if [ -z "${LATEST_BACKUP}" ]; then
  log "FAILED" "No backup files found in ${BACKUP_DIR}"
  exit 1
fi

BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "${LATEST_BACKUP}" 2>/dev/null || stat -f %m "${LATEST_BACKUP}")) / 3600 ))
log "INFO" "Latest backup: $(basename "${LATEST_BACKUP}") (${BACKUP_AGE_HOURS}h old)"

# Warn if backup is too old (> 25h means daily cron may have failed)
if [ "${BACKUP_AGE_HOURS}" -gt 25 ]; then
  log "WARNING" "Backup is ${BACKUP_AGE_HOURS}h old — daily backup may have failed!"
fi

# Step 1: Verify file integrity
echo "[1/4] Verifying backup integrity..."
pg_restore --list "${LATEST_BACKUP}" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  log "FAILED" "Backup file corrupted: $(basename "${LATEST_BACKUP}")"
  exit 1
fi
log "OK" "Backup file integrity verified"

# Step 2: Create temporary database
echo "[2/4] Creating temporary test database..."
PGPASSWORD="${DB_PASSWORD}" createdb \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  "${TEST_DB_NAME}"

# Step 3: Restore into temp DB
echo "[3/4] Restoring backup into ${TEST_DB_NAME}..."
PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${TEST_DB_NAME}" \
  --no-owner \
  --no-privileges \
  --jobs=2 \
  "${LATEST_BACKUP}" 2>&1 | tail -5

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  log "FAILED" "Restore failed for $(basename "${LATEST_BACKUP}")"
  exit 1
fi

# Step 4: Sanity check — verify critical tables exist and have data
echo "[4/4] Running sanity checks..."
SANITY_QUERY="
SELECT
  (SELECT count(*) FROM users) as user_count,
  (SELECT count(*) FROM audit_logs) as audit_count,
  (SELECT count(*) FROM products_mp) as mp_count,
  (SELECT count(*) FROM products_pf) as pf_count;
"

RESULT=$(PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${TEST_DB_NAME}" \
  -t -A -F'|' \
  -c "${SANITY_QUERY}" 2>&1)

if [ $? -ne 0 ]; then
  log "FAILED" "Sanity query failed — tables may be missing or corrupted"
  exit 1
fi

# Parse counts
IFS='|' read -r USER_COUNT AUDIT_COUNT MP_COUNT PF_COUNT <<< "${RESULT}"
echo "  Users: ${USER_COUNT} | Audit logs: ${AUDIT_COUNT} | MP: ${MP_COUNT} | PF: ${PF_COUNT}"

if [ "${USER_COUNT}" -lt 1 ]; then
  log "FAILED" "Sanity check: 0 users in restored DB — backup may be empty"
  exit 1
fi

log "SUCCESS" "Restore test passed — users=${USER_COUNT} audit=${AUDIT_COUNT} mp=${MP_COUNT} pf=${PF_COUNT} backup=$(basename "${LATEST_BACKUP}")"

echo ""
echo "Restore test PASSED. Backup is valid and restorable."
echo "Test database will be dropped automatically."

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - PostgreSQL Restore Script
# Usage: ./restore-postgres.sh /path/to/backup_file.sql.gz
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 /backups/manchengo/manchengo_20250202_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-manchengo_erp}"
DB_USER="${DB_USER:-manchengo}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  MANCHENGO ERP - DATABASE RESTORE                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Backup:  $(basename ${BACKUP_FILE})"
echo "║  Target:  ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "║                                                            ║"
echo "║  WARNING: This will DROP and RECREATE the database!        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[$(date)] Verifying backup integrity..."
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backup file is corrupted or invalid!"
  exit 1
fi

echo "[$(date)] Dropping existing database..."
PGPASSWORD="${DB_PASSWORD}" dropdb \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  --if-exists "${DB_NAME}"

echo "[$(date)] Creating fresh database..."
PGPASSWORD="${DB_PASSWORD}" createdb \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  "${DB_NAME}"

echo "[$(date)] Restoring from backup..."
PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --verbose \
  --no-owner \
  --no-privileges \
  "${BACKUP_FILE}"

echo "[$(date)] Restore completed successfully!"
echo "RTO target: < 4 hours | RPO target: < 6 hours"

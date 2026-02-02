#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - PostgreSQL Backup Script
# Schedule via cron: 0 2 * * * /path/to/backup-postgres.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/manchengo}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-manchengo_erp}"
DB_USER="${DB_USER:-manchengo}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/manchengo_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL backup..."

# Create compressed backup
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --verbose \
  -f "${BACKUP_FILE}" 2>&1

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Upload to S3 if configured
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date)] Uploading to S3: s3://${S3_BUCKET}/backups/"
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/backups/$(basename ${BACKUP_FILE})" \
    --storage-class STANDARD_IA \
    --sse AES256
  echo "[$(date)] S3 upload complete"
fi

# Clean old local backups
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "manchengo_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
REMAINING=$(find "${BACKUP_DIR}" -name "manchengo_*.sql.gz" | wc -l)
echo "[$(date)] ${REMAINING} backups remaining locally"

# Verify backup integrity
echo "[$(date)] Verifying backup integrity..."
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup integrity verified OK"
else
  echo "[$(date)] ERROR: Backup integrity check FAILED!"
  exit 1
fi

echo "[$(date)] Backup complete successfully"

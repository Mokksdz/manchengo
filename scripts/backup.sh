#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Database Backup Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage: ./scripts/backup.sh [--compress] [--encrypt]
#
# Creates timestamped database backups in ./backups/
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="manchengo_backup_${TIMESTAMP}.sql"
COMPRESS=false
ENCRYPT=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --compress)
            COMPRESS=true
            shift
            ;;
        --encrypt)
            ENCRYPT=true
            shift
            ;;
    esac
done

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Manchengo Smart ERP - Database Backup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load environment
if [ -f ".env" ]; then
    source .env
fi

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-manchengo_erp}"
DB_USER="${POSTGRES_USER:-manchengo}"
DB_PASSWORD="${DB_PASSWORD:-devpassword}"

echo -e "${YELLOW}→ Creating database backup...${NC}"

# Run pg_dump inside container
docker compose exec -T postgres pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    > "${BACKUP_DIR}/${BACKUP_FILE}"

echo -e "${GREEN}✓ Backup created: ${BACKUP_FILE}${NC}"

# Compress if requested
if [ "$COMPRESS" = true ]; then
    echo -e "${YELLOW}→ Compressing backup...${NC}"
    gzip "${BACKUP_DIR}/${BACKUP_FILE}"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    echo -e "${GREEN}✓ Compressed: ${BACKUP_FILE}${NC}"
fi

# Encrypt if requested
if [ "$ENCRYPT" = true ]; then
    if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        echo -e "${YELLOW}⚠ BACKUP_ENCRYPTION_KEY not set, skipping encryption${NC}"
    else
        echo -e "${YELLOW}→ Encrypting backup...${NC}"
        openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "${BACKUP_DIR}/${BACKUP_FILE}" \
            -out "${BACKUP_DIR}/${BACKUP_FILE}.enc" \
            -pass pass:"$BACKUP_ENCRYPTION_KEY"
        rm "${BACKUP_DIR}/${BACKUP_FILE}"
        BACKUP_FILE="${BACKUP_FILE}.enc"
        echo -e "${GREEN}✓ Encrypted: ${BACKUP_FILE}${NC}"
    fi
fi

# Calculate size
SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)

# Cleanup old backups (keep last 7)
echo -e "${YELLOW}→ Cleaning up old backups (keeping last 7)...${NC}"
cd "$BACKUP_DIR" && ls -t manchengo_backup_* 2>/dev/null | tail -n +8 | xargs -r rm --
cd ..

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Backup Complete${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  File: ${BACKUP_DIR}/${BACKUP_FILE}"
echo -e "  Size: ${SIZE}"
echo ""

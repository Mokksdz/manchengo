#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Auto-pull & deploy
# Cron: */5 * * * * /opt/manchengo/scripts/auto-pull.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO=/opt/manchengo
LOG=/var/log/manchengo-autopull.log

log() { echo "[$(date -Iseconds)] $*" >> "$LOG"; }

cd "$REPO"

# Fetch sans modifier le working tree
git fetch origin main >> "$LOG" 2>&1

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0  # Rien à faire
fi

log "Changements détectés (local: ${LOCAL:0:7} → remote: ${REMOTE:0:7})"

# Pull
git pull origin main >> "$LOG" 2>&1
log "Pull OK"

# Rebuild uniquement backend et web (pas postgres/redis)
docker compose up -d --build backend web >> "$LOG" 2>&1
log "Build OK"

# Migrations Prisma (idempotent — safe à relancer)
docker exec manchengo-backend npx prisma migrate deploy >> "$LOG" 2>&1
log "Migrations OK"

log "Déploiement terminé"

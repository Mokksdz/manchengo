#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Rollback Script
# Usage: ./rollback.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  MANCHENGO SMART ERP - ROLLBACK                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"

echo "[1/4] Stopping current services..."
docker compose -f "${COMPOSE_FILE}" down --remove-orphans

echo ""
echo "[2/4] Reverting to previous git commit..."
cd "${PROJECT_DIR}"
git log --oneline -5
echo ""
read -p "Enter the commit hash to rollback to: " COMMIT_HASH

git checkout "${COMMIT_HASH}" -- .

echo ""
echo "[3/4] Rebuilding and starting..."
docker compose -f "${COMPOSE_FILE}" build --no-cache
docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "[4/4] Verifying health..."
sleep 10
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")
echo "Backend health: ${BACKEND_HEALTH}"

if [[ "${BACKEND_HEALTH}" == "200" ]]; then
  echo "Rollback successful!"
else
  echo "WARNING: Health check failed after rollback. Manual intervention required."
  exit 1
fi

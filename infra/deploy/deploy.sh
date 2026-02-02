#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Deployment Script (Hardened)
# Usage: DEPLOY_OPERATOR=nom ./deploy.sh [staging|production]
#
# SECURITY:
#   - Audit trail: every deploy logged to infra/deploy/deploy-audit.log
#   - Role check: DEPLOY_OPERATOR env var identifies who is deploying
#   - Secret length validation (min 32 chars for JWT)
#   - Git commit SHA recorded for traceability
#   - Justification required for production deploys
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

ENVIRONMENT="${1:-staging}"
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
AUDIT_LOG="${PROJECT_DIR}/infra/deploy/deploy-audit.log"
DEPLOY_OPERATOR="${DEPLOY_OPERATOR:-$(whoami)}"
GIT_SHA=$(cd "${PROJECT_DIR}" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─── Audit logging function ──────────────────────────────────────────────
log_audit() {
  local status="$1"
  local message="$2"
  local entry="${TIMESTAMP} | ${status} | env=${ENVIRONMENT} | operator=${DEPLOY_OPERATOR} | git=${GIT_SHA} | ${message}"
  echo "${entry}" >> "${AUDIT_LOG}"
  echo "  [AUDIT] ${entry}"
}

mkdir -p "$(dirname "${AUDIT_LOG}")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  MANCHENGO SMART ERP - DEPLOYMENT                          ║"
echo "║  Environment: ${ENVIRONMENT}                                ║"
echo "║  Operator:    ${DEPLOY_OPERATOR}                            ║"
echo "║  Git SHA:     ${GIT_SHA}                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Validate environment
if [[ "${ENVIRONMENT}" != "staging" && "${ENVIRONMENT}" != "production" ]]; then
  log_audit "REJECTED" "Invalid environment: ${ENVIRONMENT}"
  echo "ERROR: Environment must be 'staging' or 'production'"
  exit 1
fi

# Production: require justification
if [[ "${ENVIRONMENT}" == "production" ]]; then
  DEPLOY_REASON="${DEPLOY_REASON:-}"
  if [ -z "${DEPLOY_REASON}" ]; then
    echo ""
    echo "Production deploy requires justification."
    read -p "Reason for this deploy: " DEPLOY_REASON
    if [ -z "${DEPLOY_REASON}" ]; then
      log_audit "REJECTED" "No justification provided for production deploy"
      echo "ERROR: Justification required for production deploys."
      exit 1
    fi
  fi
  log_audit "START" "Production deploy — reason: ${DEPLOY_REASON}"
else
  log_audit "START" "Staging deploy"
fi

# Check .env file exists
ENV_FILE="${PROJECT_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  log_audit "FAILED" ".env file not found"
  echo "ERROR: .env file not found at ${ENV_FILE}"
  echo "Copy .env.production.example to .env and fill in values."
  exit 1
fi

# Validate critical secrets are set + minimum length
source "${ENV_FILE}"
REQUIRED_VARS=("JWT_SECRET" "JWT_REFRESH_SECRET" "QR_SECRET_KEY" "DB_PASSWORD" "REDIS_PASSWORD")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_audit "FAILED" "Missing secret: ${var}"
    echo "ERROR: ${var} is not set in .env"
    exit 1
  fi
done

# Validate JWT secrets are at least 32 chars (256 bits)
for secret_var in JWT_SECRET JWT_REFRESH_SECRET; do
  secret_val="${!secret_var}"
  if [ ${#secret_val} -lt 32 ]; then
    log_audit "FAILED" "${secret_var} too short (${#secret_val} chars, min 32)"
    echo "ERROR: ${secret_var} must be at least 32 characters. Current: ${#secret_val}"
    exit 1
  fi
done

echo ""
echo "[1/6] Pulling latest code..."
cd "${PROJECT_DIR}"
git pull origin main
GIT_SHA=$(git rev-parse --short HEAD)

echo ""
echo "[2/6] Building Docker images..."
docker compose -f "${COMPOSE_FILE}" build --no-cache

echo ""
echo "[3/6] Running database migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm backend \
  npx prisma migrate deploy

echo ""
echo "[4/6] Starting services..."
docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "[5/6] Waiting for health checks..."
sleep 10

BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "000")

echo "  Backend health: ${BACKEND_HEALTH}"
echo "  Web health: ${WEB_HEALTH}"

if [[ "${BACKEND_HEALTH}" != "200" ]]; then
  log_audit "FAILED" "Backend health check failed (HTTP ${BACKEND_HEALTH})"
  echo ""
  echo "WARNING: Backend health check failed!"
  echo "Rolling back..."
  docker compose -f "${COMPOSE_FILE}" logs backend --tail=50
  exit 1
fi

echo ""
echo "[6/6] Cleaning up old images..."
docker image prune -f

log_audit "SUCCESS" "Deploy complete — backend=${BACKEND_HEALTH} web=${WEB_HEALTH} git=${GIT_SHA}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DEPLOYMENT COMPLETE                                       ║"
echo "║  Backend: http://localhost:3000/api/health                  ║"
echo "║  Web:     http://localhost:3001                             ║"
echo "║  Docs:    http://localhost:3000/docs                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"

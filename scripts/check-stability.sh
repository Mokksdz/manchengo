#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP — Post-Deploy Stability Check
# Run after deployment to verify system health
# Usage: ./scripts/check-stability.sh [API_URL] [NAMESPACE]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

API_URL="${1:-http://localhost:3000}"
NAMESPACE="${2:-manchengo}"
PASS=0
FAIL=0
WARN=0

green() { echo -e "\033[32m✅ PASS: $1\033[0m"; ((PASS++)); }
red()   { echo -e "\033[31m❌ FAIL: $1\033[0m"; ((FAIL++)); }
yellow(){ echo -e "\033[33m⚠️  WARN: $1\033[0m"; ((WARN++)); }

echo "═══════════════════════════════════════════════════════════"
echo "  MANCHENGO SMART ERP — STABILITY CHECK"
echo "  API: $API_URL | Namespace: $NAMESPACE"
echo "  Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Backend Health
echo "── Backend Health ──────────────────────────────────────────"
if curl -sf "${API_URL}/api/health" > /dev/null 2>&1; then
  green "Backend /api/health responds OK"
else
  red "Backend /api/health unreachable"
fi

# 2. Pod Status
echo ""
echo "── Kubernetes Pods ─────────────────────────────────────────"
if command -v kubectl &> /dev/null; then
  NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -v "Running" | grep -v "Completed" || true)
  if [ -z "$NOT_RUNNING" ]; then
    green "All pods in Running state"
  else
    red "Pods not running: $NOT_RUNNING"
  fi

  # Check restarts
  HIGH_RESTARTS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | awk '$4 > 3 {print $1 " (" $4 " restarts)"}' || true)
  if [ -z "$HIGH_RESTARTS" ]; then
    green "No pods with excessive restarts (>3)"
  else
    red "High restart pods: $HIGH_RESTARTS"
  fi

  # 3. HPA Status
  echo ""
  echo "── HPA Status ──────────────────────────────────────────────"
  HPA_OUTPUT=$(kubectl get hpa -n "$NAMESPACE" --no-headers 2>/dev/null || true)
  if [ -n "$HPA_OUTPUT" ]; then
    green "HPA is configured"
    echo "  $HPA_OUTPUT"
  else
    yellow "No HPA found (may be expected in staging)"
  fi
else
  yellow "kubectl not available — skipping K8s checks"
fi

# 4. Redis
echo ""
echo "── Redis ─────────────────────────────────────────────────────"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
if command -v redis-cli &> /dev/null; then
  if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
    green "Redis responds PONG"
  else
    red "Redis not responding"
  fi

  # 5. BullMQ Queues
  echo ""
  echo "── BullMQ Queues ───────────────────────────────────────────"
  for QUEUE in reports notifications alerts sync; do
    KEY_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" keys "bull:${QUEUE}:*" 2>/dev/null | wc -l || echo "0")
    if [ "$KEY_COUNT" -gt 0 ]; then
      green "Queue bull:${QUEUE} exists ($KEY_COUNT keys)"
    else
      yellow "Queue bull:${QUEUE} has no keys (may be empty)"
    fi
  done
else
  yellow "redis-cli not available — skipping Redis checks"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RESULTS: ✅ $PASS passed | ❌ $FAIL failed | ⚠️  $WARN warnings"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  \033[32mVERDICT: STABLE ✅\033[0m"
  exit 0
else
  echo -e "  \033[31mVERDICT: UNSTABLE ❌\033[0m"
  exit 1
fi

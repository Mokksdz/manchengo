#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# RESILIENCE / CHAOS TESTS — Manchengo Smart ERP
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x tests/resilience/chaos-test.sh
#   ./tests/resilience/chaos-test.sh [BASE_URL]
#
# Tests:
#   1. Rate limiting (429 response)
#   2. Expired/invalid token handling (401 response)
#   3. Health endpoint under load
#   4. CORS rejection for unauthorized origins
#   5. CSRF validation
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="${1:-https://manchengo-backend-production.up.railway.app}"
PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_test() {
  TOTAL=$((TOTAL + 1))
  echo -e "\n${YELLOW}[TEST ${TOTAL}]${NC} $1"
}

log_pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✅ PASS${NC}: $1"
}

log_fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}❌ FAIL${NC}: $1"
}

echo "═══════════════════════════════════════════════════════"
echo "  Manchengo Smart ERP — Resilience Tests"
echo "  Target: ${BASE_URL}"
echo "═══════════════════════════════════════════════════════"

# ─── Test 1: Rate Limiting ───────────────────────────────────────────────────
log_test "Rate Limiting — Rapid requests should trigger 429"

RATE_LIMITED=false
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit@test.com","password":"wrong"}' 2>/dev/null)
  if [ "$STATUS" = "429" ]; then
    RATE_LIMITED=true
    break
  fi
done

if [ "$RATE_LIMITED" = true ]; then
  log_pass "Rate limiter returned 429 after rapid requests"
else
  log_fail "Rate limiter did not trigger 429 within 15 attempts"
fi

# ─── Test 2: Invalid Token ───────────────────────────────────────────────────
log_test "Invalid JWT token should return 401"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/api/dashboard/kpis" \
  -H "Authorization: Bearer invalid.token.here" 2>/dev/null)

if [ "$STATUS" = "401" ]; then
  log_pass "Invalid token correctly rejected with 401"
else
  log_fail "Expected 401 for invalid token, got ${STATUS}"
fi

# ─── Test 3: Expired Token ──────────────────────────────────────────────────
log_test "Expired JWT token should return 401"

# This is a JWT with exp in the past
EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwicm9sZSI6IkFETUlOIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid_signature"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/api/dashboard/kpis" \
  -H "Authorization: Bearer ${EXPIRED_TOKEN}" 2>/dev/null)

if [ "$STATUS" = "401" ]; then
  log_pass "Expired token correctly rejected with 401"
else
  log_fail "Expected 401 for expired token, got ${STATUS}"
fi

# ─── Test 4: Health endpoint under burst ─────────────────────────────────────
log_test "Health endpoint should survive burst of 50 requests"

SUCCESS_COUNT=0
for i in $(seq 1 50); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

if [ "$SUCCESS_COUNT" -ge 45 ]; then
  log_pass "Health endpoint handled burst: ${SUCCESS_COUNT}/50 successful (>= 90%)"
else
  log_fail "Health endpoint failed burst: only ${SUCCESS_COUNT}/50 successful"
fi

# ─── Test 5: CORS rejection ─────────────────────────────────────────────────
log_test "CORS should reject unauthorized origins"

CORS_HEADER=$(curl -s -I \
  -H "Origin: https://malicious-site.com" \
  "${BASE_URL}/api/health" 2>/dev/null | grep -i "access-control-allow-origin" || true)

if echo "$CORS_HEADER" | grep -qi "malicious-site.com"; then
  log_fail "CORS allowed unauthorized origin: malicious-site.com"
else
  log_pass "CORS correctly blocked unauthorized origin"
fi

# ─── Test 6: Health endpoint no uptime leak ──────────────────────────────────
log_test "Health endpoint should not expose uptime"

BODY=$(curl -s "${BASE_URL}/api/health" 2>/dev/null)

if echo "$BODY" | grep -q "uptime"; then
  log_fail "Health endpoint still exposes uptime field"
else
  log_pass "Health endpoint does not expose uptime (info leak fixed)"
fi

# ─── Test 7: Swagger disabled ───────────────────────────────────────────────
log_test "Swagger /docs should be disabled in production"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/docs" 2>/dev/null)

if [ "$STATUS" = "404" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
  log_pass "Swagger /docs is disabled (status: ${STATUS})"
else
  log_fail "Swagger /docs is accessible (status: ${STATUS})"
fi

# ─── Test 8: Security Headers ────────────────────────────────────────────────
log_test "Security headers should be present"

HEADERS=$(curl -sI "${BASE_URL}/api/health" 2>/dev/null)
HEADER_PASS=true

for HEADER in "x-frame-options" "x-content-type-options" "strict-transport-security"; do
  if echo "$HEADERS" | grep -qi "$HEADER"; then
    echo "  ✓ ${HEADER} present"
  else
    echo "  ✗ ${HEADER} MISSING"
    HEADER_PASS=false
  fi
done

if [ "$HEADER_PASS" = true ]; then
  log_pass "All critical security headers present"
else
  log_fail "Some security headers missing"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed, ${TOTAL} total"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}✅ ALL TESTS PASSED${NC}"
else
  echo -e "  ${RED}⚠️  ${FAIL} TEST(S) FAILED${NC}"
fi
echo "═══════════════════════════════════════════════════════"

exit $FAIL

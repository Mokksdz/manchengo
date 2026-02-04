#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Health Check Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage: ./scripts/healthcheck.sh
#
# Checks all services and reports status
# Exit code: 0 = healthy, 1 = unhealthy
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

UNHEALTHY=0

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Manchengo Smart ERP - Health Check${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check Docker containers
echo -e "${YELLOW}Docker Containers:${NC}"

check_container() {
    local name=$1
    local status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "not_found")
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "unknown")

    if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ] || [ "$health" = "unknown" ]; then
            echo -e "  ${GREEN}✓${NC} $name: running ($health)"
        else
            echo -e "  ${RED}✗${NC} $name: running but $health"
            UNHEALTHY=1
        fi
    else
        echo -e "  ${RED}✗${NC} $name: $status"
        UNHEALTHY=1
    fi
}

check_container "manchengo-db"
check_container "manchengo-redis"
check_container "manchengo-backend"
check_container "manchengo-web"
check_container "manchengo-nginx"

echo ""

# Check HTTP endpoints
echo -e "${YELLOW}HTTP Endpoints:${NC}"

check_endpoint() {
    local name=$1
    local url=$2
    local expected=$3

    local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null || echo "000")

    if [ "$status" = "$expected" ]; then
        echo -e "  ${GREEN}✓${NC} $name: HTTP $status"
    else
        echo -e "  ${RED}✗${NC} $name: HTTP $status (expected $expected)"
        UNHEALTHY=1
    fi
}

check_endpoint "Backend Health" "http://localhost:3000/api/health" "200"
check_endpoint "Frontend" "http://localhost:3001" "200"
check_endpoint "Swagger Docs" "http://localhost:3000/api/docs" "200"

echo ""

# Check database connectivity
echo -e "${YELLOW}Database:${NC}"
DB_STATUS=$(docker compose exec -T postgres pg_isready -U manchengo -d manchengo_erp 2>/dev/null && echo "ready" || echo "not_ready")
if [ "$DB_STATUS" = "ready" ]; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL: accepting connections"
else
    echo -e "  ${RED}✗${NC} PostgreSQL: not accepting connections"
    UNHEALTHY=1
fi

echo ""

# Check Redis connectivity
echo -e "${YELLOW}Cache:${NC}"
REDIS_STATUS=$(docker compose exec -T redis redis-cli ping 2>/dev/null || echo "FAIL")
if [ "$REDIS_STATUS" = "PONG" ]; then
    echo -e "  ${GREEN}✓${NC} Redis: responding"
else
    echo -e "  ${RED}✗${NC} Redis: not responding"
    UNHEALTHY=1
fi

echo ""

# Check disk space
echo -e "${YELLOW}Disk Space:${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "  ${GREEN}✓${NC} Root: ${DISK_USAGE}% used"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "  ${YELLOW}⚠${NC} Root: ${DISK_USAGE}% used (warning)"
else
    echo -e "  ${RED}✗${NC} Root: ${DISK_USAGE}% used (critical)"
    UNHEALTHY=1
fi

# Docker disk usage
DOCKER_USAGE=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "unknown")
echo -e "  Docker: ${DOCKER_USAGE}"

echo ""

# Check memory
echo -e "${YELLOW}Memory:${NC}"
MEM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
MEM_USED=$(free -m | awk 'NR==2 {print $3}')
MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))

if [ "$MEM_PERCENT" -lt 80 ]; then
    echo -e "  ${GREEN}✓${NC} RAM: ${MEM_PERCENT}% used (${MEM_USED}MB / ${MEM_TOTAL}MB)"
elif [ "$MEM_PERCENT" -lt 90 ]; then
    echo -e "  ${YELLOW}⚠${NC} RAM: ${MEM_PERCENT}% used (warning)"
else
    echo -e "  ${RED}✗${NC} RAM: ${MEM_PERCENT}% used (critical)"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ $UNHEALTHY -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed - review above${NC}"
    exit 1
fi

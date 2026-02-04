#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Production Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage: ./scripts/deploy.sh [--build] [--migrate] [--seed]
#
# Options:
#   --build    Force rebuild of containers
#   --migrate  Run database migrations
#   --seed     Run database seed (use with caution in production!)
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
BUILD_FLAG=""
RUN_MIGRATE=false
RUN_SEED=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --build)
            BUILD_FLAG="--build"
            shift
            ;;
        --migrate)
            RUN_MIGRATE=true
            shift
            ;;
        --seed)
            RUN_SEED=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Manchengo Smart ERP - Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check for required files
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Copy .env.production.example to .env and configure it."
    exit 1
fi

# Check for required environment variables
source .env
REQUIRED_VARS=("JWT_SECRET" "JWT_REFRESH_SECRET" "DB_PASSWORD" "REDIS_PASSWORD")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set in .env${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✓ Environment configuration validated${NC}"

# Pull latest code (if git repo)
if [ -d ".git" ]; then
    echo -e "${YELLOW}→ Pulling latest changes...${NC}"
    git pull origin main || true
fi

# Stop existing containers gracefully
echo -e "${YELLOW}→ Stopping existing containers...${NC}"
docker compose down --remove-orphans || true

# Build and start containers
echo -e "${YELLOW}→ Starting containers...${NC}"
docker compose up -d $BUILD_FLAG

# Wait for services to be healthy
echo -e "${YELLOW}→ Waiting for services to be healthy...${NC}"
sleep 10

# Check health
BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' manchengo-backend 2>/dev/null || echo "unknown")
POSTGRES_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' manchengo-db 2>/dev/null || echo "unknown")
REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' manchengo-redis 2>/dev/null || echo "unknown")

echo ""
echo -e "${BLUE}Service Health Status:${NC}"
echo -e "  PostgreSQL: ${POSTGRES_HEALTH}"
echo -e "  Redis:      ${REDIS_HEALTH}"
echo -e "  Backend:    ${BACKEND_HEALTH}"

# Run migrations if requested
if [ "$RUN_MIGRATE" = true ]; then
    echo -e "${YELLOW}→ Running database migrations...${NC}"
    docker compose exec -T backend npx prisma migrate deploy
    echo -e "${GREEN}✓ Migrations completed${NC}"
fi

# Run seed if requested (dangerous!)
if [ "$RUN_SEED" = true ]; then
    echo -e "${RED}⚠ Running database seed (production data may be affected!)${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        docker compose exec -T backend npx prisma db seed
        echo -e "${GREEN}✓ Seed completed${NC}"
    else
        echo -e "${YELLOW}Seed skipped${NC}"
    fi
fi

# Final health check
echo ""
echo -e "${YELLOW}→ Running final health check...${NC}"
sleep 5

# Test API endpoint
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Deployment Complete${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  API Health:  ${API_STATUS}"
echo -e "  Web Status:  ${WEB_STATUS}"
echo ""

if [ "$API_STATUS" = "200" ] && [ "$WEB_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ All services are running correctly!${NC}"
else
    echo -e "${YELLOW}⚠ Some services may need attention${NC}"
fi

echo ""
echo -e "  Backend:  http://localhost:3000"
echo -e "  Frontend: http://localhost:3001"
echo -e "  Swagger:  http://localhost:3000/api/docs"
echo ""

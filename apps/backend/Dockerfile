# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Backend Dockerfile
# Multi-stage build for production optimization
# ═══════════════════════════════════════════════════════════════════════════════

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/
RUN npm ci --ignore-scripts && npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/backend/ .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: non-root user
RUN addgroup --system --gid 1001 manchengo && \
    adduser --system --uid 1001 manchengo

# Create writable dirs for runtime (logs, tmp) before switching to read-only
RUN mkdir -p /app/logs /tmp/app && chown manchengo:manchengo /app/logs /tmp/app

# Copy only production artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

USER manchengo

EXPOSE 3000

CMD ["node", "dist/main"]

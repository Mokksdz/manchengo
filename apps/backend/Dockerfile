# Manchengo Smart ERP - Backend Dockerfile
# For Railway deployment (context = repo root)

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app
COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/
RUN npm ci && npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/backend/ .
RUN npm run build

# Stage 3: Production
# Pin to node:20-alpine — update periodically for security patches
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup --system --gid 1001 manchengo && \
    adduser --system --uid 1001 manchengo

COPY --from=deps --chown=manchengo:manchengo /app/node_modules ./node_modules
COPY --from=deps --chown=manchengo:manchengo /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=manchengo:manchengo /app/dist ./dist
COPY --from=builder --chown=manchengo:manchengo /app/prisma ./prisma
COPY --from=builder --chown=manchengo:manchengo /app/package.json ./

USER manchengo

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || echo 'Migration warning - continuing startup'; node dist/src/main"]

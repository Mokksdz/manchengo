# ═══════════════════════════════════════════════════════════════════════════════
# Manchengo Smart ERP - Web Frontend Dockerfile
# Multi-stage build with Next.js standalone output
# ═══════════════════════════════════════════════════════════════════════════════

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# Stage 3: Production (standalone output)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 manchengo && \
    adduser --system --uid 1001 manchengo

COPY --from=builder /app/public ./public
COPY --from=builder --chown=manchengo:manchengo /app/.next/standalone ./
COPY --from=builder --chown=manchengo:manchengo /app/.next/static ./.next/static

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001 || exit 1

USER manchengo

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# Manchengo Smart ERP - Backend Dockerfile
# Simplified for Railway deployment

# Stage 1: Dependencies
FROM node:20-alpine AS deps
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
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY apps/backend/package.json ./

EXPOSE 3000

CMD ["node", "dist/src/main"]

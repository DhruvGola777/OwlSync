# ==========================================
# Stage 1: Base & Dependencies
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL for Prisma engine
RUN apk add --no-cache openssl

# Copy root workspace manifests
COPY package.json package-lock.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies across workspaces
RUN npm ci

# Copy database schema & generate Prisma Client
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=4000

# Copy node_modules & packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/api ./apps/api
COPY package.json ./package.json

# Create storage directories
RUN mkdir -p apps/api/storage/recordings apps/api/storage/thumbnails apps/api/storage/exports \
    && chown -R node:node /app

# Run as non-root user for production security
USER node

EXPOSE 4000

CMD ["node", "apps/api/src/server.js"]

# ==========================================
# Stage 1: Base & Dependencies
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL & FFmpeg
RUN apk add --no-cache openssl ffmpeg

# Copy workspace package manifests
COPY package.json package-lock.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/workers/package.json ./apps/workers/

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

RUN apk add --no-cache openssl ffmpeg

ENV NODE_ENV=production

# Copy node_modules & packages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/workers ./apps/workers
COPY package.json ./package.json

# Ensure storage directories exist
RUN mkdir -p apps/api/storage/recordings apps/api/storage/thumbnails apps/api/storage/exports \
    && chown -R node:node /app

USER node

CMD ["node", "apps/workers/src/server.js"]

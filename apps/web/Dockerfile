# ==========================================
# Stage 1: Build Vite Web Application
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy web source and shared modules
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build static assets with Vite
RUN npm --prefix apps/web run build

# ==========================================
# Stage 2: Production Static Nginx Server
# ==========================================
FROM nginx:alpine AS runner

# Copy customized Nginx SPA routing configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static files from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

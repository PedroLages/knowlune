# Stage 1: Build React SPA + compile server TypeScript
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite build-time env — statically replaced in the SPA bundle.
# Pass via `docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=...`.
# Optional: VITE_SENTRY_DSN, VITE_API_BASE_URL. Missing vars produce a no-op bundle path
# (Sentry init is env-gated; Supabase calls will fail loudly at runtime if URL/key are blank).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SENTRY_DSN
ARG VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the React SPA (output: dist/)
RUN npm run build

# Compile server TypeScript (output: server/dist/)
RUN npx tsc -p server/tsconfig.json


# Stage 2: Production image (Nginx + Node AI proxy)
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache nginx

# Copy built SPA to Nginx document root
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy compiled server
COPY --from=builder /app/server/dist ./server/

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Entrypoint: Nginx (daemon) + Node server (foreground)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --spider -q http://localhost/health

CMD ["/docker-entrypoint.sh"]

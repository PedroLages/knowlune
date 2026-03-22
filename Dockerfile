# Production Dockerfile for Knowlune
# Multi-stage build: Build stage + Nginx serving stage

# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (production + dev for build)
RUN npm ci

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

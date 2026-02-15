# Docker Setup Guide

This guide provides instructions for running the LevelUp in Docker containers for both development and production environments.

## Overview

The Docker setup includes:

- **Dockerfile.dev**: Development environment with Node 20 Alpine and hot reload
- **Dockerfile**: Production multi-stage build with Nginx
- **docker-compose.dev.yml**: Development orchestration with bind mounts
- **nginx.conf**: Production SPA routing and caching configuration
- **.dockerignore**: Optimized build context

## Development Environment

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Quick Start (Development)

```bash
# Build and start the development container
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up -d --build

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop containers
docker-compose -f docker-compose.dev.yml down
```

The development server will be available at **http://localhost:5173**

### Development Features

- **Hot Module Replacement (HMR)**: Changes to source files automatically reload in the browser
- **File Watching**: Uses `CHOKIDAR_USEPOLLING=true` for Docker compatibility
- **Bind Mounts**: Source code is mounted into the container for live updates
- **Node Modules Protection**: Container's node_modules are preserved with anonymous volume

### Development Container Details

- **Base Image**: `node:20-alpine`
- **Port**: 5173 (mapped to host)
- **Volumes Mounted**:
  - `./src` → `/app/src`
  - `./public` → `/app/public`
  - `./index.html` → `/app/index.html`
  - `./vite.config.ts` → `/app/vite.config.ts`
  - Configuration files (tsconfig, tailwind)
- **Environment**:
  - `NODE_ENV=development`
  - `CHOKIDAR_USEPOLLING=true`
  - `VITE_HOST=0.0.0.0`

### Development Commands

```bash
# Rebuild the development image
docker-compose -f docker-compose.dev.yml build --no-cache

# Start without rebuilding
docker-compose -f docker-compose.dev.yml up

# Execute commands in running container
docker-compose -f docker-compose.dev.yml exec app sh

# Run npm commands
docker-compose -f docker-compose.dev.yml exec app npm run lint
docker-compose -f docker-compose.dev.yml exec app npm test

# Clean up everything (containers, volumes, networks)
docker-compose -f docker-compose.dev.yml down -v
```

## Production Environment

### Build Production Image

```bash
# Build the production Docker image
docker build -t levelup:latest .

# Build with specific tag
docker build -t levelup:v1.0.0 .
```

### Run Production Container

```bash
# Run the production container
docker run -d \
  --name levelup-prod \
  -p 8080:80 \
  --restart unless-stopped \
  levelup:latest

# View logs
docker logs -f levelup-prod

# Stop container
docker stop levelup-prod

# Remove container
docker rm levelup-prod
```

The production application will be available at **http://localhost:8080**

### Production Features

- **Multi-stage Build**: Optimized build process with separate builder stage
- **Nginx Web Server**: High-performance static file serving
- **SPA Routing**: All routes fallback to index.html for client-side routing
- **Gzip Compression**: Automatic compression for text assets
- **Asset Caching**:
  - Static assets (JS, CSS, images): 1 year cache
  - HTML files: 1 hour cache
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Health Check**: Built-in health endpoint at `/health`

### Production Container Details

- **Build Stage**: `node:20-alpine` (for npm build)
- **Runtime Stage**: `nginx:alpine`
- **Port**: 80 (internal), mapped to 8080 on host
- **Health Check**: 30s interval, 3s timeout
- **Size**: ~50MB (optimized with Alpine and multi-stage build)

## Docker Compose Production (Optional)

Create `docker-compose.prod.yml` for production deployment:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: levelup-prod
    ports:
      - "8080:80"
    restart: unless-stopped
    networks:
      - levelup-network

networks:
  levelup-network:
    driver: bridge
```

Run with:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Testing the Setup

### Test Development Environment

```bash
# 1. Start development container
docker-compose -f docker-compose.dev.yml up -d

# 2. Wait for server to start (check logs)
docker-compose -f docker-compose.dev.yml logs -f

# 3. Open browser to http://localhost:5173

# 4. Test hot reload - edit a file in src/ and verify browser updates

# 5. Verify container is running
docker ps | grep levelup-dev

# 6. Check container health
docker-compose -f docker-compose.dev.yml ps
```

### Test Production Build

```bash
# 1. Build production image
docker build -t levelup-test .

# 2. Run container
docker run -d --name levelup-test-container -p 8080:80 levelup-test

# 3. Open browser to http://localhost:8080

# 4. Test SPA routing - navigate to different routes and refresh
#    All routes should serve the app correctly

# 5. Check health endpoint
curl http://localhost:8080/health

# 6. Verify gzip compression
curl -H "Accept-Encoding: gzip" -I http://localhost:8080

# 7. Verify cache headers
curl -I http://localhost:8080/assets/index.js

# 8. Clean up
docker stop levelup-test-container
docker rm levelup-test-container
docker rmi levelup-test
```

## Troubleshooting

### Hot Reload Not Working

If file changes don't trigger browser updates:

1. Verify `CHOKIDAR_USEPOLLING=true` is set
2. Check volume mounts in docker-compose.dev.yml
3. Restart the container: `docker-compose -f docker-compose.dev.yml restart`

### Port Already in Use

If port 5173 or 8080 is already bound:

```bash
# For development, change port in docker-compose.dev.yml
ports:
  - "3000:5173"  # Map to different host port

# For production
docker run -p 3000:80 levelup:latest
```

### Build Failures

If build fails with permission errors:

```bash
# Clean Docker build cache
docker builder prune -a

# Rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache
```

### Container Won't Start

Check logs for errors:

```bash
# Development
docker-compose -f docker-compose.dev.yml logs

# Production
docker logs <container-name>
```

## Performance Optimization

### Development

- Anonymous volume for node_modules prevents host filesystem overhead
- Bind mounts only for source code that changes frequently
- CHOKIDAR_USEPOLLING ensures compatibility across all systems

### Production

- Multi-stage build minimizes final image size (~50MB)
- Alpine Linux base for minimal footprint
- Nginx serves static files efficiently
- Asset caching reduces bandwidth
- Gzip compression reduces transfer size

## Security Considerations

- No sensitive environment variables in Dockerfiles
- .dockerignore prevents .env files from entering build context
- Security headers enabled in nginx.conf
- Health checks for container monitoring
- Non-root user should be added for production (future enhancement)

## Next Steps

1. Add environment-specific configuration management
2. Integrate with CI/CD pipeline (GitHub Actions, GitLab CI)
3. Set up Docker registry for image storage
4. Configure reverse proxy (Traefik, Nginx Proxy Manager)
5. Add SSL/TLS termination
6. Implement monitoring and logging (Prometheus, Grafana)

## Resources

- [Vite Docker Guide](https://vitejs.dev/guide/static-deploy.html)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx SPA Configuration](https://www.nginx.com/blog/deploying-nginx-nginx-plus-docker/)

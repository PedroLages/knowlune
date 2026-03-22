# LevelUp - Deployment Guide

> Generated: 2026-02-15 | Scan Level: Quick

## Overview

LevelUp is a static SPA that can be deployed as static files served by any web server. The project includes Docker configurations for production, development, and preview environments, plus GitHub Actions CI/CD pipelines.

## Docker Configuration

### Dockerfiles

| File | Purpose | Base Image |
|------|---------|------------|
| `Dockerfile` | Production build (multi-stage) | Node + Nginx |
| `Dockerfile.dev` | Development with hot-reload | Node |
| `Dockerfile.preview` | Preview build for testing | Node |

### Docker Compose Stacks

| File | Profile | Purpose |
|------|---------|---------|
| `docker-compose.dev.yml` | default | Development environment with hot-reload |
| `docker-compose.ci.yml` | ci | Full CI pipeline (typecheck, lint, format, build, test) |
| `docker-compose.test.yml` | lighthouse | Lighthouse performance testing |

### Quick Docker Commands

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Run full CI pipeline
docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit --exit-code-from ci-full

# Lighthouse testing
docker-compose -f docker-compose.test.yml --profile lighthouse up --abort-on-container-exit
```

### Makefile Shortcuts

The project includes a `Makefile` with convenience targets for common Docker operations.

## Production Build

```bash
# Build production bundle
npm run build

# Output: dist/ directory with static files
```

### Nginx Configuration

Production deployments use `nginx.conf` for:
- Static file serving from built `dist/` directory
- SPA routing (fallback to `index.html` for client-side routes)
- Gzip compression
- Cache headers for assets

## CI/CD Pipelines

### GitHub Actions Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `.github/workflows/ci.yml` | Push/PR | Full CI (typecheck, lint, format, build, unit tests) |
| E2E Tests | `.github/workflows/test.yml` | Push/PR | Playwright E2E tests with sharding |
| Design Review | `.github/workflows/design-review.yml` | PR with UI changes | Automated design quality review |

### CI Pipeline Steps

1. **Type Check** - `tsc --noEmit`
2. **Lint** - ESLint
3. **Format Check** - Prettier
4. **Build** - Vite production build
5. **Unit Tests** - Vitest with coverage

### E2E Test Pipeline

- Playwright browser tests
- Test sharding for parallel execution
- Burn-in loops for flaky test detection
- Screenshot capture on failure

### Design Review Automation

- Triggered on PRs modifying `.tsx`, `.css`, or styling files
- Runs Playwright-based visual tests at multiple viewports (375px, 768px, 1440px)
- Posts findings as PR comments
- Tags PR with severity labels

## Environment Configuration

### Required Environment Variables

See `.env.example` for full list:

| Variable | Production Value | Description |
|----------|-----------------|-------------|
| `VITE_API_URL` | Depends on backend | API endpoint |
| `NODE_ENV` | `production` | Environment mode |

### Build-time Variables

All `VITE_*` prefixed variables are embedded at build time and available in client-side code. Do not include secrets in `VITE_*` variables.

## Deployment Options

### Static Hosting (Recommended)

Since LevelUp is a pure SPA with local-first data:

1. Run `npm run build`
2. Deploy `dist/` to any static hosting:
   - Vercel
   - Netlify
   - Cloudflare Pages
   - AWS S3 + CloudFront
   - GitHub Pages

**Note**: Ensure SPA routing is configured (redirect all paths to `index.html`).

### Docker Production

```bash
# Build production Docker image
docker build -t levelup:latest .

# Run container
docker run -p 80:80 levelup:latest
```

### Self-Hosted Nginx

1. Build: `npm run build`
2. Copy `dist/` to Nginx web root
3. Use provided `nginx.conf` as starting point
4. Adjust server_name and SSL as needed

## Performance Monitoring

### Lighthouse CI

Configuration in `lighthouserc.cjs`:
- Automated performance audits
- Threshold assertions
- Can run locally or in Docker

```bash
# Local Lighthouse audit
npm run lighthouse

# Docker-based Lighthouse
npm run lighthouse:docker
```

## Related Documentation

- [Docker Quickstart](../DOCKER_QUICKSTART.md)
- [Docker Guide](../DOCKER.md)
- [CI Pipeline](./CI_PIPELINE.md)
- [CI Examples](./CI_EXAMPLES.md)
- [CI Quick Reference](./CI_QUICK_REFERENCE.md)
- [Lighthouse CI](./lighthouse-ci.md)

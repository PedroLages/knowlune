# CI Pipeline - Quick Reference

## Common Commands

### Run Full CI Pipeline

```bash
# Fastest (local execution)
make ci

# Most reliable (Docker)
make ci-docker

# Using npm
npm run ci
```

### Individual Checks

| Check | Make Command | npm Command |
|-------|--------------|-------------|
| Type Check | `make typecheck` | `npm run typecheck` |
| Lint | `make lint` | `npm run lint` |
| Format Check | `make format-check` | `npm run format:check` |
| Build | `make build` | `npm run build` |
| Unit Tests | `make test-unit` | `npm run test:unit` |
| E2E Tests | `make test-e2e` | `npm run test:e2e` |

### Fix Issues

```bash
# Auto-fix formatting
make format

# Run tests in watch mode
npm run test

# Run E2E tests with UI
make test-e2e-ui
```

## Docker Commands

```bash
# Individual checks
make ci-typecheck
make ci-lint
make ci-format
make ci-build
make ci-test-unit
make ci-test-e2e

# Full pipeline
make ci-docker
```

## Before Committing Checklist

```bash
# 1. Check types
make typecheck

# 2. Check linting
make lint

# 3. Check formatting
make format-check

# 4. Run tests
make test-unit

# OR: Run all at once
make ci
```

## GitHub Actions Status

Check your PR at: `https://github.com/[owner]/[repo]/actions`

All checks must pass:

- ✅ typecheck
- ✅ lint
- ✅ format
- ✅ build
- ✅ unit-tests
- ✅ e2e-tests

## Quick Fixes

### Formatting Issues

```bash
npm run format
git add .
git commit -m "Fix formatting"
```

### Linting Issues

```bash
# Review and fix manually based on errors
npm run lint
```

### Type Errors

```bash
# Review and fix in your code
make typecheck
```

### Test Failures

```bash
# Run in watch mode to debug
npm run test

# E2E tests with UI
make test-e2e-ui
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| CI fails, local passes | Run `make ci-docker` to match CI environment |
| Playwright fails | Run `npx playwright install --with-deps chromium` |
| Type check fails | Run `npm ci` to reinstall dependencies |
| Format check fails | Run `npm run format` to auto-fix |
| Docker hangs | Run `docker-compose -f docker-compose.ci.yml down -v` |

## Help

```bash
# Show all available make commands
make help
```

## Key Files

- `.github/workflows/ci.yml` - GitHub Actions config
- `docker-compose.ci.yml` - Docker CI config
- `Makefile` - Convenient commands
- `package.json` - npm scripts
- `playwright.config.ts` - Playwright config
- `tsconfig.json` - TypeScript config
- `eslint.config.js` - ESLint config
- `.prettierrc` - Prettier config

## More Info

See [CI_PIPELINE.md](CI_PIPELINE.md) for complete documentation.

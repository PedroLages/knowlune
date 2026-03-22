# CI/CD Pipeline Documentation

## Overview

This document provides detailed information about the Continuous Integration (CI) pipeline implemented for the LevelUp project. The pipeline ensures code quality, type safety, and functionality through automated testing, linting, and building.

## Pipeline Architecture

### Components

The CI pipeline consists of six main components:

1. **Type Checking** - TypeScript type validation
2. **Linting** - Code quality checks with ESLint
3. **Format Checking** - Code style validation with Prettier
4. **Build** - Production bundle creation with Vite
5. **Unit Tests** - Component and logic testing with Vitest
6. **E2E Tests** - End-to-end testing with Playwright

### Execution Environments

The pipeline can run in three different environments:

1. **Local (Direct)** - Run commands directly on your machine
2. **Local (Docker)** - Run commands in isolated Docker containers
3. **GitHub Actions** - Automated execution on GitHub

## File Structure

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml              # Main CI pipeline workflow
│       └── design-review.yml   # Design review workflow
├── docker-compose.ci.yml       # Docker CI configuration
├── Makefile                    # Convenient CI commands
├── package.json                # NPM scripts
├── playwright.config.ts        # Playwright configuration
├── tsconfig.json              # TypeScript configuration
├── eslint.config.js           # ESLint configuration
└── .prettierrc                # Prettier configuration
```

## Running the Pipeline

### Quick Start

```bash
# Run full CI pipeline locally (fastest)
make ci

# Run full CI pipeline in Docker (most reliable)
make ci-docker

# Or using npm
npm run ci
```

### Individual Checks

#### Local Execution

```bash
# Type checking
make typecheck              # or: npm run typecheck

# Linting
make lint                   # or: npm run lint

# Format checking
make format-check           # or: npm run format:check

# Build
make build                  # or: npm run build

# Unit tests
make test-unit              # or: npm run test:unit

# E2E tests
make test-e2e               # or: npm run test:e2e
```

#### Docker Execution

```bash
# Individual checks in Docker
make ci-typecheck           # Type checking
make ci-lint                # Linting
make ci-format              # Format checking
make ci-build               # Build
make ci-test-unit           # Unit tests
make ci-test-e2e            # E2E tests

# Full pipeline in Docker
make ci-docker
```

## Docker Configuration

### docker-compose.ci.yml

The Docker configuration uses profiles to organize CI services:

```yaml
services:
  typecheck:    # TypeScript type checking
  lint:         # ESLint
  format:       # Prettier format checking
  build:        # Vite production build
  unit-tests:   # Vitest unit tests
  e2e-tests:    # Playwright E2E tests
  ci-full:      # Orchestrator for full pipeline
```

### Images Used

- **node:20-alpine** - Lightweight Node.js for most checks
- **mcr.microsoft.com/playwright:v1.58.2-jammy** - Full Playwright environment for E2E tests

### Environment Variables

All services run with:

- `CI=true` - Indicates CI environment
- `NODE_ENV=production` - Used for builds

### Volumes

- **Source code** - Mounted read-only at `/app`
- **node_modules** - Named volume for dependency caching
- **Build outputs** - Ephemeral volumes for artifacts

## GitHub Actions Workflow

### Trigger Events

The workflow automatically runs on:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Jobs

#### 1. typecheck

- Runs TypeScript type checking
- Fails if any type errors are found
- No artifacts generated

#### 2. lint

- Runs ESLint on all source files
- Fails on errors (warnings allowed)
- No artifacts generated

#### 3. format

- Checks code formatting with Prettier
- Fails if any files are not properly formatted
- No artifacts generated

#### 4. build

- Creates production build with Vite
- Uploads build artifacts (7 days retention)
- Validates that build succeeds without errors

#### 5. unit-tests

- Runs Vitest unit tests
- Generates coverage report
- Uploads coverage artifacts (7 days retention)
- Retries: 0 (no retries for unit tests)

#### 6. e2e-tests

- Runs Playwright E2E tests
- Tests on Chromium browser
- Uploads Playwright HTML report (30 days retention)
- Uploads test results (30 days retention)
- Depends on: build job
- Retries: 2 (configured in playwright.config.ts)

#### 7. ci-status

- Final status check
- Depends on all other jobs
- Fails if any job fails
- Used for branch protection rules

### Caching

Node.js dependencies are cached using GitHub Actions cache:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

### Artifacts

| Artifact | Retention | Description |
|----------|-----------|-------------|
| build-dist | 7 days | Production build output |
| coverage-report | 7 days | Vitest coverage reports |
| playwright-report | 30 days | E2E test HTML reports |
| test-results | 30 days | Raw Playwright results |

## Configuration Details

### TypeScript Configuration

**File**: `tsconfig.json`

Key settings:

- `strict: true` - Maximum type safety
- `noEmit: true` - Type checking only (no output)
- `noUnusedLocals: true` - Catch unused variables
- `noUnusedParameters: true` - Catch unused parameters

### ESLint Configuration

**File**: `eslint.config.js`

- Based on `@eslint/js` and `typescript-eslint`
- Ignores: `dist/`, `node_modules/`
- Warnings for unused vars (with `_` prefix exception)
- Warnings for explicit `any` types

### Prettier Configuration

**File**: `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Playwright Configuration

**File**: `playwright.config.ts`

- **Test directory**: `./tests`
- **Retries**: 2 in CI, 0 locally
- **Workers**: 1 in CI, unlimited locally
- **Reporter**: HTML report
- **Base URL**: `http://localhost:5173`
- **Projects**: Chromium, Mobile Chrome, Mobile Safari

## Best Practices

### Before Committing

1. Run type checking: `make typecheck`
2. Run linting: `make lint`
3. Check formatting: `make format-check`
4. Run tests: `make test-unit`

Or run all at once:

```bash
make ci
```

### Fixing Issues

#### Type Errors

```bash
# Run type checking
make typecheck

# Fix errors in your code
# Then re-run to verify
make typecheck
```

#### Linting Errors

```bash
# Run linting
make lint

# Fix issues manually or with --fix (if available)
```

#### Formatting Issues

```bash
# Auto-fix all formatting issues
make format

# Or with npm
npm run format
```

#### Test Failures

```bash
# Run tests in watch mode for development
npm run test

# Run specific test file
npm run test path/to/test.spec.ts

# Run with UI for debugging
make test-e2e-ui
```

### Pull Request Workflow

1. **Create feature branch**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test locally**

   ```bash
   make ci
   ```

3. **Commit and push**

   ```bash
   git add .
   git commit -m "Add feature X"
   git push origin feature/my-feature
   ```

4. **Create pull request**
   - CI will automatically run
   - All checks must pass before merge
   - Review artifacts if tests fail

5. **Address CI failures**
   - Check GitHub Actions logs
   - Fix issues locally
   - Push fixes

6. **Merge when green**
   - All CI checks passing
   - Code review approved

## Troubleshooting

### Common Issues

#### "npm ci" Fails

**Cause**: `package-lock.json` out of sync

**Solution**:

```bash
rm package-lock.json node_modules -rf
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
```

#### Type Checking Passes Locally but Fails in CI

**Cause**: IDE cache or different TypeScript version

**Solution**:

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
npm ci

# Run type checking
make typecheck
```

#### E2E Tests Fail in CI but Pass Locally

**Cause**: Different viewport sizes or timing issues

**Solution**:

```bash
# Run tests in CI mode locally
CI=true npm run test:e2e

# Or use Docker
make ci-test-e2e
```

#### Formatting Checks Fail

**Cause**: Different Prettier version or configuration

**Solution**:

```bash
# Auto-fix formatting
npm run format

# Commit changes
git add .
git commit -m "Fix formatting"
```

#### Docker Compose Hangs

**Cause**: Port conflicts or volume issues

**Solution**:

```bash
# Stop all containers
docker-compose -f docker-compose.ci.yml down

# Remove volumes
docker-compose -f docker-compose.ci.yml down -v

# Try again
make ci-docker
```

### Debugging CI Failures

#### 1. Check GitHub Actions Logs

1. Go to "Actions" tab in GitHub
2. Click on the failed workflow run
3. Click on the failed job
4. Expand the failing step
5. Read the error message

#### 2. Download Artifacts

1. Go to failed workflow run
2. Scroll to "Artifacts" section
3. Download relevant artifacts:
   - `playwright-report` for E2E test details
   - `test-results` for raw test output
   - `coverage-report` for unit test coverage

#### 3. Reproduce Locally

```bash
# Run the same command that failed in CI
CI=true make [command]

# Or use Docker for exact environment
make ci-[command]
```

#### 4. Check for Environment Differences

- Node.js version (should be 20)
- npm version
- Dependency versions (use `npm ci`, not `npm install`)

## Advanced Usage

### Running Specific Test Suites

```bash
# Run only unit tests
make test-unit

# Run only E2E tests
make test-e2e

# Run specific test file
npx playwright test tests/specific-test.spec.ts

# Run tests matching pattern
npx playwright test --grep "user login"
```

### Generating Coverage Reports

```bash
# Run tests with coverage
npm run test:unit

# Coverage report in: coverage/
# Open HTML report: coverage/index.html
```

### Running Tests in Debug Mode

```bash
# Playwright debug mode
npx playwright test --debug

# Playwright UI mode (interactive)
make test-e2e-ui

# Vitest UI mode
npx vitest --ui
```

### Custom Docker Builds

```bash
# Build specific service
docker-compose -f docker-compose.ci.yml build typecheck

# Run with custom environment variables
CI=true NODE_ENV=development make ci-docker

# Run with verbose output
docker-compose -f docker-compose.ci.yml --verbose up
```

## Performance Optimization

### Local Development

- Use `npm run dev` for hot reload
- Run `make typecheck` separately from build
- Use test watch mode: `npm run test`

### CI Optimization

- GitHub Actions caches node_modules
- Docker uses named volumes for dependencies
- Parallel job execution in GitHub Actions
- Playwright browser caching

### Reducing CI Time

1. **Skip unnecessary checks** (not recommended for production):

   ```bash
   # Skip E2E tests (faster feedback)
   make typecheck lint format-check build test-unit
   ```

2. **Use Docker volume caching**:

   ```bash
   # First run installs dependencies in volume
   make ci-docker

   # Subsequent runs reuse cached dependencies
   make ci-docker  # Much faster!
   ```

3. **Run checks in parallel locally**:

   ```bash
   # Run multiple checks at once (if your machine can handle it)
   make typecheck & make lint & make format-check & wait
   ```

## Maintenance

### Updating Dependencies

```bash
# Update all dependencies
npm update

# Run CI to verify updates
make ci

# Commit if successful
git add package.json package-lock.json
git commit -m "Update dependencies"
```

### Updating CI Configuration

When modifying CI configuration files:

1. Test locally first:

   ```bash
   make ci-docker
   ```

2. Commit changes:

   ```bash
   git add docker-compose.ci.yml .github/workflows/ci.yml
   git commit -m "Update CI configuration"
   ```

3. Monitor first CI run on GitHub

### Updating Playwright

```bash
# Update Playwright
npm install -D @playwright/test@latest

# Update browsers
npx playwright install

# Update Docker image in docker-compose.ci.yml
# Change: mcr.microsoft.com/playwright:v1.58.2-jammy
# To: mcr.microsoft.com/playwright:v[NEW_VERSION]-jammy

# Test
make ci-test-e2e
```

## Resources

### Internal Documentation

- [Main README](../README.md)
- [CLAUDE.md](../CLAUDE.md) - Project conventions
- [Design Review Workflow](../.claude/workflows/design-review/design-principles.md)

### External Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)

## Support

For issues or questions about the CI pipeline:

1. Check this documentation
2. Review GitHub Actions logs
3. Check [Troubleshooting](#troubleshooting) section
4. Review existing GitHub issues
5. Create new issue with CI logs attached

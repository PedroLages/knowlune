# Knowlune

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Knowlune is a free, open-source personal learning platform for tracking progress, completing courses, and building study habits. Built with React, TypeScript, and Tailwind CSS. The original Figma design is available at <https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes>.

**Open-core model:** The core platform is free and open source. Premium features (AI-powered learning, spaced review, advanced analytics) are available as a paid subscription. See [Open-Core Strategy](docs/planning-artifacts/open-core-strategy.md) for details.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Project Structure

```
src/               # Application source code
docs/              # Documentation
  ├── analysis/    # Analysis and research documents
  ├── api/         # API documentation
  ├── docker/      # Docker setup guides
  ├── implementation-artifacts/  # Story files, sprint tracking
  ├── planning-artifacts/        # Product and epic planning
  ├── plans/       # Implementation plans
  ├── reviews/     # Code and design review reports
  └── research/    # Technical research
scripts/           # Build and utility scripts
tests/             # Test suites (E2E, unit, visual)
.claude/           # Claude Code agent configurations
_bmad/             # BMAD workflow definitions
```

## CI/CD Pipeline

This project includes a comprehensive CI/CD pipeline for automated testing, linting, and building. The pipeline can be run locally or in Docker containers, and is integrated with GitHub Actions for automatic PR checks.

### Quick Start

```bash
# Run full CI pipeline locally
npm run ci

# Or use Make
make ci

# Run CI pipeline in Docker
make ci-docker
```

### Available CI Commands

#### NPM Scripts

```bash
npm run typecheck        # Run TypeScript type checking
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
npm run build           # Build production bundle
npm run test:unit       # Run unit tests with coverage
npm run test:e2e        # Run E2E tests with Playwright
npm run test:e2e:ui     # Run E2E tests in UI mode
npm run ci              # Run full CI pipeline locally
npm run ci:docker       # Run CI pipeline in Docker
```

#### Make Commands

```bash
make help              # Show all available commands
make install           # Install dependencies
make dev              # Start development server
make build            # Build production bundle
make test             # Run all tests interactively
make test-unit        # Run unit tests with coverage
make test-e2e         # Run E2E tests with Playwright
make test-e2e-ui      # Run E2E tests in UI mode
make lint             # Run ESLint
make typecheck        # Run TypeScript type checking
make format           # Format code with Prettier
make format-check     # Check code formatting
make ci               # Run full CI pipeline locally
make ci-docker        # Run CI pipeline in Docker
make ci-typecheck     # Run typecheck in Docker
make ci-lint          # Run lint in Docker
make ci-format        # Run format check in Docker
make ci-build         # Run build in Docker
make ci-test-unit     # Run unit tests in Docker
make ci-test-e2e      # Run E2E tests in Docker
make clean            # Remove build artifacts and caches
make clean-all        # Clean all artifacts including Docker volumes
```

### CI Pipeline Components

The CI pipeline consists of the following checks:

1. **Type Checking** - Validates TypeScript types with `tsc --noEmit`
2. **Linting** - Runs ESLint to check code quality
3. **Format Checking** - Validates code formatting with Prettier
4. **Build** - Tests production build with Vite
5. **Unit Tests** - Runs Vitest unit tests with coverage
6. **E2E Tests** - Runs Playwright end-to-end tests

### Docker-based CI

The project includes a `docker-compose.ci.yml` file that runs all CI checks in isolated Docker containers. This ensures consistency across different environments.

#### Running Individual CI Checks in Docker

```bash
# Run specific checks
make ci-typecheck      # Type checking only
make ci-lint          # Linting only
make ci-format        # Format checking only
make ci-build         # Build only
make ci-test-unit     # Unit tests only
make ci-test-e2e      # E2E tests only
```

#### Running Full CI Pipeline in Docker

```bash
# Run all checks sequentially
make ci-docker

# Or directly with docker-compose
docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit
```

### GitHub Actions Integration

The project includes a `.github/workflows/ci.yml` workflow that automatically runs on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

#### CI Workflow Jobs

1. **typecheck** - Validates TypeScript types
2. **lint** - Checks code quality with ESLint
3. **format** - Validates code formatting
4. **build** - Tests production build and uploads artifacts
5. **unit-tests** - Runs unit tests with coverage
6. **e2e-tests** - Runs Playwright E2E tests and uploads reports
7. **ci-status** - Final status check that fails if any job fails

#### Artifacts

The GitHub Actions workflow uploads the following artifacts:

- **build-dist** - Production build output (7 days retention)
- **coverage-report** - Unit test coverage reports (7 days retention)
- **playwright-report** - E2E test reports (30 days retention)
- **test-results** - Playwright test results (30 days retention)

### Local Development Workflow

1. **Before Committing**

   ```bash
   # Check your code
   make typecheck
   make lint
   make format-check

   # Or run all checks
   make ci
   ```

2. **Format Your Code**

   ```bash
   # Auto-fix formatting issues
   make format

   # Or with npm
   npm run format
   ```

3. **Run Tests**

   ```bash
   # Unit tests
   make test-unit

   # E2E tests
   make test-e2e

   # E2E tests with UI (interactive)
   make test-e2e-ui
   ```

### CI Best Practices

1. **Always run CI checks before pushing** - Use `make ci` to catch issues early
2. **Fix linting issues** - Run `npm run lint` and address any warnings
3. **Maintain test coverage** - Write tests for new features
4. **Check formatting** - Use Prettier to maintain consistent code style
5. **Review build output** - Ensure production build succeeds without warnings

### Environment Variables

The CI pipeline uses the following environment variables:

- `CI=true` - Indicates running in CI environment
- `NODE_ENV=production` - Used for production builds

### Troubleshooting

#### CI Fails Locally but Passes in Docker

This usually indicates environment-specific issues. Try running in Docker:

```bash
make ci-docker
```

#### Playwright Tests Fail

Install Playwright browsers:

```bash
npx playwright install --with-deps chromium
```

#### Type Checking Fails

Ensure all dependencies are installed:

```bash
npm ci
```

#### Formatting Issues

Auto-fix formatting:

```bash
make format
```

### Further Reading

- [Testing Guide](TESTING.md) - Comprehensive guide to running and interpreting all test suites
- [Docker Setup Guide](docs/docker/docker-setup-guide.md) - Running the app in Docker containers
- [Docker Quickstart](docs/docker/quickstart.md) - Quick Docker setup instructions
- [API Quickstart](docs/api/quickstart.md) - API documentation and testing
- [GitHub Actions Documentation](.github/workflows/ci.yml)
- [Docker Compose CI Configuration](docker-compose.ci.yml)
- [Playwright Configuration](playwright.config.ts)
- [ESLint Configuration](eslint.config.js)
- [TypeScript Configuration](tsconfig.json)

## License

The core platform is licensed under [AGPL-3.0](LICENSE). Premium features (`src/premium/`) are proprietary and not covered by the AGPL license.

## Contributing

We welcome contributions to the core platform! By contributing, you agree to our Contributor License Agreement (CLA).

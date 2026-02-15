.PHONY: help install dev build test lint typecheck format format-check ci ci-docker clean

# Default target
help:
	@echo "Available targets:"
	@echo "  make install        - Install dependencies"
	@echo "  make dev           - Start development server"
	@echo "  make build         - Build production bundle"
	@echo "  make test          - Run all tests interactively"
	@echo "  make test-unit     - Run unit tests with coverage"
	@echo "  make test-e2e      - Run E2E tests with Playwright"
	@echo "  make lint          - Run ESLint"
	@echo "  make typecheck     - Run TypeScript type checking"
	@echo "  make format        - Format code with Prettier"
	@echo "  make format-check  - Check code formatting"
	@echo "  make ci            - Run full CI pipeline locally"
	@echo "  make ci-docker     - Run CI pipeline in Docker"
	@echo "  make ci-typecheck  - Run typecheck in Docker"
	@echo "  make ci-lint       - Run lint in Docker"
	@echo "  make ci-format     - Run format check in Docker"
	@echo "  make ci-build      - Run build in Docker"
	@echo "  make ci-test-unit  - Run unit tests in Docker"
	@echo "  make ci-test-e2e   - Run E2E tests in Docker"
	@echo "  make clean         - Remove build artifacts and caches"

# Install dependencies
install:
	npm ci

# Development
dev:
	npm run dev

# Build
build:
	npm run build

# Testing
test:
	npm run test

test-unit:
	npm run test:unit

test-e2e:
	npm run test:e2e

test-e2e-ui:
	npm run test:e2e:ui

# Code quality
lint:
	npm run lint

typecheck:
	npm run typecheck

format:
	npm run format

format-check:
	npm run format:check

# CI - Local execution
ci: typecheck lint format-check build test-unit
	@echo "✅ All CI checks passed locally"

# CI - Docker execution (individual services)
ci-typecheck:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit typecheck

ci-lint:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit lint

ci-format:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit format

ci-build:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit build

ci-test-unit:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit unit-tests

ci-test-e2e:
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit e2e-tests

# CI - Docker execution (full pipeline)
ci-docker:
	@echo "Running full CI pipeline in Docker..."
	docker-compose -f docker-compose.ci.yml --profile ci up --abort-on-container-exit --exit-code-from ci-full
	@echo "✅ All CI checks passed in Docker"

# Clean
clean:
	rm -rf node_modules dist coverage playwright-report test-results .vite
	@echo "✅ Cleaned build artifacts and caches"

# Deep clean (including Docker volumes)
clean-all: clean
	docker-compose -f docker-compose.ci.yml down -v
	@echo "✅ Cleaned all artifacts including Docker volumes"

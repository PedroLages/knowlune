# CI/CD Test Pipeline

## Overview

The E2E test pipeline (`.github/workflows/test.yml`) provides comprehensive end-to-end test coverage with parallel execution, flaky test detection, and efficient caching.

**Triggers:**
- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`
- Weekly schedule (Monday 6am UTC) for burn-in

## Pipeline Stages

### 1. E2E Tests (4 parallel shards)

Tests are split across 4 parallel jobs using Playwright's `--shard` flag. Each shard runs a subset of the full test suite.

- **fail-fast: false** — all shards run to completion even if one fails
- **Artifacts**: test results and traces uploaded on failure only (30-day retention)

### 2. Burn-In (flaky test detection)

Runs the full chromium test suite 10 times consecutively. Any single failure indicates flaky tests that must be fixed before merging.

- Runs on **pull requests** and **weekly schedule** only (not on every push)
- Uses chromium project only for speed
- Exits immediately on first failure

### 3. Test Report

Aggregates results from all shards and burn-in. Fails the pipeline if any job failed.

## Caching

Two caches reduce CI execution time:

| Cache | Key | Saves |
|-------|-----|-------|
| npm dependencies | `runner.os + package-lock.json hash` | ~2 min |
| Playwright browsers | `runner.os + package-lock.json hash` | ~3 min |

## Running Locally

Mirror the CI pipeline on your machine:

```bash
# Full local CI (lint + tests + 3-iteration burn-in)
./scripts/ci-local.sh

# Standalone burn-in (default 10 iterations)
./scripts/burn-in.sh

# Custom iteration count
./scripts/burn-in.sh 5

# Run only tests for changed files
./scripts/test-changed.sh
```

## Debugging Failed CI Runs

1. **Check the failing shard** — artifact names include the shard number (`test-results-shard-1`, etc.)
2. **Download artifacts** — traces (`.zip`) contain full Playwright trace viewer data
3. **View traces locally** — `npx playwright show-trace <trace-file.zip>`
4. **Mirror locally** — run `./scripts/ci-local.sh` to reproduce the CI environment
5. **Check burn-in** — if burn-in fails but shards pass, you have a flaky test

## Configuration

The pipeline uses Playwright configuration from `playwright.config.ts`:

- **Test directory**: `./tests`
- **Retries in CI**: 2
- **Workers in CI**: 1 (single-threaded per shard)
- **Reporter**: HTML
- **Trace**: on-first-retry
- **Screenshots**: only-on-failure

## Relationship to Existing CI

This pipeline (`test.yml`) focuses on comprehensive E2E testing. The existing `ci.yml` handles:
- TypeScript type checking
- ESLint linting
- Prettier format checking
- Production build
- Unit tests
- Basic E2E tests (no sharding)

Both pipelines run independently. The `test.yml` pipeline provides deeper test coverage with sharding and flaky detection.

## Badge

Add to README:

```markdown
[![E2E Tests](https://github.com/PedroLages/Elearningplatformwireframes/actions/workflows/test.yml/badge.svg)](https://github.com/PedroLages/Elearningplatformwireframes/actions/workflows/test.yml)
```

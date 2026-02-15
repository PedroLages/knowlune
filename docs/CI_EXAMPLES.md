# CI Pipeline - Examples

This document provides example outputs and usage scenarios for the CI pipeline.

## Example: Running Full CI Pipeline Locally

### Command

```bash
make ci
```

### Expected Output

```
npm run typecheck
npx tsc --noEmit
✓ Type checking completed successfully

npm run lint
✓ All files pass linting

npm run format:check
Checking formatting...
✓ All files are properly formatted

npm run build
vite v6.4.1 building for production...
✓ 150 modules transformed.
dist/index.html                   0.50 kB │ gzip:  0.32 kB
dist/assets/index-a1b2c3d4.css   85.23 kB │ gzip: 15.45 kB
dist/assets/index-e5f6g7h8.js   156.78 kB │ gzip: 48.92 kB
✓ built in 3.45s

npm run test:unit
✓ src/app/components/ui/Button.test.tsx (5)
✓ src/app/components/ui/Card.test.tsx (3)
✓ src/app/pages/Overview.test.tsx (8)

Test Files  3 passed (3)
Tests  16 passed (16)
Start at  14:32:15
Duration  2.15s (transform 456ms, setup 0ms, collect 1.2s, tests 890ms)

✅ All CI checks passed locally
```

## Example: Running CI in Docker

### Command

```bash
make ci-docker
```

### Expected Output

```
Running full CI pipeline in Docker...
[+] Running 6/6
 ✔ Container typecheck     Started     1.2s
 ✔ Container lint          Started     1.3s
 ✔ Container format        Started     1.2s
 ✔ Container build         Started     1.4s
 ✔ Container unit-tests    Started     1.5s
 ✔ Container ci-full       Started     0.8s

typecheck_1   | > operative-study@0.0.1 ci
typecheck_1   | > npm ci && npx tsc --noEmit
typecheck_1   | added 456 packages in 12.3s
typecheck_1   | ✓ Type checking passed
typecheck_1 exited with code 0

lint_1        | > operative-study@0.0.1 lint
lint_1        | > eslint .
lint_1        | ✓ Linting passed
lint_1 exited with code 0

format_1      | > operative-study@0.0.1 format:check
format_1      | > prettier --check 'src/**/*.{ts,tsx,js,jsx,css,md}'
format_1      | All matched files use Prettier code style!
format_1 exited with code 0

build_1       | > operative-study@0.0.1 build
build_1       | > vite build
build_1       | ✓ built in 3.89s
build_1 exited with code 0

unit-tests_1  | > operative-study@0.0.1 test:unit
unit-tests_1  | > vitest run --coverage
unit-tests_1  | Test Files  3 passed (3)
unit-tests_1  | Tests  16 passed (16)
unit-tests_1 exited with code 0

ci-full_1     | Running full CI pipeline via docker-compose
ci-full_1 exited with code 0

✅ All CI checks passed in Docker
```

## Example: GitHub Actions Workflow Run

### Successful Run

```
CI Pipeline
✅ Completed in 5m 32s

Jobs:
  ✅ typecheck (45s)
  ✅ lint (38s)
  ✅ format (32s)
  ✅ build (1m 12s)
  ✅ unit-tests (52s)
  ✅ e2e-tests (2m 18s)
  ✅ ci-status (15s)

Artifacts:
  📦 build-dist (2.3 MB)
  📦 coverage-report (458 KB)
  📦 playwright-report (1.8 MB)
  📦 test-results (234 KB)
```

### Failed Run - Type Error

```
CI Pipeline
❌ Failed in 1m 15s

Jobs:
  ❌ typecheck (45s) - FAILED
  ⏭️ lint - Skipped
  ⏭️ format - Skipped
  ⏭️ build - Skipped
  ⏭️ unit-tests - Skipped
  ⏭️ e2e-tests - Skipped
  ❌ ci-status - FAILED

Error Details:
src/app/components/MyComponent.tsx:15:7 - error TS2322:
Type 'string' is not assignable to type 'number'.

15     value={props.count}
       ~~~~~

Fix: Ensure props.count is a number, not a string
```

## Example: Individual Check Commands

### Type Checking

```bash
$ make typecheck

npx tsc --noEmit
✓ No type errors found
```

### Linting

```bash
$ make lint

eslint .

src/app/components/Button.tsx
  12:15  warning  Prefer named export  import/prefer-default-export

✖ 1 problem (0 errors, 1 warning)
```

### Format Checking

```bash
$ make format-check

npx prettier --check 'src/**/*.{ts,tsx,js,jsx,css,md}'

Checking formatting...
src/app/pages/Overview.tsx
src/app/pages/Courses.tsx
✓ All files are properly formatted
```

### Build

```bash
$ make build

vite v6.4.1 building for production...
✓ 150 modules transformed.
dist/index.html                   0.50 kB │ gzip:  0.32 kB
dist/assets/index-a1b2c3d4.css   85.23 kB │ gzip: 15.45 kB
dist/assets/index-e5f6g7h8.js   156.78 kB │ gzip: 48.92 kB
✓ built in 3.45s
```

### Unit Tests

```bash
$ make test-unit

 RUN  v4.0.18

 ✓ src/app/components/ui/Button.test.tsx (5) 234ms
   ✓ renders with default props
   ✓ renders with custom className
   ✓ calls onClick handler
   ✓ renders disabled state
   ✓ renders different variants

 ✓ src/app/pages/Overview.test.tsx (8) 456ms
   ✓ renders overview page
   ✓ displays user stats
   ✓ shows upcoming classes
   ✓ renders progress chart
   ✓ handles empty state
   ✓ navigates to course details
   ✓ filters by category
   ✓ searches courses

Test Files  2 passed (2)
     Tests  13 passed (13)
  Start at  14:45:23
  Duration  1.89s

 % Coverage report from v8
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   87.45 |    82.34 |   89.12 |   87.89 |
 components/ui      |   92.34 |    88.76 |   94.23 |   92.56 |
  Button.tsx        |   95.67 |    91.23 |   98.45 |   95.89 |
  Card.tsx          |   89.12 |    86.34 |   90.12 |   89.45 |
 pages              |   82.45 |    76.89 |   84.23 |   82.89 |
  Overview.tsx      |   85.23 |    79.45 |   87.12 |   85.67 |
  Courses.tsx       |   79.34 |    74.23 |   81.45 |   79.89 |
--------------------|---------|----------|---------|---------|
```

### E2E Tests

```bash
$ make test-e2e

Running 12 tests using 1 worker

  ✓ [chromium] › navigation.spec.ts:3:5 › should navigate between pages (2.1s)
  ✓ [chromium] › navigation.spec.ts:12:5 › should highlight active page (1.8s)
  ✓ [chromium] › courses.spec.ts:3:5 › should display course list (2.3s)
  ✓ [chromium] › courses.spec.ts:15:5 › should filter courses by category (1.9s)
  ✓ [chromium] › courses.spec.ts:28:5 › should search courses (2.1s)
  ✓ [chromium] › lesson-player.spec.ts:3:5 › should play video lesson (3.2s)
  ✓ [chromium] › lesson-player.spec.ts:18:5 › should view PDF lesson (2.8s)
  ✓ [Mobile Chrome] › responsive.spec.ts:3:5 › should work on mobile (2.5s)
  ✓ [Mobile Chrome] › responsive.spec.ts:15:5 › should open mobile menu (1.7s)
  ✓ [Mobile Safari] › responsive.spec.ts:3:5 › should work on mobile (2.6s)
  ✓ [Mobile Safari] › responsive.spec.ts:15:5 › should open mobile menu (1.8s)
  ✓ [chromium] › accessibility.spec.ts:3:5 › should have no a11y violations (3.4s)

  12 passed (28.2s)

To open last HTML report run:
  npx playwright show-report
```

## Example: Fixing Common Issues

### Formatting Issues

```bash
# Check formatting (fails)
$ make format-check
Code style issues found in the following files:
  src/app/pages/Overview.tsx
  src/app/components/CourseCard.tsx

# Auto-fix
$ make format
src/app/pages/Overview.tsx 234ms
src/app/components/CourseCard.tsx 156ms
✓ 2 files formatted

# Verify
$ make format-check
✓ All files are properly formatted
```

### Linting Issues

```bash
# Run lint
$ make lint
src/app/components/Button.tsx
  15:7  error  'React' is defined but never used  @typescript-eslint/no-unused-vars
  23:5  error  Missing return type on function     @typescript-eslint/explicit-function-return-type

# Fix in code editor
# Remove unused import
# Add return type

# Verify
$ make lint
✓ No linting errors found
```

### Test Failures

```bash
# Run tests
$ make test-unit
 FAIL  src/app/pages/Overview.test.tsx > displays user stats
AssertionError: expected "0" to be "42"

# Fix test or code

# Verify
$ make test-unit
 ✓ src/app/pages/Overview.test.tsx (8)
Test Files  1 passed (1)
     Tests  8 passed (8)
```

## Example: Docker Individual Services

### Running Type Check in Docker

```bash
$ make ci-typecheck

[+] Running 1/1
 ✔ Container typecheck  Started  1.2s

typecheck_1   | npm ci
typecheck_1   | added 456 packages in 12.3s
typecheck_1   |
typecheck_1   | npx tsc --noEmit
typecheck_1   | ✓ No type errors found
typecheck_1 exited with code 0
```

### Running Lint in Docker

```bash
$ make ci-lint

[+] Running 1/1
 ✔ Container lint  Started  1.1s

lint_1   | npm ci
lint_1   | added 456 packages in 11.8s
lint_1   |
lint_1   | npm run lint
lint_1   | eslint .
lint_1   | ✓ No linting errors found
lint_1 exited with code 0
```

## Example: PR Workflow

### Step 1: Create Branch and Make Changes

```bash
$ git checkout -b feature/add-progress-widget
Switched to a new branch 'feature/add-progress-widget'

# Make changes...

$ git add .
$ git commit -m "Add progress widget to dashboard"
[feature/add-progress-widget 1a2b3c4] Add progress widget to dashboard
 3 files changed, 127 insertions(+), 5 deletions(-)
```

### Step 2: Run CI Locally Before Push

```bash
$ make ci

npm run typecheck
✓ Type checking passed

npm run lint
✓ Linting passed

npm run format:check
✓ Formatting passed

npm run build
✓ Build successful

npm run test:unit
✓ Tests passed (16/16)

✅ All CI checks passed locally
```

### Step 3: Push and Create PR

```bash
$ git push origin feature/add-progress-widget
$ gh pr create --title "Add progress widget to dashboard"

Creating pull request for feature/add-progress-widget into main

https://github.com/user/repo/pull/123
```

### Step 4: Monitor CI on GitHub

```
CI Pipeline - Running
⏳ typecheck - In progress
⏳ lint - Queued
⏳ format - Queued
⏳ build - Queued
⏳ unit-tests - Queued
⏳ e2e-tests - Queued

... (2 minutes later) ...

CI Pipeline - Completed
✅ All checks passed
```

### Step 5: Merge When Green

```bash
$ gh pr merge 123 --squash
✓ Merged #123 into main
```

## Example: Debugging CI Failures

### Scenario: E2E Test Fails in CI but Passes Locally

```bash
# Reproduce CI environment locally
$ CI=true make test-e2e

# Or use Docker to match exact CI environment
$ make ci-test-e2e

# Run with debug
$ npx playwright test --debug

# Check screenshots from failed run
$ npx playwright show-report

# Fix issue

# Verify
$ CI=true make test-e2e
✓ All tests passed
```

### Scenario: Type Check Fails After Dependency Update

```bash
# Clear cache and reinstall
$ rm -rf node_modules package-lock.json
$ npm install

# Run type check
$ make typecheck
src/app/components/Chart.tsx:45:7 - error TS2322:
Type 'string' is not assignable to type 'number'.

# Fix type error in Chart.tsx

# Verify
$ make typecheck
✓ No type errors found

# Commit fix
$ git add package-lock.json src/app/components/Chart.tsx
$ git commit -m "Fix type errors after dependency update"
```

## Tips for Success

1. **Always run `make ci` before pushing**
2. **Use `make ci-docker` to verify in clean environment**
3. **Check GitHub Actions logs for detailed error messages**
4. **Download artifacts from failed runs for debugging**
5. **Run individual checks during development for faster feedback**
6. **Use `make format` to auto-fix formatting issues**
7. **Keep dependencies up to date with `npm update`**
8. **Add new tests when adding features**
9. **Review coverage reports to identify untested code**
10. **Use Playwright UI mode for debugging E2E tests**

## Performance Tips

- **First run** (cold): ~5-7 minutes (installs dependencies)
- **Subsequent runs** (warm): ~2-3 minutes (cached dependencies)
- **Individual checks**: 15-60 seconds each
- **Local execution**: Usually faster than Docker
- **Docker execution**: More reliable, matches CI exactly

## Next Steps

- Review [CI_PIPELINE.md](CI_PIPELINE.md) for complete documentation
- Check [CI_QUICK_REFERENCE.md](CI_QUICK_REFERENCE.md) for command reference
- Set up branch protection rules to require CI checks
- Configure Slack/email notifications for CI failures
- Set up automatic dependency updates with Dependabot

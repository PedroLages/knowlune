# Testing Guide

Complete guide to running and interpreting tests for the LevelUp project.

## Quick Reference

```bash
# Run everything
make ci                    # Full CI pipeline (recommended before commits)
npm run test:e2e          # Playwright E2E tests

# Individual test suites
npm run typecheck         # TypeScript type checking
npm run lint              # ESLint code quality
npm run format:check      # Prettier formatting
npm run build             # Production build
npm run test:unit         # Unit tests
npm run lighthouse        # Performance & accessibility
```

---

## Complete CI Pipeline

### Run Full CI Locally

```bash
make ci
```

**What it runs (in order):**
1. TypeScript type checking (`npm run typecheck`)
2. ESLint linting (`npm run lint`)
3. Prettier format checking (`npm run format:check`)
4. Production build (`npm run build`)
5. Unit tests with coverage (`npm run test:unit`)

**Expected output:**
```
✅ TypeScript compilation clean
✅ ESLint - 0 errors (warnings allowed)
✅ Prettier - All files formatted
✅ Build successful
✅ Tests passing
✅ All CI checks passed locally
```

**Note:** The CI pipeline does NOT run E2E tests or Lighthouse by default (too slow for pre-commit checks).

---

## Individual Test Suites

### 1. TypeScript Type Checking

**Command:**
```bash
npm run typecheck
```

**What it validates:**
- Type safety across the entire codebase
- Proper TypeScript types and interfaces
- No type errors or unsafe `any` usage

**Configuration:** `tsconfig.json`

**Expected output:**
```
> tsc --noEmit
✓ No TypeScript errors
```

**Common issues:**
- `error TS2552: Cannot find name` - Variable not defined
- `error TS6133: declared but never read` - Unused imports/variables
- `error TS2322: Type X is not assignable to type Y` - Type mismatch

---

### 2. ESLint Code Quality

**Command:**
```bash
npm run lint
```

**What it validates:**
- Code quality and consistency
- React best practices
- TypeScript patterns
- Potential bugs

**Configuration:** `eslint.config.js`

**Expected output:**
```
> eslint .
✓ 0 errors, X warnings
```

**Note:** Warnings are allowed but should be minimized.

**Common warnings:**
- `@typescript-eslint/no-explicit-any` - Avoid using `any` type
- `@typescript-eslint/no-unused-vars` - Remove unused variables

---

### 3. Prettier Format Check

**Command:**
```bash
# Check formatting
npm run format:check

# Auto-fix formatting
npm run format
```

**What it validates:**
- Consistent code formatting
- Proper indentation and spacing
- Quote style consistency

**Configuration:** `.prettierrc`

**Expected output:**
```
> prettier --check 'src/**/*.{ts,tsx,js,jsx,css,md}'
✓ All files formatted correctly
```

**Fix issues automatically:**
```bash
npm run format
```

---

### 4. Production Build

**Command:**
```bash
npm run build
```

**What it validates:**
- Production build succeeds
- No build errors or critical warnings
- Bundle size is reasonable

**Configuration:** `vite.config.ts`

**Expected output:**
```
✓ built in Xs
dist/index.html                    X kB
dist/assets/index-XXXXX.js       595 kB │ gzip: 162 kB
```

**Warning:** Large chunks (>500KB) may need code splitting.

---

### 5. Unit Tests (Vitest)

**Command:**
```bash
npm run test:unit
```

**What it validates:**
- Unit test coverage
- Component logic
- Utility functions

**Configuration:** `vitest.config.ts`

**Coverage reports:** Check `coverage/` directory after running.

---

## Lighthouse Performance & Accessibility

### Setup & Run

**Prerequisites:**
```bash
# Build production bundle
npm run build

# Start preview server
npm run preview &
```

**Run Lighthouse:**
```bash
npm run lighthouse
```

**What it validates:**
- **Performance** - Core Web Vitals, load times, resource optimization
- **Accessibility** - WCAG 2.1 AA compliance, ARIA labels, color contrast
- **Best Practices** - HTTPS, no console errors, security
- **SEO** - Meta tags, mobile-friendliness

**Configuration:** `lighthouserc.cjs`

### Test Coverage

Lighthouse tests **7 URLs** across the application:
- `/` - Overview page
- `/my-class` - My Class page
- `/courses` - Courses listing
- `/courses/1` - Course detail
- `/courses/1/1` - Lesson player
- `/library` - Library page
- `/reports` - Reports page

Each URL is tested **3 times** (median result used).

### Recent Results

**Critical Issues:**
- ❌ **Color contrast violations** (My Class, Courses pages)
  - Navigation text: `#717182` on `#faf5ee` = 4.41:1 (need 4.5:1)
  - Search placeholder: `#717182` on `#ececf0` = 4.06:1
  - Green indicator: `#00a63e` on `#ffffff` = 3.21:1

- ❌ **Missing button accessible names** (My Class page)

**Warnings:**
- ⚠️ SEO scores: 0.82-0.83 (target: 0.9+)
- ⚠️ Console errors present
- ⚠️ Image optimization needed (responsive images: 0.5 score)

### View Reports

Lighthouse uploads reports to Google Cloud Storage:

```
Open the report at https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/[timestamp]-[id].report.html
```

**Reports expire after 30 days.**

### Lighthouse Commands

```bash
# Full Lighthouse audit
npm run lighthouse

# Individual steps
npm run lighthouse:collect    # Collect data only
npm run lighthouse:assert     # Run assertions
npm run lighthouse:upload     # Upload to cloud storage
```

---

## Playwright E2E & Accessibility Tests

**Command:**
```bash
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

**What it validates:**
- **WCAG 2.1 AA Compliance** - Accessibility standards
- **Keyboard Navigation** - All features keyboard accessible
- **Color Contrast** - Text meets 4.5:1 ratio
- **ARIA Labels** - Screen reader compatibility
- **Responsive Design** - Mobile, tablet, desktop layouts
- **Component Accessibility** - VideoPlayer, modals, forms

**Configuration:** `playwright.config.ts`

### Test Projects

Playwright runs tests across **6 device configurations:**

1. **Desktop Chrome** (1440x900)
2. **Mobile Chrome** (Pixel 5)
3. **Mobile Safari** (iPhone 12)
4. **Tablet** (iPad Pro - 768x1024)
5. **a11y-mobile** (375x667) - Accessibility focused
6. **a11y-desktop** (1440x900) - Accessibility focused

### Recent Results

**Summary:** 204/294 tests passing (90 failures)

**Major Issues:**
- ❌ **Color contrast** - 30+ violations across all pages
- ❌ **WCAG 2.1 AA compliance** - Overview, Courses, My Class, Reports
- ❌ **Keyboard navigation** - Courses page, VideoPlayer controls
- ❌ **Missing ARIA labels** - VideoPlayer controls, buttons
- ❌ **Responsive issues** - Tablet viewport (768px) layout problems

**Example failure:**
```
✕ [chromium] › tests/accessibility.spec.ts:56:3 › Overview page - WCAG 2.1 AA violations

Color contrast failures:
- Navigation links: #717182 on #faf5ee (4.41:1, need 4.5:1)
- Search: #717182 on #ececf0 (4.06:1)
```

### Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

**Reports include:**
- Screenshots of failures
- Detailed accessibility violations
- Trace files for debugging
- Error context and stack traces

**Reports location:** `playwright-report/`

### Playwright Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/accessibility.spec.ts

# Run in specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

---

## Test Results Interpretation

### ✅ Successful Test Run

```
✓ All checks passed
✓ No TypeScript errors
✓ No ESLint errors
✓ All files formatted
✓ Build succeeded
✓ Tests passing
```

**Action:** Safe to commit and push.

### ⚠️ Warnings Present

```
⚠️ 12 warnings
✓ 0 errors
```

**Action:** Review warnings, fix if critical, otherwise safe to proceed.

### ❌ Test Failures

```
❌ 3 errors found
✕ Tests failed
```

**Action:** Fix errors before committing. Review error messages and stack traces.

### 🔴 Build Failures

```
✘ [ERROR] Build failed
```

**Action:** Critical - fix build errors immediately. Check:
1. Syntax errors in code
2. Missing dependencies
3. Import path issues
4. TypeScript errors

---

## Troubleshooting

### Prettier Not Found

**Error:**
```
sh: prettier: command not found
```

**Solution:**
```bash
npm ci  # Reinstall dependencies
```

### TypeScript Errors After Merge

**Error:**
```
error TS2552: Cannot find name 'X'
```

**Solution:**
```bash
npm ci              # Reinstall dependencies
npm run typecheck   # Verify fix
```

### Playwright Browser Not Installed

**Error:**
```
browserType.launch: Executable doesn't exist
```

**Solution:**
```bash
npx playwright install --with-deps chromium
```

### Lighthouse Server Not Running

**Error:**
```
Unable to connect to localhost:4173
```

**Solution:**
```bash
npm run build      # Build first
npm run preview &  # Start preview server
npm run lighthouse # Then run Lighthouse
```

### E2E Tests Timeout

**Error:**
```
Test timeout of 30000ms exceeded
```

**Solution:**
```bash
# Kill dev server processes
pkill -f "vite"

# Restart tests
npm run test:e2e
```

### Git Pre-commit Hook Failures

**Error:**
```
Format check failed
```

**Solution:**
```bash
npm run format      # Auto-fix formatting
git add .           # Stage fixes
git commit          # Retry commit
```

---

## Best Practices

### Before Every Commit

```bash
# Run full CI pipeline
make ci

# If errors, fix and retry
npm run format      # Fix formatting
npm run typecheck   # Check types
make ci             # Verify all checks pass
```

### Before Creating a PR

```bash
# Run full test suite
make ci
npm run test:e2e

# Optional: Run Lighthouse
npm run build && npm run preview &
npm run lighthouse
```

### During Development

```bash
# Watch mode for unit tests
npm run test

# Interactive E2E testing
npm run test:e2e:ui

```

### CI/CD Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) automatically runs:
- TypeScript type checking
- ESLint linting
- Prettier format check
- Production build
- Unit tests with coverage
- Playwright E2E tests

**All checks must pass before merging.**

---

## Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript configuration |
| `eslint.config.js` | ESLint rules |
| `.prettierrc` | Prettier formatting |
| `vite.config.ts` | Build configuration |
| `vitest.config.ts` | Unit test configuration |
| `playwright.config.ts` | E2E test configuration |
| `lighthouserc.cjs` | Lighthouse CI config |

---

## Coverage & Quality Metrics

### Current Test Coverage

- **Unit Tests:** 31/32 passing (96.9%)
- **E2E Tests:** 204/294 passing (69.4%)
- **Lighthouse Performance:** 90+ across pages
- **Lighthouse Accessibility:** Needs improvement (color contrast issues)

### Known Issues

1. **Accessibility:** 90 Playwright failures (color contrast, ARIA labels)
2. **Lighthouse:** Color contrast violations on multiple pages

### Quality Goals

- ✅ 100% TypeScript type coverage
- ✅ 0 ESLint errors
- ✅ 100% Prettier formatted
- ⚠️ 95%+ unit test coverage (current: ~97%)
- ❌ 95%+ E2E test coverage (current: ~69%)
- ❌ WCAG 2.1 AA compliance (in progress)

---

## Further Reading

- [CI/CD Pipeline Documentation](README.md#cicd-pipeline)
- [Docker Setup Guide](docs/docker/docker-setup-guide.md)
- [GitHub Actions Workflow](.github/workflows/ci.yml)
- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Vitest Documentation](https://vitest.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Quick Troubleshooting Checklist

- [ ] Dependencies installed? Run `npm ci`
- [ ] Prettier installed? Check `node_modules/.bin/prettier`
- [ ] Playwright browsers installed? Run `npx playwright install`
- [ ] Preview server running for Lighthouse? Run `npm run preview &`
- [ ] Port conflicts? Kill processes with `pkill -f "vite"`
- [ ] Clean build? Run `make clean` then `npm ci`
- [ ] Still failing? Check the specific test output and error messages

---

*Last updated: 2026-02-14*

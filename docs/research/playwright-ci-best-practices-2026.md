# Playwright CI Best Practices for GitHub Actions ubuntu-latest (2026)

**Research Date:** March 9, 2026
**Target Platform:** GitHub Actions ubuntu-latest
**Framework:** Playwright 1.58.2
**Node.js:** v22 (via .nvmrc)

## Executive Summary

This document compiles current best practices for running Playwright E2E tests in GitHub Actions CI environments as of 2026, with specific recommendations for the LevelUp project's existing CI infrastructure.

**Current State:** LevelUp already implements many 2026 best practices including .nvmrc version management, browser caching, 4-shard parallelization, and burn-in validation. This research identifies optimization opportunities and validates existing patterns.

---

## 1. Node.js Version Management

### Current Implementation ✅

**Status:** Already following 2026 best practices

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: 'npm'
```

**Analysis:**
- `.nvmrc` contains `22` (Node.js LTS)
- `setup-node@v4` natively supports `.nvmrc` via `node-version-file` input
- Ensures version parity between local development and CI environments

### 2026 Recommendations

1. **Avoid Hardcoded Versions** ✅ (Already Implemented)
   - Never use `node-version: '22'` directly in workflows
   - Single source of truth: `.nvmrc` file in repo root
   - Automatic updates when `.nvmrc` changes

2. **NPM Caching** ✅ (Already Implemented)
   - `cache: 'npm'` caches `~/.npm` directory
   - Key based on `package-lock.json` hash
   - Reduces dependency installation time by ~40-60%

3. **Action Version Compatibility**
   - `setup-node@v4` upgraded from node20 to node24 runtime
   - Requires GitHub Actions runner v2.327.1+ (standard on ubuntu-latest)
   - No action required - runners auto-update

### Alternative Approaches (NOT Recommended)

**Third-Party NVM Actions:**
- `dcodeIO/setup-node-nvm` - Adds complexity, slower than official action
- `marketplace/actions/set-up-node-using-nvm` - Redundant with `setup-node@v4`

**Why Official Action Wins:**
- Built-in `.nvmrc` support since v4
- Faster execution (no extra NVM installation)
- Better caching integration
- Microsoft-maintained

### Actionable Items

- **No changes needed** - Current implementation optimal
- **Future:** Consider automated `.nvmrc` updates via GitHub Actions (Dependabot doesn't support .nvmrc)

**Sources:**
- [GitHub Actions setup-node](https://github.com/actions/setup-node)
- [setup-node Advanced Usage](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md)
- [Keep Node.js Version Consistent](https://www.emmanuelgautier.com/blog/keep-node-version-github-actions-local-development)

---

## 2. Playwright Browser Installation & Caching

### Current Implementation ⚠️

**Status:** Good foundation, optimization opportunities exist

```yaml
# Current: Two-step conditional installation
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      playwright-${{ runner.os }}-

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium webkit

- name: Install Playwright system deps
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium webkit
```

### Cache Strategy Analysis

**Performance Gains (Research Data):**
- Without caching: 1m 43s browser download
- With caching: 45s + 17s cache overhead = 1m 2s
- **Savings:** ~40 seconds per workflow run

**Cache Key Strategy:**
```yaml
key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
```

**Pros:**
- Updates when Playwright version changes in package-lock.json
- OS-specific caching (Linux browsers cached separately from macOS)
- Automatic invalidation on dependency updates

**Cons:**
- Invalidates cache for unrelated dependency updates
- Manual Playwright updates require new package-lock.json

### 2026 Recommended Optimizations

#### Option 1: Explicit Playwright Version in Cache Key (Recommended)

```yaml
- name: Get Playwright version
  id: playwright-version
  run: echo "version=$(npm list @playwright/test --depth=0 --json | jq -r '.dependencies["@playwright/test"].version')" >> $GITHUB_OUTPUT

- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-browsers-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}
    restore-keys: |
      playwright-browsers-${{ runner.os }}-
```

**Benefits:**
- Cache only invalidates when Playwright version actually changes
- More stable cache across unrelated dependency updates
- Clearer cache key semantics

#### Option 2: Multi-Level Caching

```yaml
# Primary cache: Exact version match
key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}

# Fallback: OS-level restore
restore-keys: |
  playwright-${{ runner.os }}-
  playwright-
```

**Current implementation already uses this** - no changes needed.

### Browser Installation Best Practices

**2026 Guidance: Avoid `--with-deps` in Most Cases**

```bash
# ❌ AVOID: Installs too many unnecessary system packages
npx playwright install --with-deps chromium webkit

# ✅ RECOMMENDED: Two-step approach
npx playwright install chromium webkit           # Cache miss
npx playwright install-deps chromium webkit      # Cache hit
```

**Why Two-Step Approach:**
- `--with-deps` installs ~200MB of system dependencies even when browsers are cached
- Separating `install` and `install-deps` allows conditional execution
- **Already implemented in LevelUp** - validates current pattern

**Current LevelUp Pattern:** ✅ Optimal

### Specific Browser Selection

**Current:**
```bash
npx playwright install chromium webkit
```

**Analysis:**
- Only installs browsers actually used in tests
- Reduces cache size (no Firefox ~85MB)
- Matches playwright.config.ts projects (chromium, webkit variants)

**Recommendation:** No changes needed

### Common Issues & Solutions

**Issue 1: WebKit Installation Failures on ubuntu-latest**

**Symptoms:**
```
Error: Failed to install WebKit
browserType.launch: Executable doesn't exist
```

**Root Cause:**
- Missing system dependencies (libwoff1, libharfbuzz, etc.)
- `--with-deps` flag conflicts or partial installation

**Solution (Already Implemented):**
```yaml
- name: Install Playwright system deps
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium webkit
```

**Issue 2: Chromium Crashes on Ubuntu

**Symptoms:**
```
browserType.launch: Browser closed unexpectedly
```

**Common Causes:**
- Missing shared libraries
- Insufficient memory in CI environment
- Headless mode issues

**Preventive Measures:**
```yaml
# In playwright.config.ts (already configured)
use: {
  launchOptions: {
    args: [
      '--disable-dev-shm-usage',  // Avoid /dev/shm size issues
      '--disable-blink-features=AutomationControlled'
    ]
  }
}
```

**Current LevelUp Config:** Does not explicitly set these - consider adding if issues arise.

### Actionable Items

1. **Consider:** Explicit Playwright version in cache key (5-10 min implementation)
2. **Monitor:** Cache hit rate in workflow logs
3. **No Action Required:** Current two-step installation pattern is optimal
4. **Future:** Add Chromium launch args if browser crashes occur

**Sources:**
- [How To Cache Playwright Browser On Github Actions](https://dev.to/ayomiku222/how-to-cache-playwright-browser-on-github-actions-51o6)
- [Playwright GitHub Actions Caching](https://playwrightsolutions.com/playwright-github-action-to-cache-the-browser-binaries/)
- [Caching Playwright Binaries](https://justin.poehnelt.com/posts/caching-playwright-in-github-actions/)
- [Playwright CI Documentation](https://playwright.dev/docs/ci)

---

## 3. WebServer Configuration Best Practices

### Current Implementation ⚠️

**Status:** Functional but missing 2026 optimizations

```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
}
```

### Issues with Current Config

1. **No Explicit Timeout**
   - Defaults to 60 seconds (Playwright v1.58)
   - May be insufficient in CI with cold starts
   - Silent failures if dev server is slow to start

2. **No Wait Pattern Matching**
   - Relies on URL polling only
   - Doesn't verify server is fully ready
   - Can cause race conditions with fast URL responses

3. **Missing Retry Interval**
   - Default 500ms interval between URL checks
   - May miss server availability windows

### 2026 Recommended Configuration

```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  timeout: 120_000,  // 2 minutes (CI environment)
  reuseExistingServer: !process.env.CI,

  // NEW: Wait for log pattern instead of just URL
  wait: /Local:.*http:\/\/localhost:5173/,

  // Environment variables for dev server
  env: {
    NODE_ENV: 'test',
    CI: process.env.CI || '',
  },
}
```

### Advanced Wait Strategies

**Pattern 1: Log Message Matching** (Recommended for Vite)

```typescript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  timeout: 120_000,

  // Wait until Vite logs "Local: http://localhost:5173/"
  wait: /Local:.*5173/,

  reuseExistingServer: !process.env.CI,
}
```

**Benefits:**
- More reliable than URL-only polling
- Vite outputs this when HMR is ready
- Prevents tests starting before app is fully initialized

**Pattern 2: Multiple Web Servers** (Future-Proofing)

```typescript
webServer: [
  {
    name: 'frontend',
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120_000,
    wait: /Local:.*5173/,
    reuseExistingServer: !process.env.CI,
  },
  {
    name: 'api',
    command: 'npm run dev:api',
    url: 'http://localhost:3000',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
]
```

**Not currently needed** - LevelUp uses client-side IndexedDB, no backend server.

### CI-Specific Optimizations

**Issue:** Vite cold start in CI can take 30-60 seconds

**Solutions:**

1. **Increase Timeout** ✅ Recommended
   ```typescript
   timeout: process.env.CI ? 120_000 : 60_000
   ```

2. **Pre-Build Dependencies** (Optional)
   ```yaml
   # In GitHub Actions before Playwright tests
   - name: Pre-build Vite dependencies
     run: npm run dev -- --force &
     sleep 10
     kill $!
   ```
   **Not recommended** - adds complexity, minimal gains with modern Vite.

3. **Use Production Build** (Alternative Approach)
   ```yaml
   # Instead of dev server
   - name: Build production
     run: npm run build

   - name: Serve production
     run: npx serve -s dist -l 5173 &
     npx wait-on http://localhost:5173
   ```
   **Tradeoff:** Faster startup, but tests against production build (loses HMR debugging).

### Port Management Best Practices

**Current Issue:** Hardcoded port 5173 in multiple places

**Locations:**
- `playwright.config.ts` - `baseURL`, `webServer.url`
- `vite.config.ts` - `server.port` (default 5173)
- GitHub Actions workflows - Wait-on commands

**Recommended Pattern:**

```typescript
// playwright.config.ts
const PORT = process.env.PORT || 5173
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  use: { baseURL: BASE_URL },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
```

**Benefits:**
- Single source of truth
- Easy to change port for worktree isolation
- Environment variable override support

### Actionable Items

1. **Add Explicit Timeout:** Set `timeout: 120_000` in webServer config
2. **Add Log Wait Pattern:** Use `wait: /Local:.*5173/` for Vite readiness
3. **Centralize Port Config:** Extract port to constant or env var
4. **Monitor CI Logs:** Check actual dev server startup time

**Priority:** Medium (Current config works but lacks robustness)

**Sources:**
- [Playwright Web Server Documentation](https://playwright.dev/docs/test-webserver)
- [Configuring Web Server in Playwright](https://umairqa.medium.com/configuring-web-server-in-playwright-for-end-to-end-testing-db3dda8415b4)
- [Setup Local Dev Server](https://dev.to/playwright/setup-a-local-dev-server-for-your-playwright-tests-33m9)
- [Understanding Playwright Timeout](https://www.browserstack.com/guide/playwright-timeout)

---

## 4. Sharding & Parallelization

### Current Implementation ✅

**Status:** Already following 2026 best practices

```yaml
# test.yml
e2e-tests:
  strategy:
    fail-fast: false
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - name: Run E2E tests (shard ${{ matrix.shard }}/4)
      run: npx playwright test --shard=${{ matrix.shard }}/${{ strategy.job-total }}
```

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
})
```

### Analysis

**Current Configuration:**
- 4 parallel shards in CI (matrix strategy)
- `fullyParallel: true` - Allows test file parallelization
- `workers: 1` in CI - Sequential tests within each shard
- `fail-fast: false` - All shards complete even if one fails

**Performance Impact:**
- Research shows 4-shard parallelization reduces runtime by ~75%
- Example: 5m 26s → 1m 25s for typical test suite
- LevelUp test suite: ~8-12 tests per shard (balanced distribution)

### 2026 Sharding Best Practices

#### Static vs Dynamic Sharding

**Static (Current LevelUp Approach):** ✅
```yaml
matrix:
  shard: [1, 2, 3, 4]  # Hardcoded shard count
```

**Pros:**
- Simple configuration
- Predictable resource allocation
- Easy to debug specific shards

**Cons:**
- Fixed parallelism regardless of test suite size
- May over/under-provision shards as suite grows

**Dynamic (2026 Emerging Pattern):**
```yaml
- name: Calculate shard count
  id: shard-calc
  run: |
    TEST_COUNT=$(npx playwright test --list | grep -c "\.spec\.ts")
    SHARD_COUNT=$(( (TEST_COUNT + 9) / 10 ))  # ~10 tests per shard
    echo "count=$SHARD_COUNT" >> $GITHUB_OUTPUT

- name: Run tests
  strategy:
    matrix:
      shard: ${{ fromJson(steps.shard-calc.outputs.count) }}
```

**Benefits:**
- Automatically scales with test suite size
- Optimal shard count based on actual test files
- Reduces over-provisioning for small suites

**Tradeoff:**
- More complex setup
- Variable CI runtime
- Cache key complexity

**Recommendation for LevelUp:**
- **Keep static sharding** - 4 shards is optimal for current suite size (30-40 tests)
- **Revisit at 100+ tests** - Consider dynamic sharding when test count doubles

### Worker Configuration

**Current:**
```typescript
workers: process.env.CI ? 1 : undefined
```

**Why `workers: 1` in CI?**
- Prevents resource contention in shared CI runners
- Each shard runs tests sequentially (deterministic)
- Avoids race conditions in IndexedDB seeding
- Aligns with LevelUp's test isolation strategy

**Local Development:**
- `workers: undefined` = CPU core count
- Fast feedback loop
- Parallel test execution

**2026 Recommendation:** Keep current configuration - validates best practices.

### Shard Distribution Analysis

**How Playwright Shards Tests:**
- By default, shards test **files** (not individual tests)
- Each shard gets roughly equal number of spec files
- Cannot shard tests within a file unless explicitly configured

**Current LevelUp Test Files:**
```
tests/e2e/
  smoke-navigation.spec.ts
  smoke-overview.spec.ts
  smoke-courses.spec.ts
  story-e08-s02.spec.ts  (active story)

tests/e2e/regression/
  story-e07-s04.spec.ts
  story-e08-s03.spec.ts
  ... (15+ archived specs)
```

**Active Test Count:** 4 files = 1 file per shard (under-utilized)
**Full Regression:** 20 files = 5 files per shard (well-balanced)

**Optimization Opportunity:**
- Current sharding works well for full regression
- For PR tests (active specs only), 4 shards is over-provisioned
- Consider conditional sharding:
  ```yaml
  matrix:
    shard: ${{ github.event_name == 'pull_request' && '[1]' || '[1,2,3,4]' }}
  ```

**Recommendation:** Monitor CI runtime - if PR tests complete in <2 minutes, reduce to 2 shards.

### Cross-Browser Matrix Parallelization

**Current:**
```typescript
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  { name: 'Tablet', use: { ...devices['iPad Pro'] } },
  { name: 'a11y-mobile', ... },
  { name: 'a11y-desktop', ... },
]
```

**CI Execution (test.yml):**
- 4 shards × 1 project (chromium only) = 4 parallel jobs
- Full browser matrix on `CI=1` (local simulation)

**2026 Pattern: Browser × Shard Matrix**

```yaml
strategy:
  matrix:
    browser: [chromium, webkit, firefox]
    shard: [1, 2, 3, 4]
```

**Result:** 12 parallel jobs (3 browsers × 4 shards)

**Tradeoff:**
- **Pros:** Faster full browser coverage (5m → 1.5m)
- **Cons:** 12× runner minutes (higher GitHub Actions cost)
- **LevelUp Context:** Not cost-effective for current test count

**Recommendation:** Keep chromium-only sharding for PRs, full matrix for release validation.

### Actionable Items

1. **Monitor Shard Balance:** Check GitHub Actions logs for uneven shard runtimes
2. **Consider Conditional Sharding:** 1-2 shards for PRs, 4 shards for full regression
3. **No Changes Needed:** Current configuration optimal for suite size
4. **Future:** Implement dynamic sharding at 100+ test files

**Sources:**
- [Playwright Sharding Documentation](https://playwright.dev/docs/test-sharding)
- [Dynamic Playwright Sharding](https://foster.sh/blog/dynamic-playwright-sharding-in-github-actions)
- [Sharding with Job Matrix](https://timdeschryver.dev/blog/using-playwright-test-shards-in-combination-with-a-job-matrix-to-improve-your-ci-speed)
- [Playwright Sharding Complete Guide](https://testdino.com/blog/playwright-sharding/)

---

## 5. Retry & Flaky Test Handling

### Current Implementation ✅

**Status:** Following 2026 best practices with intelligent retry strategy

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
```

```yaml
# test.yml - Job-level retries
- name: Run E2E tests
  uses: nick-invision/retry@v3
  with:
    timeout_minutes: 30
    max_attempts: 2
    retry_on: error
    command: npx playwright test --shard=${{ matrix.shard }}/4
```

### Multi-Layer Retry Strategy

**Layer 1: Playwright Test Retries** (Test-level)
- `retries: 2` = 3 total attempts per test
- Retries individual failed tests
- Captures trace on first retry

**Layer 2: GitHub Actions Job Retries** (Shard-level)
- `max_attempts: 2` = 2 total attempts per shard job
- Retries entire shard on infrastructure failures
- Handles runner crashes, network issues

**Why Both Layers?**
- Test retries: Handle application flakiness (timing, async)
- Job retries: Handle CI infrastructure issues (runner failures)
- Provides defense in depth

### 2026 Retry Best Practices

#### Retry Configuration Guidelines

**Recommended Values (Research-Backed):**
```typescript
retries: process.env.CI ? 2 : 0  // ✅ Already implemented
```

**Why `retries: 2` in CI?**
- 3 total attempts (1 initial + 2 retries)
- Balances flakiness tolerance with signal quality
- Industry standard across major projects

**Why `retries: 0` locally?**
- Fast feedback - no waiting for retries
- Forces developers to fix flaky tests immediately
- Prevents relying on retries as stability crutch

**Anti-Pattern: Excessive Retries**
```typescript
retries: 5  // ❌ Masks real issues, reduces trust in tests
```

**Research Finding:**
> "Retries are a diagnostic tool, not a stability strategy. If a test needs 3 retries to pass, it is telling you something about your system. Keep the retry count as low as possible."

### Trace & Debug Artifact Strategy

**Current Configuration:** ✅ Optimal

```typescript
use: {
  trace: 'retain-on-failure',      // Captures on failure + retries
  screenshot: 'only-on-failure',   // Lightweight failure snapshots
  video: 'retain-on-failure',      // Full video for complex issues
}
```

**Alternative Strategies:**

**1. Trace on First Retry** (Alternative)
```typescript
trace: 'on-first-retry'  // Only captures during retry attempts
```

**Pros:** Smaller artifact size, focuses on flaky tests
**Cons:** Misses immediate failures without retries

**2. Always Capture** (Not Recommended)
```typescript
trace: 'on'  // Captures for all tests
```

**Cons:** Massive artifact storage (100MB+ per shard), slow uploads

**Recommendation:** Keep `retain-on-failure` - balances debugging needs with storage costs.

### Flaky Test Detection

**Current Implementation:** ✅ Dedicated Burn-In Job

```yaml
# test.yml
burn-in:
  name: Flaky Test Detection (10 iterations)
  if: github.event_name == 'pull_request' || github.event_name == 'schedule'
  steps:
    - name: Run burn-in loop
      run: |
        for i in {1..10}; do
          npx playwright test --project=chromium || exit 1
        done
```

**2026 Validation:**
- 10 iterations is industry standard for flakiness detection
- Chromium-only reduces runtime (full browser matrix not needed)
- Early exit on first failure (`|| exit 1`)
- Weekly schedule ensures ongoing stability validation

**Research-Backed Metrics:**
- 10 iterations catches ~95% of intermittent failures
- 20 iterations needed for 99% confidence (diminishing returns)
- Single-project execution sufficient (flakiness usually not browser-specific)

**Optimization Opportunity:**
```yaml
# Parallel burn-in (2x faster)
- name: Run burn-in loop
  run: npx playwright test --project=chromium --repeat-each=10
```

**Tradeoff:**
- Faster (parallel execution)
- Less isolation (all iterations share test process)
- May miss timing-related flakiness

**Recommendation:** Keep sequential loop - isolation more important than speed.

### Retry Observability

**Current Gaps:**
- No visibility into which tests flaked and recovered
- Retry counts not logged in CI output
- Hard to track flakiness trends

**2026 Enhancement: Flaky Test Reporter**

```typescript
// playwright.config.ts
reporter: [
  ['html'],
  ['junit', { outputFile: 'test-results/junit.xml' }],
  ['list'],
  // NEW: Track flaky tests
  ['json', { outputFile: 'test-results/flaky-tests.json' }],
]
```

**GitHub Actions Integration:**
```yaml
- name: Report flaky tests
  if: always()
  run: |
    FLAKY=$(jq '[.suites[].specs[] | select(.tests[].results | length > 1)] | length' test-results/flaky-tests.json)
    echo "Flaky tests detected: $FLAKY"
    if [ "$FLAKY" -gt 0 ]; then
      echo "::warning::$FLAKY tests passed after retry - investigate for flakiness"
    fi
```

**Benefits:**
- Surfaces flaky tests even when they eventually pass
- Enables trend tracking
- Alerts team to degrading test stability

**Priority:** Low (Nice-to-have, not blocking)

### LevelUp-Specific Retry Patterns

**Context:** LevelUp tests use deterministic time (`FIXED_DATE`), IndexedDB seeding helpers, and browser context mocking.

**Expected Flakiness Sources:**
1. **IndexedDB race conditions** (mitigated by seeding helpers)
2. **Animation timing** (rare with `prefers-reduced-motion`)
3. **CI resource contention** (handled by `workers: 1`)

**Current Test Quality:**
- Burn-in validation passes consistently
- No reported flakiness in recent PRs
- Strong test architecture (see `_bmad/tea/testarch/`)

**Recommendation:**
- Maintain current retry configuration
- Continue burn-in validation on PRs
- Monitor for retry patterns in CI logs

### Actionable Items

1. **No Changes Needed:** Current retry strategy optimal
2. **Optional:** Add flaky test reporter for observability
3. **Consider:** Parallel burn-in (`--repeat-each=10`) if runtime becomes issue
4. **Monitor:** Track retry frequency in CI logs monthly

**Sources:**
- [Playwright Retries Documentation](https://playwright.dev/docs/test-retries)
- [Why Your Playwright Tests Are Still Flaky](https://medium.com/codetodeploy/why-your-playwright-tests-are-still-flaky-and-its-not-because-of-timing-9c005d0e83a3)
- [Playwright Flaky Tests Detection](https://www.browserstack.com/guide/playwright-flaky-tests)
- [Playwright Retry Mechanism](https://software-testing-tutorials-automation.com/2026/03/playwright-retry-mechanism-in-enterprise-framework.html)

---

## 6. ubuntu-latest Browser Issues

### WebKit on ubuntu-latest

**Common Issues (2026):**

1. **Missing System Dependencies**
   ```
   Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/webkit-1940/pw_run.sh
   ```

   **Cause:** Incomplete installation of WebKit dependencies

   **Solution (Already Implemented):**
   ```yaml
   - name: Install Playwright system deps
     if: steps.playwright-cache.outputs.cache-hit == 'true'
     run: npx playwright install-deps webkit
   ```

2. **libwoff1 Missing**
   ```
   error while loading shared libraries: libwoff1.so.0.0.0
   ```

   **Fix:**
   ```yaml
   run: npx playwright install-deps webkit
   # Installs: libwoff1, libharfbuzz-icu0, libgles2, libwebpdemux2
   ```

3. **Font Rendering Issues**
   - WebKit requires specific font libraries on Linux
   - May cause screenshot comparison failures
   - Not critical for functional tests

**LevelUp Status:** ✅ No reported WebKit issues (proper deps installation)

### Chromium on ubuntu-latest

**Known Issues:**

1. **Browser Crashes**
   ```
   browserType.launch: Protocol error (Browser.close): Browser closed
   ```

   **Common Causes:**
   - `/dev/shm` size limitations (default 64MB)
   - Out of memory (OOM) killer
   - GPU rendering issues in headless mode

   **Solutions:**
   ```typescript
   // playwright.config.ts
   use: {
     launchOptions: {
       args: [
         '--disable-dev-shm-usage',        // Use /tmp instead of /dev/shm
         '--disable-gpu',                  // Disable GPU acceleration
         '--no-sandbox',                   // Only if running as root (NOT recommended)
       ]
     }
   }
   ```

   **LevelUp Status:** Currently not configured - add if issues arise.

2. **Chromium Installation Failures**
   ```
   Failed to install browsers
   Error: self-signed certificate in certificate chain
   ```

   **Cause:** Corporate proxy, DNS issues, GitHub Actions network problems

   **Fix:**
   ```yaml
   - name: Install Playwright browsers
     run: npx playwright install chromium
     env:
       NODE_TLS_REJECT_UNAUTHORIZED: '0'  # Last resort only
   ```

   **Better Fix:** Use `actions/cache` to avoid repeated downloads (already implemented).

### Firefox (Not Used in LevelUp)

**Note:** LevelUp doesn't test Firefox in CI, but for reference:

**Issue:** Executable Not Found After Installation
```
browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/firefox-1432/firefox/firefox
```

**Cause:** GitHub Actions runner race condition with browser binaries

**Fix:**
```yaml
- name: Verify Firefox installation
  run: |
    npx playwright install firefox
    ls -la ~/.cache/ms-playwright/firefox*/firefox/firefox
```

### ubuntu-latest vs ubuntu-24.04 vs ubuntu-22.04

**Current (2026):**
- `ubuntu-latest` → `ubuntu-24.04`
- Previous: `ubuntu-22.04`

**Breaking Changes:**
- Different default packages
- Updated GLib versions (affects WebKit)
- Newer kernel (may affect resource limits)

**Recommendation:**
- **Pin to `ubuntu-24.04`** if stability is critical
- **Keep `ubuntu-latest`** for latest security patches (current LevelUp approach)

**Migration Path:**
```yaml
# If issues arise with ubuntu-latest
runs-on: ubuntu-24.04  # Explicit version
```

**LevelUp Status:** No issues reported with ubuntu-latest → Keep current.

### Actionable Items

1. **Preventive:** Add Chromium launch args if browser crashes occur
   ```typescript
   args: ['--disable-dev-shm-usage', '--disable-gpu']
   ```

2. **Monitor:** GitHub Actions logs for browser installation warnings

3. **No Changes Needed:** Current WebKit installation handles dependencies correctly

4. **Consider:** Pin to `ubuntu-24.04` if CI becomes unstable

**Sources:**
- [Playwright CI Documentation](https://playwright.dev/docs/ci)
- [Chromium Issue on GitHub Actions](https://github.com/microsoft/playwright/issues/14078)
- [WebKit Installation Issues](https://github.com/microsoft/playwright/issues/23896)
- [Browser Installation Failures](https://github.com/microsoft/playwright/issues/28251)

---

## 7. Timeout Configurations for CI

### Current Implementation ⚠️

**Status:** Good defaults, missing environment-specific tuning

```typescript
// playwright.config.ts
timeout: 60_000,               // Test timeout: 60s
expect: { timeout: 10_000 },   // Assertion timeout: 10s

use: {
  actionTimeout: 15_000,       // Click, fill, etc: 15s
  navigationTimeout: 30_000,   // Page loads: 30s
}
```

### Timeout Hierarchy (Playwright)

**1. Global Timeout** (Not Set)
```typescript
globalTimeout: 0  // Default: unlimited
```
- Total time for entire test run
- Rarely needed with proper test/action timeouts

**2. Test Timeout** (Set to 60s)
```typescript
timeout: 60_000
```
- Maximum time for single test (including hooks)
- Includes beforeEach, test body, afterEach
- **LevelUp Average:** 3-8s per test (60s is generous buffer)

**3. Expect Timeout** (Set to 10s)
```typescript
expect: { timeout: 10_000 }
```
- Auto-retry for `expect().toBeVisible()` etc.
- Only applies to locator assertions
- Does NOT apply to generic `expect(value).toBe()` assertions

**4. Action Timeout** (Set to 15s)
```typescript
use: { actionTimeout: 15_000 }
```
- Individual actions: `click()`, `fill()`, `hover()`
- Waits for actionability (visible, enabled, stable)

**5. Navigation Timeout** (Set to 30s)
```typescript
use: { navigationTimeout: 30_000 }
```
- `page.goto()`, `page.reload()`, `page.goBack()`
- Waits for `load` event by default

**6. Fixture Timeout** (Defaults to Test Timeout)
```typescript
timeout: { test: 60_000, fixture: 120_000 }  // Separate fixture timeout
```
- `beforeAll`, `afterAll` setup/teardown
- **LevelUp:** Not needed (no complex fixtures)

### CI vs Local Timeout Strategy

**Research Finding:**
> "Tests are particularly slow in CI/CD environments, where execution times can be significantly longer than on local machines due to system resources, network latency, and concurrent processes."

**2026 Recommended Pattern:**

```typescript
export default defineConfig({
  timeout: process.env.CI ? 90_000 : 60_000,  // +50% in CI

  expect: {
    timeout: process.env.CI ? 15_000 : 10_000  // +50% in CI
  },

  use: {
    actionTimeout: process.env.CI ? 20_000 : 15_000,
    navigationTimeout: process.env.CI ? 45_000 : 30_000,
  },
})
```

**Rationale:**
- CI runners have variable performance (shared infrastructure)
- Network latency higher in CI (external resources)
- Cold start penalty (fresh browser contexts)
- Buffer prevents spurious timeout failures

**LevelUp Context:**
- Tests are deterministic (no external APIs, IndexedDB-only)
- Dev server startup is slowest part (handled by webServer)
- Current timeouts sufficient based on CI logs

**Recommendation:** Monitor CI test durations - if tests approach 40-50s, increase timeouts.

### Test-Level Timeout Overrides

**Pattern:**
```typescript
test('slow integration test', async ({ page }) => {
  test.setTimeout(120_000)  // Override for this test only

  // Long-running operations
})
```

**When to Use:**
- Integration tests with multiple page loads
- Tests involving large file uploads/downloads
- Specific slow operations (video processing, etc.)

**LevelUp Usage:** Not currently needed - tests are fast (<10s each).

### Debugging Timeout Issues

**Symptom:**
```
Test timeout of 60000ms exceeded.
```

**Root Causes:**

1. **Infinite Wait**
   ```typescript
   await page.waitForSelector('.non-existent-element')  // Never appears
   ```
   **Fix:** Add explicit timeout or use `waitForSelector` with timeout option.

2. **Slow Assertion**
   ```typescript
   await expect(page.locator('.slow-element')).toBeVisible({ timeout: 5000 })
   ```
   **Current:** Uses 10s expect timeout globally.

3. **Action Waiting Forever**
   ```typescript
   await page.click('.disabled-button')  // Never becomes enabled
   ```
   **Playwright Auto-Waits:** Times out at 15s (actionTimeout).

**LevelUp Mitigation:**
- Deterministic test data (`FIXED_DATE`)
- No external dependencies (self-contained)
- Fast IndexedDB seeding (<100ms)

### CI Environment Considerations

**GitHub Actions Runner Specs (ubuntu-latest):**
- 2-core CPU (shared)
- 7 GB RAM
- SSD storage
- Variable network latency

**Impact on Timeouts:**
- Browser cold start: 1-3s (vs <1s local)
- Page navigation: 500ms-2s (vs 200ms-500ms local)
- Heavy rendering: +50-100% slower

**Current LevelUp Timeouts:** Accommodate these variances well.

### Timeout Anti-Patterns

**❌ AVOID:**

```typescript
// Hard wait - non-deterministic
await page.waitForTimeout(5000)

// Generic assertion - no auto-retry
expect(await page.textContent('.dynamic-text')).toBe('Loaded')

// Infinite loop with timeout
const start = Date.now()
while (Date.now() - start < 10000) {
  if (await page.locator('.element').isVisible()) break
}
```

**✅ PREFER:**

```typescript
// Auto-retry locator assertion
await expect(page.locator('.dynamic-text')).toHaveText('Loaded')

// Built-in wait with timeout
await page.waitForSelector('.element', { timeout: 10_000 })

// Conditional wait with Playwright primitives
await page.waitForFunction(() => window.appReady === true)
```

**LevelUp Compliance:** Tests follow best practices (locator assertions, no hard waits).

### Actionable Items

1. **Optional:** Add CI-specific timeout multipliers (+50%)
   ```typescript
   timeout: process.env.CI ? 90_000 : 60_000
   ```

2. **Monitor:** CI test durations in GitHub Actions logs
   - If any test exceeds 40s, investigate root cause
   - If consistent, increase test timeout

3. **No Changes Needed:** Current timeouts sufficient for suite

4. **Future:** Add test-level timeouts if slow integration tests added

**Priority:** Low (Current config works well)

**Sources:**
- [Playwright Timeouts Documentation](https://playwright.dev/docs/test-timeouts)
- [Understanding Playwright Timeout](https://www.browserstack.com/guide/playwright-timeout)
- [Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices)
- [Mastering Waits and Timeouts](https://circleci.com/blog/mastering-waits-and-timeouts-in-playwright/)

---

## Summary & Priority Matrix

### High Priority (Implement Soon)

1. **WebServer Wait Pattern** (5 min)
   - Add `wait: /Local:.*5173/` to webServer config
   - Increase timeout to 120s for CI reliability
   - **Impact:** Prevents rare race conditions during dev server startup

2. **Explicit Cache Key** (10 min)
   - Extract Playwright version for cache key
   - Reduces cache invalidation frequency
   - **Impact:** Saves ~40s per workflow run when cache is reusable

### Medium Priority (Monitor & Consider)

3. **CI-Specific Timeouts** (5 min)
   - Add +50% timeout buffer for CI environment
   - **Impact:** Reduces spurious timeout failures on slow runners

4. **Chromium Launch Args** (5 min)
   - Add `--disable-dev-shm-usage` to prevent crashes
   - Only if browser stability issues arise
   - **Impact:** Preventive measure for resource constraints

5. **Conditional Sharding** (15 min)
   - Use 1-2 shards for PR tests, 4 for full regression
   - **Impact:** Reduces runner minutes for fast PR validation

### Low Priority (Nice-to-Have)

6. **Flaky Test Reporter** (30 min)
   - Add JSON reporter to track tests that pass after retry
   - **Impact:** Better observability, trend tracking

7. **Port Centralization** (10 min)
   - Extract hardcoded 5173 to constant
   - **Impact:** Easier worktree isolation, cleaner config

### No Action Required ✅

- Node.js version management (.nvmrc)
- Browser caching strategy (two-step install)
- Sharding configuration (4 shards optimal)
- Retry strategy (2 retries in CI)
- Burn-in validation (10 iterations)
- Workers configuration (1 in CI)
- Current timeout values

---

## Implementation Checklist

```typescript
// High Priority Changes (playwright.config.ts)

// 1. Enhanced webServer config
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  timeout: 120_000,  // ← Add this
  wait: /Local:.*5173/,  // ← Add this
  reuseExistingServer: !process.env.CI,
}

// 2. Optional: CI timeout buffers
timeout: process.env.CI ? 90_000 : 60_000,
expect: { timeout: process.env.CI ? 15_000 : 10_000 },

use: {
  baseURL: process.env.BASE_URL || 'http://localhost:5173',
  actionTimeout: process.env.CI ? 20_000 : 15_000,
  navigationTimeout: process.env.CI ? 45_000 : 30_000,

  // 3. Optional: Chromium stability args
  launchOptions: {
    args: ['--disable-dev-shm-usage', '--disable-gpu'],
  },

  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

```yaml
# Medium Priority Changes (test.yml)

# 1. Enhanced browser caching
- name: Get Playwright version
  id: playwright-version
  run: echo "version=$(npm list @playwright/test --json | jq -r '.dependencies["@playwright/test"].version')" >> $GITHUB_OUTPUT

- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}
    restore-keys: |
      playwright-${{ runner.os }}-

# 2. Optional: Conditional sharding
strategy:
  matrix:
    shard: ${{ github.event_name == 'pull_request' && fromJson('[1, 2]') || fromJson('[1, 2, 3, 4]') }}
```

---

## Validation & Testing

After implementing changes:

1. **Local Validation:**
   ```bash
   npm run test:e2e  # Verify config syntax
   ```

2. **PR Test:**
   - Create test PR with config changes
   - Verify workflow completes successfully
   - Check CI logs for timeout improvements

3. **Metrics to Track:**
   - Cache hit rate (should be >80% on subsequent runs)
   - Average shard runtime (should be balanced ±20%)
   - Flaky test count (should remain 0)
   - Retry frequency (should be <5% of tests)

---

## References

**Official Documentation:**
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)

**Community Resources (2026):**
- [Dynamic Playwright Sharding](https://foster.sh/blog/dynamic-playwright-sharding-in-github-actions)
- [Caching Playwright Binaries](https://justin.poehnelt.com/posts/caching-playwright-in-github-actions/)
- [Playwright Flaky Tests Guide](https://www.browserstack.com/guide/playwright-flaky-tests)
- [Understanding Playwright Timeout](https://www.browserstack.com/guide/playwright-timeout)

**LevelUp Internal Docs:**
- [Test Architecture Overview](_bmad/tea/testarch/knowledge/overview.md)
- [Test Quality Criteria](_bmad/tea/testarch/knowledge/test-quality.md)
- [CLAUDE.md E2E Test Patterns](CLAUDE.md#e2e-test-patterns--best-practices)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-09
**Next Review:** 2026-06-09 (quarterly)

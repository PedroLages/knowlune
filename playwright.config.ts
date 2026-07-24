import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testIgnore: [
    process.env.RUN_REGRESSION ? undefined : '**/regression/**',
    process.env.RUN_ANALYSIS ? undefined : '**/analysis/**',
    process.env.RUN_DEBUG ? undefined : '**/debug/**',
  ].filter(Boolean),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Pull-request failures should be actionable on the first run. The scheduled
  // burn-in job owns repeat coverage instead of multiplying every CI failure.
  retries: 0,
  // Two workers fit the hosted runner while workflow-level sharding supplies
  // the remaining parallelism.
  workers: process.env.CI ? 2 : undefined,

  // Standardized timeouts (TEA knowledge base: playwright-config)
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Multiple reporters: HTML (visual), JUnit (CI), list (console)
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Failure-only artifact capture
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // CI traces and screenshots are sufficient for diagnosis. Failure videos
    // made each timed-out shard artifact hundreds of megabytes.
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },
    // Accessibility testing specific viewports
    {
      name: 'a11y-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
      testMatch: '**/accessibility.spec.ts',
    },
    {
      name: 'a11y-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: '**/accessibility.spec.ts',
    },
  ],

  webServer: {
    command: 'PLAYWRIGHT_TEST=1 npm run dev',
    url: 'http://localhost:5173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // GitHub Actions intentionally has no production Supabase secrets. A
    // deterministic test client lets auth lifecycle and page.route() mocks
    // initialize without making the E2E suite depend on a live backend.
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://knowlune.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key',
    },
  },
})

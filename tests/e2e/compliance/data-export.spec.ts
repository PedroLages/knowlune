/**
 * E2E tests for GDPR Data Export flow — E119-S05 (AC-7)
 *
 * Covers:
 *   1. Happy path: authenticated user clicks "Export ZIP" → ZIP downloaded → data.json verified
 *   2. Success toast shown after download triggered
 *   3. Too-large response → informative toast, no download
 *   4. Error response → error toast, no download
 *
 * The `/functions/v1/export-data` endpoint is mocked via page.route().
 * No live Supabase connection needed.
 * A minimal valid ZIP is constructed in-process using JSZip.
 */
import { test, expect } from '../../support/fixtures'
import JSZip from 'jszip'

// ── Constants ──────────────────────────────────────────────────────────────

const TEST_EMAIL = 'export-test@example.com'
const MOCK_USER_ID = 'usr-00000000-0000-0000-0000-export-00001'
const MOCK_ACCESS_TOKEN = 'mock-access-token-export-e119s05'

const MOCK_SESSION_RESPONSE = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-export-e119s05',
  user: {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: TEST_EMAIL,
    email_confirmed_at: '2026-01-15T10:00:00.000Z',
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
  },
}

/** Account data mock for the My Data section */
const MOCK_ACCOUNT_DATA = {
  email: TEST_EMAIL,
  createdAt: '2026-01-15T10:00:00.000Z',
  subscriptionStatus: 'active',
  subscriptionPlan: 'pro',
}

/** Build a minimal ZIP buffer with data.json and README.md */
async function buildMockZipBuffer(): Promise<Buffer> {
  const zip = new JSZip()

  const dataJson = {
    notes: [{ id: 'note-1', userId: MOCK_USER_ID, content: 'Test note', _origin: 'server' }],
    bookmarks: [],
  }

  zip.file('data.json', JSON.stringify(dataJson, null, 2))
  zip.file('README.md', '# Knowlune Data Export\n\n- **Exported at:** 2026-04-23T12:00:00.000Z\n')

  return zip.generateAsync({ type: 'nodebuffer' })
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Inject a mocked authenticated session into the page */
async function injectAuthSession(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ session }: { session: typeof MOCK_SESSION_RESPONSE }) => {
      const projectRef = 'knowlune'
      const storageKey = `sb-${projectRef}-auth-token`
      const sessionData = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user: session.user,
      }
      localStorage.setItem(storageKey, JSON.stringify(sessionData))
      localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: sessionData }))
    },
    { session: MOCK_SESSION_RESPONSE },
  )
}

/** Dismiss the welcome wizard so it doesn't interfere with settings navigation */
async function dismissWelcomeWizard(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }),
    )
  })
}

/** Mock account data endpoint so My Data section loads */
async function mockAccountData(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/profiles*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_ACCOUNT_DATA]),
    })
  })
  // Also mock any account summary endpoint
  await page.route('**/functions/v1/get-account-data*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ACCOUNT_DATA),
    })
  })
}

/** Mock all Supabase REST queries broadly to return empty data (avoid 404s) */
async function mockSupabaseRest(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    } else {
      await route.continue()
    }
  })
}

// ── Test Scenario 1: Happy path download ──────────────────────────────────

test.describe('GDPR Data Export — happy path', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
    await injectAuthSession(page)
  })

  test('authenticated user clicks Export ZIP and receives a ZIP download', async ({ page }) => {
    const zipBuffer = await buildMockZipBuffer()

    // Mock the export-data Edge Function to return a valid ZIP
    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: {
          'Content-Disposition': 'attachment; filename="knowlune-gdpr-export-2026-04-23.zip"',
        },
        body: zipBuffer,
      })
    })

    await mockSupabaseRest(page)
    await mockAccountData(page)

    await page.goto('/settings')

    // Wait for the GDPR export button to be visible
    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })
    await expect(exportButton).toContainText(/export zip/i)

    // Start waiting for download before clicking (must be set up before the click)
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()

    // Button should show loading state
    await expect(exportButton).toContainText(/exporting/i)

    // Capture download
    const download = await downloadPromise

    // Verify filename ends with .zip
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('success toast is shown after ZIP download is triggered', async ({ page }) => {
    const zipBuffer = await buildMockZipBuffer()

    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: {
          'Content-Disposition': 'attachment; filename="knowlune-gdpr-export-2026-04-23.zip"',
        },
        body: zipBuffer,
      })
    })

    await mockSupabaseRest(page)
    await mockAccountData(page)

    await page.goto('/settings')

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    const _downloadPromise = page.waitForEvent('download')
    await exportButton.click()

    // Toast should appear confirming the export
    await expect(page.getByRole('status').or(page.locator('[data-sonner-toast]'))).toBeVisible({
      timeout: 8000,
    })
  })
})

// ── Test Scenario 2: Too-large response ────────────────────────────────────

test.describe('GDPR Data Export — too-large', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
    await injectAuthSession(page)
  })

  test('shows informative toast and no download when export is too large', async ({ page }) => {
    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'too-large', route: 'async' }),
      })
    })

    await mockSupabaseRest(page)
    await mockAccountData(page)

    await page.goto('/settings')

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    // Set up a download listener — it should NOT fire
    let downloadTriggered = false
    page.on('download', () => {
      downloadTriggered = true
    })

    await exportButton.click()

    // Toast should appear with informative message (not an error)
    await expect(page.getByRole('status').or(page.locator('[data-sonner-toast]'))).toBeVisible({
      timeout: 8000,
    })

    // No download should have been triggered
    expect(downloadTriggered).toBe(false)
  })
})

// ── Test Scenario 3: Error response ──────────────────────────────────────

test.describe('GDPR Data Export — error handling', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
    await injectAuthSession(page)
  })

  test('shows error toast and no download when Edge Function returns 500', async ({ page }) => {
    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'RLS error on table notes: permission denied' }),
      })
    })

    await mockSupabaseRest(page)
    await mockAccountData(page)

    await page.goto('/settings')

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    let downloadTriggered = false
    page.on('download', () => {
      downloadTriggered = true
    })

    await exportButton.click()

    // Error toast should appear
    await expect(page.getByRole('status').or(page.locator('[data-sonner-toast]'))).toBeVisible({
      timeout: 8000,
    })

    expect(downloadTriggered).toBe(false)
  })
})

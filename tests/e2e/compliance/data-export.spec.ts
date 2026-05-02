/**
 * E2E tests for GDPR Data Export flow — E119-S05 (AC-7)
 *
 * Covers:
 *   1. Happy path: authenticated user clicks "Export ZIP" → ZIP downloaded
 *   2. Success toast shown after download triggered
 *   3. Too-large response → informative toast, no download
 *   4. Error response → error toast, no download
 *
 * The `/functions/v1/export-data` endpoint is mocked via page.route().
 * No live Supabase connection needed.
 * A minimal valid ZIP is constructed in-process using JSZip.
 *
 * Auth strategy: two-phase injection.
 *   Phase 1 (addInitScript): seed localStorage keys before React mounts.
 *   Phase 2 (evaluate after nav): drive window.__authStore.setSession() directly.
 * This is required because supabase client is null in test env (no VITE_SUPABASE_URL),
 * so useAuthLifecycle never fires and the user is never set from the SDK.
 */
import { test, expect } from '../../support/fixtures'
import JSZip from 'jszip'
import { FIXED_TIMESTAMP } from '../../utils/test-time'

// ── Constants ──────────────────────────────────────────────────────────────

const TEST_EMAIL = 'export-test@example.com'
const MOCK_USER_ID = 'usr-00000000-0000-0000-0000-export-00001'
const MOCK_ACCESS_TOKEN = 'mock-access-token-export-e119s05'

const MOCK_USER = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: TEST_EMAIL,
  email_confirmed_at: '2026-01-15T10:00:00.000Z',
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
}

const SESSION_DATA = {
  access_token: MOCK_ACCESS_TOKEN,
  refresh_token: 'mock-refresh-export-e119s05',
  // Use FIXED_TIMESTAMP (deterministic) rather than Date.now() to satisfy ESLint rule
  expires_at: Math.floor(FIXED_TIMESTAMP / 1000) + 3600 * 24 * 365, // far future
  expires_in: 3600,
  token_type: 'bearer',
  user: MOCK_USER,
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

/**
 * Phase 1 of auth injection: seed localStorage before React mounts.
 * Phase 2 must be called after navigation via injectSessionAfterNav().
 */
async function setupAuthInjection(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ data, userId }: { data: typeof SESSION_DATA; userId: string }) => {
      const projectRef = 'knowlune'
      const storageKey = `sb-${projectRef}-auth-token`
      localStorage.setItem(storageKey, JSON.stringify(data))
      localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: data }))

      // Dismiss all wizard/onboarding overlays so they don't block the settings UI
      const ts = '2026-01-01T00:00:00.000Z'
      localStorage.setItem(`sync:wizard:complete:${userId}`, ts)
      localStorage.setItem(`sync:wizard:dismissed:${userId}`, ts)
      localStorage.setItem(`sync:linked:${userId}`, ts)
      // Legacy onboarding overlay key (OnboardingOverlay removed — key kept for safety)
      localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: ts }))
      // Dismiss WelcomeWizard (useWelcomeWizardStore.ts)
      localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: ts }))
    },
    { data: SESSION_DATA, userId: MOCK_USER_ID },
  )
}

/**
 * Phase 2 of auth injection: after navigation, drive the Zustand auth store directly.
 * window.__authStore is exposed by useAuthStore in non-production builds.
 */
async function injectSessionAfterNav(page: import('@playwright/test').Page) {
  // Wait for the auth store to be available on window
  await page.waitForFunction(
    () => typeof (window as Record<string, unknown>).__authStore !== 'undefined',
    { timeout: 5000 },
  )
  await page.evaluate(
    ({ data }) => {
      const store = (window as Record<string, unknown>).__authStore as
        | { getState: () => { setSession: (s: typeof data) => void } }
        | undefined
      store?.getState().setSession(data as never)
    },
    { data: SESSION_DATA },
  )
}

/** Mock all Supabase REST GET queries to return empty data (avoid 404s / network errors) */
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
  test('authenticated user clicks Export ZIP and receives a ZIP download', async ({ page }) => {
    const zipBuffer = await buildMockZipBuffer()

    await setupAuthInjection(page)

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

    await page.goto('/settings')
    await injectSessionAfterNav(page)

    // Wait for the GDPR export button to be visible
    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })
    await expect(exportButton).toContainText(/export zip/i)

    // Start waiting for download before clicking (must be set up before the click)
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()

    // Capture download
    const download = await downloadPromise

    // Verify filename ends with .zip
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('success toast is shown after ZIP download is triggered', async ({ page }) => {
    const zipBuffer = await buildMockZipBuffer()

    await setupAuthInjection(page)

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

    await page.goto('/settings')
    await injectSessionAfterNav(page)

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    // Consume the download event so no "unhandled download" warning fires
    page.waitForEvent('download').catch(() => {})
    await exportButton.click()

    // Toast should appear confirming the export
    await expect(page.locator('[data-sonner-toast][data-mounted=true]').first()).toBeVisible({
      timeout: 8000,
    })
  })
})

// ── Test Scenario 2: Too-large response ────────────────────────────────────

test.describe('GDPR Data Export — too-large', () => {
  test('shows informative toast and no download when export is too large', async ({ page }) => {
    await setupAuthInjection(page)

    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'too-large', route: 'async' }),
      })
    })

    await mockSupabaseRest(page)

    await page.goto('/settings')
    await injectSessionAfterNav(page)

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    // Set up a download listener — it should NOT fire
    let downloadTriggered = false
    page.on('download', () => {
      downloadTriggered = true
    })

    await exportButton.click()

    // Toast should appear with informative message (not an error)
    await expect(page.locator('[data-sonner-toast][data-mounted=true]').first()).toBeVisible({
      timeout: 8000,
    })

    // No download should have been triggered
    expect(downloadTriggered).toBe(false)
  })
})

// ── Test Scenario 3: Error response ──────────────────────────────────────

test.describe('GDPR Data Export — error handling', () => {
  test('shows error toast and no download when Edge Function returns 500', async ({ page }) => {
    await setupAuthInjection(page)

    await page.route('**/functions/v1/export-data*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'RLS error on table notes: permission denied' }),
      })
    })

    await mockSupabaseRest(page)

    await page.goto('/settings')
    await injectSessionAfterNav(page)

    const exportButton = page.getByTestId('gdpr-export-button')
    await expect(exportButton).toBeVisible({ timeout: 10000 })

    let downloadTriggered = false
    page.on('download', () => {
      downloadTriggered = true
    })

    await exportButton.click()

    // Error toast should appear
    await expect(page.locator('[data-sonner-toast][data-mounted=true]').first()).toBeVisible({
      timeout: 8000,
    })

    expect(downloadTriggered).toBe(false)
  })
})

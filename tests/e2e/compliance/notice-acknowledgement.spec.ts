/**
 * E2E tests for Notice Acknowledgement flows — E119-S02 (AC-8)
 *
 * Covers three scenarios:
 *   1. Signup with required privacy checkbox
 *   2. Stale version → re-ack banner appears and can be acknowledged
 *   3. Soft-block overlay appears after 30+ days without acknowledgement
 *
 * All Supabase endpoints are mocked via page.route() — no live connection needed.
 * Deterministic dates use page.clock (Playwright 1.45+) to avoid Date.now() drift.
 */
import { test, expect } from '../../support/fixtures'
import { CURRENT_NOTICE_VERSION } from '../../../src/lib/compliance/noticeVersion'

// ── Constants ──────────────────────────────────────────────────────────────

const TEST_EMAIL = 'notice-ack-test@example.com'
const TEST_PASSWORD = 'securePass123'

const MOCK_USER_ID = 'usr-00000000-0000-0000-0000-notice-00001'

const MOCK_SIGNUP_RESPONSE = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: TEST_EMAIL,
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
}

const MOCK_SESSION_RESPONSE = {
  access_token: 'mock-access-token-notice-ack',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token-notice-ack',
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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Mock the Supabase auth signup endpoint */
async function mockSignupSuccess(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/signup*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SIGNUP_RESPONSE),
    })
  })
}

/** Mock the notice_acknowledgements INSERT endpoint */
async function mockAckInsertSuccess(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/notice_acknowledgements*', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    } else {
      await route.continue()
    }
  })
}

/** Mock notice_acknowledgements SELECT to return an older version row */
async function mockAckSelectStaleRow(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/notice_acknowledgements*', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ version: '2026-01-01.1' }]),
      })
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    } else {
      await route.continue()
    }
  })
}

/** Mock notice_acknowledgements SELECT to return no rows (unauthenticated / no ack) */
async function mockAckSelectNoRows(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/notice_acknowledgements*', async route => {
    if (route.request().method() === 'GET') {
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

/** Inject a mocked authenticated session into the page */
async function injectAuthSession(page: import('@playwright/test').Page) {
  // Seed the Supabase session into localStorage so the auth store picks it up
  await page.addInitScript(
    ({ user, session }: { user: typeof MOCK_USER_ID; session: typeof MOCK_SESSION_RESPONSE }) => {
      const projectRef = 'knowlune' // matches VITE_SUPABASE_URL in test env if set
      const storageKey = `sb-${projectRef}-auth-token`
      const sessionData = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user: session.user,
      }
      // Try common Supabase session key formats
      localStorage.setItem(storageKey, JSON.stringify(sessionData))
      localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: sessionData }))
    },
    { user: MOCK_USER_ID, session: MOCK_SESSION_RESPONSE },
  )
}

/** Dismiss the welcome wizard so it doesn't interfere */
async function dismissWelcomeWizard(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }),
    )
  })
}

// ── Test Scenario 1: Signup checkbox ──────────────────────────────────────

test.describe('Signup — privacy notice acknowledgement checkbox', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
  })

  test('submit button is disabled until privacy checkbox is checked', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#auth-email', { state: 'visible' })

    // Switch to sign-up mode
    await page.getByRole('button', { name: /sign up/i }).click()

    await page.locator('#auth-email').fill(TEST_EMAIL)
    await page.locator('#auth-password').fill(TEST_PASSWORD)
    await page.locator('#auth-confirm-password').fill(TEST_PASSWORD)

    // Submit should be disabled before checkbox
    const submitBtn = page.getByRole('button', { name: /create account/i })
    await expect(submitBtn).toBeDisabled()

    // Check the privacy acknowledgement checkbox
    await page.locator('#auth-privacy-ack').check()

    // Submit should now be enabled
    await expect(submitBtn).toBeEnabled()
  })

  test('privacy checkbox links to /legal/privacy', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#auth-email', { state: 'visible' })

    await page.getByRole('button', { name: /sign up/i }).click()

    const privacyLink = page.locator('label[for="auth-privacy-ack"] a')
    await expect(privacyLink).toHaveAttribute('href', '/legal/privacy')
  })

  test('privacy checkbox is not shown in sign-in mode', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('#auth-email', { state: 'visible' })

    // Default is sign-in mode
    await expect(page.locator('#auth-privacy-ack')).not.toBeVisible()
  })

  test('successful signup triggers notice ack write', async ({ page }) => {
    await mockSignupSuccess(page)
    const ackRequests: string[] = []
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        ackRequests.push(body?.version ?? '')
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/login')
    await page.waitForSelector('#auth-email', { state: 'visible' })
    await page.getByRole('button', { name: /sign up/i }).click()

    await page.locator('#auth-email').fill(TEST_EMAIL)
    await page.locator('#auth-password').fill(TEST_PASSWORD)
    await page.locator('#auth-confirm-password').fill(TEST_PASSWORD)
    await page.locator('#auth-privacy-ack').check()

    // Also mock auth state change so onSuccess navigates
    await page.route('**/auth/v1/user*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION_RESPONSE.user),
      })
    })

    await page.getByRole('button', { name: /create account/i }).click()

    // Wait for the notice ack POST to be made
    await page.waitForResponse(
      resp =>
        resp.url().includes('notice_acknowledgements') && resp.request().method() === 'POST',
      { timeout: 5000 },
    )
    expect(ackRequests).toContain(CURRENT_NOTICE_VERSION)
  })
})

// ── Test Scenario 2: Stale version → re-ack banner ────────────────────────

test.describe('Re-ack banner — stale notice version (within 30 days)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
    // Set clock to notice release date + 15 days (within 30-day window)
    const noticeReleaseDate = new Date('2026-04-23T00:00:00.000Z')
    const within30Days = new Date(noticeReleaseDate.getTime() + 15 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: within30Days.getTime() })
  })

  test('LegalUpdateBanner with Acknowledge button is shown when ack is stale', async ({ page }) => {
    await injectAuthSession(page)
    await mockAckSelectStaleRow(page)

    await page.goto('/')

    // The re-ack banner should appear
    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 5000 })
    await expect(banner.getByRole('button', { name: /acknowledge/i })).toBeVisible()
  })

  test('clicking Acknowledge in banner dismisses it', async ({ page }) => {
    await injectAuthSession(page)
    let postCount = 0
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: '2026-01-01.1' }]),
        })
      } else if (method === 'POST') {
        postCount++
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 5000 })

    await banner.getByRole('button', { name: /acknowledge/i }).click()

    // Banner should disappear after successful ack
    await expect(banner).not.toBeVisible({ timeout: 3000 })
    expect(postCount).toBeGreaterThan(0)
  })
})

// ── Test Scenario 3: Soft-block after 30 days ─────────────────────────────

test.describe('Soft-block gate — stale notice > 30 days', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeWizard(page)
    // Set clock to notice release date + 31 days (past the 30-day window)
    const noticeReleaseDate = new Date('2026-04-23T00:00:00.000Z')
    const past30Days = new Date(noticeReleaseDate.getTime() + 31 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: past30Days.getTime() })
  })

  test('SoftBlockGate is shown when stale and staleDays > 30', async ({ page }) => {
    await injectAuthSession(page)
    await mockAckSelectStaleRow(page)

    await page.goto('/')

    // The soft-block gate overlay should appear
    const gate = page.locator('[data-testid="soft-block-gate"]')
    await expect(gate).toBeVisible({ timeout: 5000 })

    // Should have the acknowledge CTA
    await expect(gate.getByRole('button', { name: /acknowledge privacy notice/i })).toBeVisible()
    // Should have link to privacy notice
    await expect(gate.getByRole('link', { name: /view privacy notice/i })).toBeVisible()
  })

  test('soft-block gate does NOT show when user is acknowledged', async ({ page }) => {
    await injectAuthSession(page)
    // Current version ack
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: CURRENT_NOTICE_VERSION }]),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')

    // Wait for the ack query to resolve (GET request to notice_acknowledgements),
    // then confirm the soft-block gate is absent.
    await page.waitForResponse(
      resp =>
        resp.url().includes('notice_acknowledgements') && resp.request().method() === 'GET',
      { timeout: 5000 },
    )
    await expect(page.locator('[data-testid="soft-block-gate"]')).not.toBeVisible()
  })
})

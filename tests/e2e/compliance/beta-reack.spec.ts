/**
 * E2E tests for Beta User Re-acknowledgement flow — E119-S13 (AC-6, AC-7)
 *
 * Covers:
 *   1. Re-ack happy path: beta user with stale ack version opens app →
 *      LegalUpdateBanner fires → user acknowledges → POST made → banner gone
 *   2. Dismiss without ack (AC-7): user dismisses banner → no POST made →
 *      banner reappears on next session
 *   3. Error path: POST to notice_acknowledgements fails → banner stays →
 *      toast.error shown
 *
 * Auth strategy: two-phase injection (data-export.spec.ts pattern).
 *   Phase 1 (addInitScript): seed localStorage keys before React mounts.
 *   Phase 2 (evaluate after nav): drive window.__authStore.setSession() directly.
 * This is required because supabase client in test env doesn't restore sessions
 * from localStorage automatically — the auth store must be driven directly.
 *
 * All Supabase endpoints mocked via page.route() — no live connection.
 * Deterministic time via page.clock.install().
 */

import { test, expect } from '../../support/fixtures'
import { CURRENT_NOTICE_VERSION } from '../../../src/lib/compliance/noticeVersion'
import { FIXED_TIMESTAMP } from '../../utils/test-time'

// ── Constants ──────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'usr-00000000-0000-0000-0000-reack-beta-1'
const MOCK_EMAIL = 'beta-reack-test@example.com'
const MOCK_ACCESS_TOKEN = 'mock-access-token-beta-reack-e119s13'

/** Previous version — triggers re-ack banner */
const PREVIOUS_NOTICE_VERSION = '2026-04-23.1'

const MOCK_USER = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: MOCK_EMAIL,
  email_confirmed_at: '2026-01-15T10:00:00.000Z',
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
}

// Use far-future expires_at so the session is never expired, even when
// page.clock is advanced to 2026 or beyond (FIXED_TIMESTAMP-based expiry
// would land in 2026-01 which is before the clocks used in these tests).
const FAR_FUTURE_EXPIRES_AT = Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000)

const SESSION_DATA = {
  access_token: MOCK_ACCESS_TOKEN,
  refresh_token: 'mock-refresh-beta-reack-e119s13',
  expires_at: FAR_FUTURE_EXPIRES_AT,
  expires_in: 3600,
  token_type: 'bearer',
  user: MOCK_USER,
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Phase 1: seed localStorage before React mounts.
 * Phase 2 (injectSessionAfterNav) must be called after navigation.
 */
async function setupAuthInjection(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ data, userId }: { data: typeof SESSION_DATA; userId: string }) => {
      // The Supabase client derives its storage key from the URL hostname:
      // sb-{hostname.split('.')[0]}-auth-token
      // For https://supabase.pedrolages.net → 'sb-supabase-auth-token'
      // Set BOTH the correct key AND the legacy 'knowlune' key for compatibility
      const hostKey = `sb-${window.location.hostname === 'localhost' ? 'supabase' : window.location.hostname.split('.')[0]}-auth-token`
      const legacyKey = 'sb-knowlune-auth-token'
      localStorage.setItem('sb-supabase-auth-token', JSON.stringify(data))
      localStorage.setItem(hostKey, JSON.stringify(data))
      localStorage.setItem(legacyKey, JSON.stringify(data))
      localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: data }))
      const ts = '2026-01-01T00:00:00.000Z'
      localStorage.setItem(`sync:wizard:complete:${userId}`, ts)
      localStorage.setItem(`sync:wizard:dismissed:${userId}`, ts)
      localStorage.setItem(`sync:linked:${userId}`, ts)
      localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: ts }))
      localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: ts }))
    },
    { data: SESSION_DATA, userId: MOCK_USER_ID },
  )
}

/** Phase 2: drive the Zustand auth store after navigation. */
async function injectSessionAfterNav(page: import('@playwright/test').Page) {
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

/** Mock all generic Supabase REST GETs (except notice_acknowledgements) to return []. */
async function mockSupabaseRestEmpty(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/**', async route => {
    const method = route.request().method()
    const url = route.request().url()
    if (!url.includes('notice_acknowledgements') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else if (!url.includes('notice_acknowledgements')) {
      await route.continue()
    }
    // notice_acknowledgements routes fall through to the more-specific handler
    // registered after this one (Playwright's LIFO route resolution)
  })
}

/**
 * Mock ALL requests to Supabase to prevent real network calls.
 * This is critical: supabase.auth.getUser() (used by writeNoticeAck) calls
 * GET /auth/v1/user and would hit the real server without this mock.
 *
 * Uses a catch-all pattern for the Supabase origin, then routes by URL path.
 */
async function mockAuthEndpoints(page: import('@playwright/test').Page) {
  // Use page.context().route() to ensure all frames and requests are intercepted
  await page.context().route(/supabase\.pedrolages\.net/, async route => {
    const url = route.request().url()
    if (url.includes('/auth/v1/user') || url.includes('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      })
    } else if (url.includes('/auth/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    } else {
      await route.continue()
    }
  })
}

// ── Scenario 1: Re-ack happy path ──────────────────────────────────────────

test.describe('Beta Re-ack — happy path', () => {
  test.beforeEach(async ({ page }) => {
    // 15 days after new version date (within 30-day window)
    const noticeDate = new Date('2026-05-01T00:00:00.000Z')
    const within30Days = new Date(noticeDate.getTime() + 15 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: within30Days.getTime() })

    await setupAuthInjection(page)
    await mockAuthEndpoints(page)
    await mockSupabaseRestEmpty(page)
  })

  test('banner appears when user has acked previous version only', async ({ page }) => {
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })
    await expect(banner.getByRole('button', { name: /acknowledge/i })).toBeVisible()
  })

  test('clicking Acknowledge writes POST and dismisses banner', async ({ page }) => {
    // Track POST count
    let postCount = 0

    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else if (method === 'POST') {
        postCount++
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })

    await banner.getByRole('button', { name: /acknowledge/i }).click()

    // After Acknowledge: banner disappears (LegalUpdateBanner setVisible(false))
    // This works because writeNoticeAck gets the user from supabase.auth.getUser()
    // which is mocked by mockAuthEndpoints to return MOCK_USER
    await expect(banner).not.toBeVisible({ timeout: 8000 })
    expect(postCount).toBeGreaterThan(0)
  })

  test('"View Privacy Notice" link points to /legal/privacy', async ({ page }) => {
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })

    const privacyLink = banner.getByRole('link', { name: /view privacy notice/i })
    await expect(privacyLink).toBeVisible()
    await expect(privacyLink).toHaveAttribute('href', /\/legal\/privacy/)
  })

  test('banner does not appear when user has already acked current version', async ({ page }) => {
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

    // Set up response waiter BEFORE injecting session to avoid race condition
    const ackResponsePromise = page.waitForResponse(
      resp =>
        resp.url().includes('notice_acknowledgements') && resp.request().method() === 'GET',
      { timeout: 8000 },
    )

    await page.goto('/')
    await injectSessionAfterNav(page)
    await ackResponsePromise

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).not.toBeVisible()
  })
})

// ── Scenario 2: Dismiss without ack (AC-7) ────────────────────────────────

test.describe('Beta Re-ack — dismiss without ack (AC-7)', () => {
  test.beforeEach(async ({ page }) => {
    const noticeDate = new Date('2026-05-01T00:00:00.000Z')
    const within30Days = new Date(noticeDate.getTime() + 10 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: within30Days.getTime() })

    await setupAuthInjection(page)
    await mockAuthEndpoints(page)
    await mockSupabaseRestEmpty(page)
  })

  test('user who only dismissed sees banner again on next session', async ({ page }) => {
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })

    // Navigate away without acknowledging
    await page.goto('/settings')
    await injectSessionAfterNav(page)

    // Navigate back — banner should still appear (no ack was persisted)
    await page.goto('/')
    await injectSessionAfterNav(page)

    await expect(banner).toBeVisible({ timeout: 8000 })
  })

  test('no POST is made when user navigates away without acking', async ({ page }) => {
    let postCount = 0

    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else if (method === 'POST') {
        postCount++
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })

    // Navigate away without clicking Acknowledge
    await page.goto('/courses')

    // Wait for any async POSTs
    await page.waitForTimeout(500)

    expect(postCount).toBe(0)
  })
})

// ── Scenario 3: Error path ─────────────────────────────────────────────────

test.describe('Beta Re-ack — error path', () => {
  test.beforeEach(async ({ page }) => {
    const noticeDate = new Date('2026-05-01T00:00:00.000Z')
    const within30Days = new Date(noticeDate.getTime() + 5 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: within30Days.getTime() })

    await setupAuthInjection(page)
    await mockAuthEndpoints(page)
    await mockSupabaseRestEmpty(page)
  })

  test('banner stays visible when POST to notice_acknowledgements fails', async ({ page }) => {
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: PREVIOUS_NOTICE_VERSION }]),
        })
      } else if (method === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'RLS check violation' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')
    await injectSessionAfterNav(page)

    const banner = page.locator('[role="alert"]').filter({ hasText: /privacy notice/i })
    await expect(banner).toBeVisible({ timeout: 8000 })

    await banner.getByRole('button', { name: /acknowledge/i }).click()

    // Banner should still be visible after failure
    await expect(banner).toBeVisible({ timeout: 5000 })

    // Error toast should appear
    await expect(
      page.locator('[data-sonner-toast][data-mounted=true]').first(),
    ).toBeVisible({ timeout: 5000 })
  })
})

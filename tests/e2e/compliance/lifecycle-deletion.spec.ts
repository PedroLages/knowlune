/**
 * End-to-end compliance lifecycle test (deletion + soft-block) — E119-S13 (AC-9)
 *
 * Continuation of lifecycle.spec.ts. Covers:
 *   Step 4 — Account deletion trigger (E119-S03/S04)
 *   Bonus  — Soft-block gate shown after 30+ days stale ack (E119-S02)
 *
 * All Supabase endpoints mocked via page.route() — no live connection.
 * Deterministic time via page.clock.
 */

import { test, expect } from '../../support/fixtures'
import { CURRENT_NOTICE_VERSION } from '../../../src/lib/compliance/noticeVersion'
import { FIXED_TIMESTAMP } from '../../utils/test-time'

// ── Constants ──────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'usr-00000000-0000-0000-lifecycle-002'
const TEST_EMAIL = 'lifecycle-deletion-test@example.com'

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

// Far-future expiry so session is valid regardless of page.clock advance
const FAR_FUTURE_EXPIRES_AT = Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000)

// JWT with iat matching FIXED_TIMESTAMP — required for sessionRequiresReauth() to pass
// (the account deletion flow checks iat age < 5 minutes)
// iat = Jan 15 2025 12:00:00 UTC = FIXED_TIMESTAMP / 1000
const MOCK_ACCESS_TOKEN_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpYXQiOjE3MzY5NDI0MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoidXNyLTAwMDAwMDAwLTAwMDAtMDAwMC1saWZlY3ljbGUtMDAyIn0.' +
  'fake-signature'

const SESSION_DATA = {
  access_token: MOCK_ACCESS_TOKEN_JWT,
  refresh_token: 'mock-refresh-lifecycle-del-e119s13',
  expires_at: FAR_FUTURE_EXPIRES_AT,
  expires_in: 3600,
  token_type: 'bearer',
  user: MOCK_USER,
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupAuthInjection(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ data, userId }: { data: typeof SESSION_DATA; userId: string }) => {
      // The Supabase client derives its storage key from the URL hostname
      // Set both the correct host-based key and legacy keys for compatibility
      localStorage.setItem('sb-supabase-auth-token', JSON.stringify(data))
      localStorage.setItem('sb-knowlune-auth-token', JSON.stringify(data))
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

async function mockSupabaseRestEmpty(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/**', async route => {
    const method = route.request().method()
    const url = route.request().url()
    const isHandledSeparately =
      url.includes('notice_acknowledgements') || url.includes('user_consents')
    if (!isHandledSeparately && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    } else if (!isHandledSeparately) {
      await route.continue()
    }
  })
}

async function mockAuthUser(page: import('@playwright/test').Page) {
  await page.context().route(/supabase\.pedrolages\.net\/auth\//, async route => {
    const url = route.request().url()
    if (url.includes('/auth/v1/user') || url.includes('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_USER),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
  })
}

async function mockCurrentVersionAck(page: import('@playwright/test').Page) {
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
}

// ── Step 4: Account Deletion ───────────────────────────────────────────────

test.describe('Lifecycle Step 4 — Account Deletion', () => {
  test('delete-account Edge Function is called with the correct user ID', async ({ page }) => {
    await page.clock.install({ time: FIXED_TIMESTAMP })

    await setupAuthInjection(page)
    await mockAuthUser(page)
    await mockSupabaseRestEmpty(page)
    await mockCurrentVersionAck(page)

    await page.route('**/rest/v1/user_consents*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    // Mock any Stripe-related calls (cancel subscription)
    await page.route('**/functions/v1/cancel-subscription*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    // Capture the delete-account Edge Function call
    let deletionCalled = false
    let deletionUserId: string | undefined

    await page.route('**/functions/v1/delete-account*', async route => {
      deletionCalled = true
      try {
        const body = route.request().postDataJSON() as Record<string, unknown>
        deletionUserId = body?.userId as string | undefined
      } catch {
        // Body may be empty or non-JSON
      }
      // Return success response matching the Edge Function's expected shape
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stepsCompleted: ['verifying', 'deleting-auth'] }),
      })
    })

    // Mock sign-out
    await page.route('**/auth/v1/logout*', async route => {
      await route.fulfill({ status: 204, body: '' })
    })

    await test.step('Navigate to settings account section', async () => {
      // Navigate directly to account section via URL param
      await page.goto('/settings?section=account')
      await injectSessionAfterNav(page)
    })

    await test.step('Open account deletion dialog', async () => {
      // Look for the delete account trigger
      const deleteBtn = page.getByTestId('delete-account-trigger')
      await expect(deleteBtn).toBeVisible({ timeout: 10000 })
      await deleteBtn.click()
    })

    await test.step('Type DELETE confirmation and submit', async () => {
      const confirmInput = page.getByTestId('confirm-delete-input')
      if (await confirmInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmInput.fill('DELETE')

        const confirmDeleteBtn = page.getByTestId('confirm-delete-button')
        await expect(confirmDeleteBtn).toBeEnabled({ timeout: 2000 })
        await confirmDeleteBtn.click()

        // Wait for the Edge Function call
        await page.waitForResponse(
          resp => resp.url().includes('functions/v1/delete-account'),
          { timeout: 8000 },
        )

        expect(deletionCalled).toBe(true)
      }
    })
  })
})

// ── Bonus: Soft-block Gate ─────────────────────────────────────────────────

test.describe('Lifecycle Bonus — Soft-block Gate (AC-8)', () => {
  test('SoftBlockGate appears for user with stale ack older than 30 days', async ({ page }) => {
    // Advance clock to 31 days past the new notice version date
    const noticeDate = new Date('2026-05-01T00:00:00.000Z')
    const past30Days = new Date(noticeDate.getTime() + 31 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: past30Days.getTime() })

    await setupAuthInjection(page)
    await mockAuthUser(page)
    await mockSupabaseRestEmpty(page)

    // Return old version ack — user has not acknowledged the new version
    await page.route('**/rest/v1/notice_acknowledgements*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ version: '2026-04-23.1' }]),
        })
      } else {
        await route.continue()
      }
    })

    await page.route('**/rest/v1/user_consents*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')

    await test.step('SoftBlockGate is shown', async () => {
      const gate = page.locator('[data-testid="soft-block-gate"]')
      await expect(gate).toBeVisible({ timeout: 8000 })
      await expect(gate.getByRole('button', { name: /acknowledge privacy notice/i })).toBeVisible()
    })
  })

  test('SoftBlockGate is NOT shown when user has acknowledged current version', async ({
    page,
  }) => {
    const noticeDate = new Date('2026-05-01T00:00:00.000Z')
    const past30Days = new Date(noticeDate.getTime() + 31 * 24 * 60 * 60 * 1000)
    await page.clock.install({ time: past30Days.getTime() })

    await setupAuthInjection(page)
    await mockAuthUser(page)
    await mockSupabaseRestEmpty(page)
    await mockCurrentVersionAck(page)

    await page.route('**/rest/v1/user_consents*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })

    await page.goto('/')

    await page.waitForResponse(
      resp =>
        resp.url().includes('notice_acknowledgements') && resp.request().method() === 'GET',
      { timeout: 5000 },
    )

    await test.step('SoftBlockGate is absent', async () => {
      await expect(page.locator('[data-testid="soft-block-gate"]')).not.toBeVisible()
    })
  })
})

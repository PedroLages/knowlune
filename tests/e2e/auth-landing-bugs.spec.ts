/**
 * E2E regression tests for three Landing-page auth bugs fixed on 2026-04-24:
 *
 * 1. Google OAuth return URL was `/`, which rendered the SPA's 404 / Landing when
 *    Supabase appended `?error=...`. Fix: dedicated `/auth/callback` route outside
 *    RouteGuard that surfaces errors back to Landing via `?authError=`.
 * 2. Magic-link exceptions were blanket-mapped to a generic "network" error, even
 *    for real Supabase errors (rate limits, etc.). Fix: only collapse actual
 *    TypeError / "Failed to fetch" to NETWORK_ERROR_MESSAGE; surface everything
 *    else.
 * 3. Privacy / Terms links on Landing looped back to the Landing page because
 *    the legal parent route was pathless and `/legal/privacy` was not routed.
 *    Fix: explicit top-level `/privacy` and `/terms` + legacy `/legal/*` redirect.
 *
 * These tests do NOT hit the real Supabase backend — they operate purely on the
 * SPA's routing and Landing UI.
 */
import { test, expect } from '../support/fixtures'

const WELCOME_WIZARD_KEY = 'knowlune-welcome-wizard-v1'
const WELCOME_WIZARD_DISMISSED = JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })

test.beforeEach(async ({ page }) => {
  // Suppress Welcome Wizard dialog which otherwise intercepts clicks on Landing.
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value)
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
  }, { key: WELCOME_WIZARD_KEY, value: WELCOME_WIZARD_DISMISSED })
})

test.describe('Auth landing — three bug regressions (2026-04-24)', () => {
  test('Bug #3: /privacy renders the legal page, not Landing', async ({ page }) => {
    await page.goto('/privacy')
    // Legal layout shows a "Back to app" link and the Privacy Policy heading
    await expect(page.getByRole('link', { name: /back to app/i })).toBeVisible()
    // Landing's main heading must NOT be present
    await expect(page.getByRole('heading', { level: 1, name: /learn smarter/i })).toHaveCount(0)
  })

  test('Bug #3: /terms renders the legal page, not Landing', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('link', { name: /back to app/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: /learn smarter/i })).toHaveCount(0)
  })

  test('Bug #3: legacy /legal/privacy redirects to /privacy', async ({ page }) => {
    await page.goto('/legal/privacy')
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('link', { name: /back to app/i })).toBeVisible()
  })

  test('Bug #3: Privacy Policy link on Landing points at /privacy (not /legal/privacy)', async ({
    page,
  }) => {
    await page.goto('/')
    const privacyLink = page.getByRole('link', { name: /privacy policy/i }).first()
    await expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  test('Bug #1: /auth/callback route is reachable without auth and does not 404', async ({
    page,
  }) => {
    // Passing an OAuth-style error parameter should redirect to Landing
    // with the authError surfaced in the banner (not a 404).
    await page.goto('/auth/callback?error=access_denied&error_description=User%20cancelled')
    // Landing renders with the alert banner — the authError param is consumed
    // by Landing's effect and stripped from the URL.
    await expect(page.getByRole('alert')).toContainText(/user cancelled/i)
    await expect(page.getByRole('tab', { name: /email/i })).toBeVisible()
  })

  test('Bug #1: authError query param renders an inline alert on Landing', async ({ page }) => {
    await page.goto('/?authError=Something%20went%20wrong')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/something went wrong/i)
    // After render, the authError param is stripped from the URL
    await expect(page).not.toHaveURL(/authError=/)
  })

  test('Bug #1: authError banner is dismissible', async ({ page }) => {
    await page.goto('/?authError=Denied')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await alert.getByRole('button', { name: /dismiss/i }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

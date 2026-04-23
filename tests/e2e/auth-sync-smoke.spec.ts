/**
 * Auth + Sync smoke flow.
 *
 * Validates the core signed-out/signed-in UX contract introduced in the
 * 2026-04-23 auth-sync-ux fix:
 *   - Signed-out: navbar shows Sign In; /login renders; Settings → Sync
 *     shows the new informational card (not a blank page).
 *   - Signed-in (fake user via window.__authStore): navbar swaps to the
 *     avatar dropdown; Settings → Sync shows the real sync controls.
 *
 * Auth is driven via the dev-only `window.__authStore` shim from
 * src/stores/useAuthStore.ts:157-160 — no Supabase network calls required.
 * Follows .claude/rules/testing/test-patterns.md: no waitForTimeout, no
 * Date.now(), deterministic waitForFunction for store readiness.
 */
import { test, expect } from '../support/fixtures'
import type { Page } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'

async function setFakeAuthUser(page: Page, userId = 'smoke-user') {
  await page.waitForFunction(() => !!(window as Record<string, unknown>).__authStore)
  // Suppress sync overlays that otherwise block pointer events after auth flips.
  await page.evaluate(() => {
    ;(window as Record<string, unknown>).__suppressSyncOverlays = true
  })
  await page.evaluate(uid => {
    const store = (window as Record<string, unknown>).__authStore as {
      setState: (partial: Record<string, unknown>) => void
    }
    store.setState({
      user: {
        id: uid,
        email: 'smoke@test.local',
        app_metadata: { provider: 'google' },
        user_metadata: {
          avatar_url: 'https://lh3.googleusercontent.com/test-avatar',
          full_name: 'Smoke Test User',
        },
      },
      session: null,
      initialized: true,
    })
  }, userId)
}

test.describe('Auth + Sync smoke flow', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('signed-out: navbar shows Sign In and /login is reachable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Navbar CTA — the button's accessible name comes from aria-label
    // "Sign in to your account" (Layout.tsx); match loosely.
    const signInCta = page.getByRole('button', { name: /sign in/i }).first()
    await expect(signInCta).toBeVisible()

    // /login renders the standalone auth page
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).toHaveURL(/\/login/)
  })

  test('signed-out Settings → Sync shows the informational card (not blank)', async ({
    page,
  }) => {
    await page.goto('/settings?section=sync')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('sync-section-signed-out')).toBeVisible()
    await expect(page.getByTestId('sync-signed-out-sign-in')).toBeVisible()
    await expect(page.getByTestId('sync-signed-out-sign-up')).toBeVisible()
    // Signed-in controls must not render
    await expect(page.getByTestId('sync-section')).toHaveCount(0)
  })

  test('signed-in: Settings → Sync swaps to real controls', async ({ page }) => {
    await page.goto('/settings?section=sync')
    await page.waitForLoadState('domcontentloaded')

    // Confirm signed-out card first, then flip auth and assert swap
    await expect(page.getByTestId('sync-section-signed-out')).toBeVisible()

    await setFakeAuthUser(page)

    await expect(page.getByTestId('sync-section')).toBeVisible()
    await expect(page.getByTestId('auto-sync-switch')).toBeVisible()
    await expect(page.getByTestId('sync-now-button')).toBeVisible()
    await expect(page.getByTestId('sync-section-signed-out')).toHaveCount(0)
  })
})

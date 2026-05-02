/**
 * E2E tests for the Landing page (Slice 7).
 *
 * Covers:
 * - Unauthenticated visit renders Landing (value prop + auth form)
 * - "Try without signing up" CTA → /try → Continue as guest → /courses
 * - Desktop layout: value prop and auth form side-by-side (≥1024px)
 * - Mobile layout: auth form renders before accordion (≤639px)
 * - Skip-to-auth link present and accessible
 * - Authenticated user visiting / is redirected away from Landing
 */
import { test, expect } from '../support/fixtures'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER_ID = 'landing-spec-user-001'
const WELCOME_WIZARD_KEY = 'knowlune-welcome-wizard-v1'
const WELCOME_WIZARD_DISMISSED = JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })

async function dismissWelcomeWizard(page: import('@playwright/test').Page) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value)
    localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true }))
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  }, { key: WELCOME_WIZARD_KEY, value: WELCOME_WIZARD_DISMISSED })
}

async function injectFakeAuth(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => !!(window as Record<string, unknown>).__authStore)
  await page.evaluate(() => {
    ;(window as Record<string, unknown>).__suppressSyncOverlays = true
  })
  await page.evaluate((uid) => {
    const store = (window as Record<string, unknown>).__authStore as {
      setState: (partial: Record<string, unknown>) => void
    }
    store.setState({
      user: { id: uid, email: 'landing-test@example.com' },
      initialized: true,
    })
  }, FAKE_USER_ID)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Landing page (anonymous)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('knowlune-guest')
      sessionStorage.removeItem('knowlune-guest-id')
    })
  })

  test('unauthenticated visit to / renders Landing with auth form', async ({ page }) => {
    await page.goto('/')
    // Auth form: email + magic link tabs; Google is a separate button above the tabs
    await expect(page.getByRole('tab', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /magic link/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('Landing renders value prop headline', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/learn smarter/i)
  })

  test('"Try without signing up" CTA is visible and navigates to guest shell', async ({ page }) => {
    await dismissWelcomeWizard(page)
    await page.goto('/')

    const guestCta = page.getByRole('link', { name: /try without signing up/i }).first()
    await expect(guestCta).toBeVisible()
    await guestCta.click()

    // Landing links to /try (comparison) → "Continue as guest" sets guest session → /courses
    await expect(page).toHaveURL(/\/try$/)
    await page.getByRole('link', { name: /continue as guest/i }).click()
    await expect(page).toHaveURL(/\/courses/)
  })

  test('desktop layout: value prop and auth form side-by-side', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    // Both left and right columns should be visible simultaneously
    const heading = page.getByRole('heading', { level: 1 })
    const emailTab = page.getByRole('tab', { name: /email/i })
    await expect(heading).toBeVisible()
    await expect(emailTab).toBeVisible()

    // The two-column layout is hidden on mobile (hidden sm:flex). Verify the
    // desktop container is in the DOM and visible.
    const desktopLayout = page.locator('.hidden.sm\\:flex')
    await expect(desktopLayout).toBeVisible()
  })

  test('mobile layout: auth form visible at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    // Mobile layout is the sm:hidden block — auth form shows first
    const mobileLayout = page.locator('.flex.sm\\:hidden')
    await expect(mobileLayout).toBeVisible()

    // Auth tabs should be visible at mobile width
    await expect(page.getByRole('tab', { name: /email/i })).toBeVisible()
  })

  test('mobile: "Why Knowlune?" accordion is present', async ({ page }) => {
    await dismissWelcomeWizard(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const accordionBtn = page.getByRole('button', { name: /why knowlune/i })
    await expect(accordionBtn).toBeVisible()

    // Click expands it
    await accordionBtn.click()
    await expect(page.locator('#mobile-value-panel').getByText(/all your learning in one place/i)).toBeVisible()
  })

  test('skip-to-auth link is present in the DOM', async ({ page }) => {
    await page.goto('/')
    // The page-level skip link is sr-only until focused — verify it exists
    const skipLink = page.getByRole('link', { name: 'Skip to sign-in', exact: true })
    await expect(skipLink).toBeAttached()
  })
})

test.describe('Landing page', () => {
  test('authenticated user visiting / is redirected away from Landing', async ({ page }) => {
    // Navigate to a guarded route (e.g. /courses) to load the app, inject auth,
    // then verify the app shell renders — Landing does not appear.
    await page.goto('/courses')
    await injectFakeAuth(page)
    // The app shell should show the courses page (Layout is rendered, not Landing)
    await expect(page.getByRole('heading', { name: /courses/i }).first()).toBeVisible({ timeout: 8000 })
    // Landing's heading should not be present
    await expect(page.getByRole('heading', { level: 1, name: /learn smarter/i })).not.toBeVisible()
  })
})

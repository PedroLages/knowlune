import { test, expect } from '@playwright/test'

/**
 * E118 — In-App Feedback & Bug Reporting
 * Tests the feedback trigger placement and modal interaction.
 * GitHub API calls are mocked to avoid real issue creation in CI.
 */
test.describe('E118 — Feedback trigger and modal', () => {
  // Mock GitHub Issues API for all tests
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.github.com/repos/PedroLages/Knowlune/issues', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ number: 1 }) })
    )
    // Seed localStorage before navigation to suppress onboarding overlay and fix sidebar state
    await page.goto('/')
    await page.evaluate(() => {
      // Mark onboarding as already completed so the overlay doesn't block interactions
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00Z', skipped: false })
      )
      // Mark welcome wizard as completed so the welcome dialog doesn't block interactions
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00Z' })
      )
      // Ensure sidebar is closed on tablet viewports
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Clear Agentation dev overlay state that may block pointer events in dev mode
      // (Agentation "Block page interactions" persists in localStorage)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && k.startsWith('agentation')) localStorage.removeItem(k)
      }
    })
  })

  test('desktop: feedback trigger visible in sidebar on overview page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
  })

  test('desktop: clicking feedback trigger opens FeedbackModal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    await expect(page.getByRole('heading', { name: /send feedback/i })).toBeVisible()
  })

  test('desktop: modal closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    await expect(page.getByRole('heading', { name: /send feedback/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: /send feedback/i })).not.toBeVisible()
  })

  test('desktop: modal mode toggle switches between Bug Report and Feedback', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    // Default is Bug Report — steps field visible
    await expect(page.getByLabel(/steps to reproduce/i)).toBeVisible()
    // Switch to Feedback
    await page.getByRole('radio', { name: /feedback/i }).click()
    // Steps field should disappear
    await expect(page.getByLabel(/steps to reproduce/i)).not.toBeVisible()
    await expect(page.getByLabel(/message/i)).toBeVisible()
  })

  test('desktop: submit bug report — when token absent, fallback textarea appears', async ({ page }) => {
    // In E2E, VITE_GITHUB_FEEDBACK_TOKEN is not set, so the hook transitions to fallback state.
    // This tests the full form → submit → fallback display path.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()
    // Fill bug report form
    await page.getByLabel(/^title/i).fill('Test bug from E2E')
    await page.getByLabel(/description/i).fill('This is a test description with enough characters')
    const submitBtn = page.getByRole('button', { name: /^send$/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()
    // No token → fallback state: copyable textarea and copy button appear
    await expect(page.getByLabel(/copyable report/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /copy report/i })).toBeVisible()
  })

  // NOTE: Mobile BottomNav E2E tests are skipped in the reuseExistingServer dev environment.
  // The useIsMobile() hook reads window.matchMedia at React render time; when the dev server
  // is reused across test contexts, matchMedia does not always propagate to useState initializers
  // for React components that already rendered in a wider viewport context.
  // Mobile trigger placement is verified by unit tests (FeedbackModal.test.tsx, BottomNav tests)
  // and by manual testing. Full mobile E2E coverage requires a dedicated mobile test project.
  test.skip('mobile (375px): feedback trigger visible in More drawer', () => {
    // Placeholder — skipped due to dev-server matchMedia propagation issue (see NOTE above)
  })

  test.skip('mobile (375px): tapping feedback in More drawer opens modal', () => {
    // Placeholder — skipped due to dev-server matchMedia propagation issue (see NOTE above)
  })
})

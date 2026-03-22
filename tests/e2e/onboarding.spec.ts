/**
 * E2E tests for the first-use onboarding flow (E10-S01).
 *
 * Tests the 3-step onboarding overlay:
 * 1. Import a course
 * 2. Start studying (play video 5s)
 * 3. Create a learning challenge
 *
 * Also tests skip behavior and persistence.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const ONBOARDING_KEY = 'levelup-onboarding-v1'

test.describe('First-Use Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear onboarding state before each test
    await page.addInitScript(key => {
      localStorage.removeItem(key)
    }, ONBOARDING_KEY)
  })

  test('shows onboarding overlay on first visit', async ({ page }) => {
    await navigateAndWait(page, '/')

    // Onboarding dialog should appear
    const dialog = page.getByRole('dialog', { name: /onboarding/i })
    await expect(dialog).toBeVisible()

    // Should show welcome message
    await expect(page.getByText(/Welcome to EduVi/i)).toBeVisible()

    // Should show step 1 content
    await expect(page.getByText(/Import your first course/i)).toBeVisible()

    // Should show step indicator (3 dots)
    await expect(page.getByRole('group', { name: /progress/i })).toBeVisible()

    // Should show skip option
    await expect(page.getByText(/Skip onboarding/i)).toBeVisible()
  })

  test('skip onboarding persists and does not reappear', async ({ page }) => {
    await navigateAndWait(page, '/')

    // Wait for dialog
    const dialog = page.getByRole('dialog', { name: /onboarding/i })
    await expect(dialog).toBeVisible()

    // Click skip (use the text link, not the icon button)
    await page.getByText('Skip onboarding').click()

    // Dialog should dismiss
    await expect(dialog).not.toBeVisible()

    // Verify persistence
    const stored = await page.evaluate(key => localStorage.getItem(key), ONBOARDING_KEY)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.completedAt).toBeTruthy()
    expect(parsed.skipped).toBe(true)

    // Reload — onboarding should not reappear
    await page.reload()
    await page.waitForLoadState('load')
    await expect(dialog).not.toBeVisible()
  })

  test('Escape key skips onboarding', async ({ page }) => {
    await navigateAndWait(page, '/')

    const dialog = page.getByRole('dialog', { name: /onboarding/i })
    await expect(dialog).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Dialog should dismiss
    await expect(dialog).not.toBeVisible()

    // Should be persisted as skipped
    const stored = await page.evaluate(key => localStorage.getItem(key), ONBOARDING_KEY)
    const parsed = JSON.parse(stored!)
    expect(parsed.skipped).toBe(true)
  })

  test('does not show onboarding if already completed', async ({ page }) => {
    // Pre-seed completion flag
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: false })
      )
    }, ONBOARDING_KEY)

    await navigateAndWait(page, '/')

    // Should NOT show onboarding
    const dialog = page.getByRole('dialog', { name: /onboarding/i })
    await expect(dialog).not.toBeVisible()
  })

  test('CTA button navigates to courses page', async ({ page }) => {
    await navigateAndWait(page, '/')

    const dialog = page.getByRole('dialog', { name: /onboarding/i })
    await expect(dialog).toBeVisible()

    // Click the CTA for step 1
    await page.getByRole('button', { name: /Go to Courses/i }).click()

    // Should navigate to courses
    await page.waitForURL('**/courses')

    // Dialog should dismiss (user is taking action)
    await expect(dialog).not.toBeVisible()
  })
})

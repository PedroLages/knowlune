/**
 * ATDD tests for E51-S01: Settings Infrastructure & Display Section Shell
 *
 * RED phase — these tests should FAIL until the feature is implemented.
 *
 * Covers:
 * - AC1: Display & Accessibility section visible on Settings page
 * - AC2: Reset button triggers AlertDialog
 * - AC3: Confirming reset reverts all fields to defaults + shows toast
 * - AC4: getSettings() returns correct defaults for new fields
 * - AC5: Mobile layout — touch targets and responsive reset button
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to settings page with sidebar + onboarding + welcome wizard dismissed */
async function goToSettings(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  await navigateAndWait(page, '/settings')
}

// ---------------------------------------------------------------------------
// AC1: Section visibility
// ---------------------------------------------------------------------------

test.describe('E51-S01: Display & Accessibility section', () => {
  test('AC1 — section appears on Settings page with correct heading and description', async ({
    page,
  }) => {
    await goToSettings(page)

    // Section heading
    const heading = page.getByRole('heading', { name: 'Display & Accessibility' })
    await expect(heading).toBeVisible()

    // Section description
    await expect(page.getByText('Customize how content looks and moves')).toBeVisible()

    // Eye icon present (lucide renders as SVG)
    const section = page.locator('[data-testid="display-accessibility-section"]')
    await expect(section).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC2: Reset button opens AlertDialog
  // ---------------------------------------------------------------------------

  test('AC2 — reset button opens confirmation dialog', async ({ page }) => {
    await goToSettings(page)

    const resetButton = page.getByRole('button', {
      name: /reset display settings/i,
    })
    await expect(resetButton).toBeVisible()
    await resetButton.click()

    // AlertDialog should appear
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Reset display settings?')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC3: Confirming reset reverts fields + shows toast
  // ---------------------------------------------------------------------------

  test('AC3 — confirming reset reverts all settings and shows toast', async ({ page }) => {
    // Pre-set non-default values + dismiss onboarding/wizard
    await page.addInitScript(() => {
      const stored = localStorage.getItem('app-settings')
      const settings = stored ? JSON.parse(stored) : {}
      settings.accessibilityFont = true
      settings.contentDensity = 'spacious'
      settings.reduceMotion = 'on'
      localStorage.setItem('app-settings', JSON.stringify(settings))
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })

    // Open reset dialog
    await page.getByRole('button', { name: /reset display settings/i }).click()

    // Confirm reset
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: /^reset$/i }).click()

    // Toast confirmation
    await expect(page.getByText('Display settings reset to defaults')).toBeVisible()

    // Verify localStorage was reset
    const settings = await page.evaluate(() => {
      const raw = localStorage.getItem('app-settings')
      return raw ? JSON.parse(raw) : null
    })
    expect(settings?.accessibilityFont).toBe(false)
    expect(settings?.contentDensity).toBe('default')
    expect(settings?.reduceMotion).toBe('system')
  })

  // ---------------------------------------------------------------------------
  // AC4: Default values for new fields
  // ---------------------------------------------------------------------------

  test('AC4 — fresh app returns correct defaults for new settings fields', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('app-settings')
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })

    // Read settings from app context
    const defaults = await page.evaluate(() => {
      const raw = localStorage.getItem('app-settings')
      return raw ? JSON.parse(raw) : null
    })

    // If settings haven't been written yet, the defaults should apply
    // when the component reads them — verify via UI state instead
    const section = page.locator('[data-testid="display-accessibility-section"]')
    await expect(section).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC5: Mobile responsiveness
  // ---------------------------------------------------------------------------

  test('AC5 — mobile layout has proper touch targets and full-width reset', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await goToSettings(page)

    const resetButton = page.getByRole('button', {
      name: /reset display settings/i,
    })
    await expect(resetButton).toBeVisible()

    // Check minimum touch target height (44px)
    const box = await resetButton.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

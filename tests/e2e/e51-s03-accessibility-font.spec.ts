/**
 * ATDD tests for E51-S03: Atkinson Hyperlegible Font Toggle
 *
 * Covers:
 * - AC1: Enabling toggle changes --font-body to Atkinson Hyperlegible
 * - AC2: Disabling toggle reverts --font-body to DM Sans
 * - AC3: Page reload with font enabled re-applies automatically
 * - AC6: Preview panel shows when font is ON, hidden when OFF, with attribution
 * - Accessibility: correct aria-label on toggle
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to settings page with onboarding/wizard dismissed */
async function goToSettings(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  await navigateAndWait(page, '/settings')
}

/** Navigate to settings with accessibilityFont already enabled */
async function goToSettingsWithFontEnabled(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const stored = localStorage.getItem('app-settings')
    const settings = stored ? JSON.parse(stored) : {}
    settings.accessibilityFont = true
    localStorage.setItem('app-settings', JSON.stringify(settings))
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  await navigateAndWait(page, '/settings')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E51-S03: Atkinson Hyperlegible Font Toggle', () => {
  test('AC1 — enabling font toggle changes --font-body to Atkinson Hyperlegible', async ({
    page,
  }) => {
    await goToSettings(page)

    // Find and click the accessibility font toggle
    const toggle = page.getByRole('switch', { name: /enable accessibility font/i })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // Wait for the font to load and CSS variable to update
    await expect(async () => {
      const fontBody = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()
      )
      expect(fontBody).toContain('Atkinson Hyperlegible')
    }).toPass({ timeout: 5000 })
  })

  test('AC2 — disabling font toggle reverts --font-body to DM Sans', async ({ page }) => {
    await goToSettingsWithFontEnabled(page)

    // Wait for font to be loaded first
    await expect(async () => {
      const fontBody = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()
      )
      expect(fontBody).toContain('Atkinson Hyperlegible')
    }).toPass({ timeout: 5000 })

    // Toggle OFF
    const toggle = page.getByRole('switch', { name: /enable accessibility font/i })
    await toggle.click()

    // Verify --font-body reverts to DM Sans
    const fontBody = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()
    )
    expect(fontBody).toContain('DM Sans')
  })

  test('AC3 — page reload with font enabled re-applies Atkinson Hyperlegible', async ({ page }) => {
    await goToSettingsWithFontEnabled(page)

    // Wait for font to load on initial navigation
    await expect(async () => {
      const fontBody = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()
      )
      expect(fontBody).toContain('Atkinson Hyperlegible')
    }).toPass({ timeout: 5000 })

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })

    // After reload, font should re-apply
    await expect(async () => {
      const fontBody = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim()
      )
      expect(fontBody).toContain('Atkinson Hyperlegible')
    }).toPass({ timeout: 5000 })
  })

  test('AC6 — preview panel appears when font is ON and shows attribution', async ({ page }) => {
    await goToSettings(page)

    // Preview should not be visible initially
    const preview = page.locator('[data-testid="accessibility-font-preview"]')
    await expect(preview).not.toBeVisible()

    // Enable font
    const toggle = page.getByRole('switch', { name: /enable accessibility font/i })
    await toggle.click()

    // Preview panel should appear
    await expect(preview).toBeVisible()

    // Check sample text
    await expect(preview.getByText('The quick brown fox jumps over the lazy dog')).toBeVisible()
    await expect(preview.getByText('0123456789 AaBbCcDdEeFf')).toBeVisible()

    // Check attribution
    await expect(preview.getByText(/Atkinson Hyperlegible.*Braille Institute/)).toBeVisible()
  })

  test('AC6 — preview panel disappears when font is toggled OFF', async ({ page }) => {
    await goToSettingsWithFontEnabled(page)

    const preview = page.locator('[data-testid="accessibility-font-preview"]')
    await expect(preview).toBeVisible()

    // Toggle OFF
    const toggle = page.getByRole('switch', { name: /enable accessibility font/i })
    await toggle.click()

    // Preview should disappear
    await expect(preview).not.toBeVisible()
  })

  test('Accessibility — toggle has correct aria-label', async ({ page }) => {
    await goToSettings(page)

    const toggle = page.getByRole('switch', { name: /enable accessibility font/i })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', 'Enable accessibility font')
  })
})

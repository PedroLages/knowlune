/**
 * ATDD tests for E51-S04: Spacious Content Density Mode
 *
 * Covers:
 * - AC1: Enabling spacious mode adds `.spacious` class on <html>
 * - AC2: Disabling spacious mode removes `.spacious` class
 * - AC3: Sidebar and header remain unchanged when spacious is toggled
 * - AC4: Overview page grid gap widens from 1.5rem to 2rem
 * - AC5: Table cell padding increases from 0.75rem to 1rem
 * - AC6: Reload with spacious enabled re-applies without layout flash
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

/** Navigate to settings with spacious mode already enabled */
async function goToSettingsWithSpaciousEnabled(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const stored = localStorage.getItem('app-settings')
    const settings = stored ? JSON.parse(stored) : {}
    settings.contentDensity = 'spacious'
    localStorage.setItem('app-settings', JSON.stringify(settings))
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  await navigateAndWait(page, '/settings')
}

/** Navigate to a page with spacious mode already enabled */
async function goToPageWithSpaciousEnabled(page: import('@playwright/test').Page, path: string) {
  await page.addInitScript(() => {
    const stored = localStorage.getItem('app-settings')
    const settings = stored ? JSON.parse(stored) : {}
    settings.contentDensity = 'spacious'
    localStorage.setItem('app-settings', JSON.stringify(settings))
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  await navigateAndWait(page, path)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E51-S04: Spacious Content Density Mode', () => {
  test('AC1 — enabling spacious mode adds .spacious class on <html>', async ({ page }) => {
    await goToSettings(page)

    // Verify .spacious is NOT present initially
    const hasClassBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('spacious')
    )
    expect(hasClassBefore).toBe(false)

    // Find and click the spacious mode toggle
    const toggle = page.getByRole('switch', { name: /enable spacious content density/i })
    await expect(toggle).toBeVisible()
    await toggle.click()

    // Verify .spacious class is added
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(true)
    }).toPass({ timeout: 5000 })
  })

  test('AC2 — disabling spacious mode removes .spacious class', async ({ page }) => {
    await goToSettingsWithSpaciousEnabled(page)

    // Wait for .spacious to be present
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(true)
    }).toPass({ timeout: 5000 })

    // Toggle OFF
    const toggle = page.getByRole('switch', { name: /enable spacious content density/i })
    await toggle.click()

    // Verify .spacious class is removed
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(false)
    }).toPass({ timeout: 5000 })
  })

  test('AC3 — sidebar and header padding do NOT change when spacious is toggled', async ({
    page,
  }) => {
    await goToSettings(page)

    // Measure sidebar and header padding before toggling
    const before = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="sidebar-nav"]')
      const header = document.querySelector('header')
      return {
        sidebarPadding: sidebar ? getComputedStyle(sidebar).padding : 'none',
        headerPadding: header ? getComputedStyle(header).padding : 'none',
      }
    })

    // Toggle spacious ON
    const toggle = page.getByRole('switch', { name: /enable spacious content density/i })
    await toggle.click()

    // Wait for class to be applied
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(true)
    }).toPass({ timeout: 5000 })

    // Measure sidebar and header padding after toggling
    const after = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="sidebar-nav"]')
      const header = document.querySelector('header')
      return {
        sidebarPadding: sidebar ? getComputedStyle(sidebar).padding : 'none',
        headerPadding: header ? getComputedStyle(header).padding : 'none',
      }
    })

    // Sidebar and header padding should remain identical
    expect(after.sidebarPadding).toBe(before.sidebarPadding)
    expect(after.headerPadding).toBe(before.headerPadding)
  })

  test('AC4 — Overview page content gap widens from 1.5rem to 2rem when spacious', async ({
    page,
  }) => {
    // First check default gap value
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await navigateAndWait(page, '/')

    const defaultGap = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--content-gap').trim()
    )
    expect(defaultGap).toBe('1.5rem')

    // Now enable spacious and check
    await goToPageWithSpaciousEnabled(page, '/')

    const spaciousGap = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--content-gap').trim()
    )
    expect(spaciousGap).toBe('2rem')
  })

  test('AC5 — table cell padding token increases from 0.75rem to 1rem when spacious', async ({
    page,
  }) => {
    // Check default
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await navigateAndWait(page, '/')

    const defaultPadding = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--table-cell-padding').trim()
    )
    expect(defaultPadding).toBe('0.75rem')

    // Enable spacious
    await goToPageWithSpaciousEnabled(page, '/')

    const spaciousPadding = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--table-cell-padding').trim()
    )
    expect(spaciousPadding).toBe('1rem')
  })

  test('AC6 — page reload with spacious enabled re-applies .spacious class', async ({ page }) => {
    await goToSettingsWithSpaciousEnabled(page)

    // Verify .spacious is applied on initial load
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(true)
    }).toPass({ timeout: 5000 })

    // Reload the page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify .spacious is re-applied after reload
    await expect(async () => {
      const hasClass = await page.evaluate(() =>
        document.documentElement.classList.contains('spacious')
      )
      expect(hasClass).toBe(true)
    }).toPass({ timeout: 5000 })
  })
})

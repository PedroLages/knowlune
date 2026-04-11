/**
 * E2E Tests for E107-S05: Sync Reader Themes
 *
 * Acceptance Criteria:
 * - AC-1: When the app color scheme changes, the EPUB reader chrome updates to match
 * - AC-2: Reader theme colors are derived from the app's theme system, not hardcoded
 * - AC-3: Theme transitions are smooth (no flash of wrong colors when opening a book)
 * - AC-4: All three color schemes (Professional, Vibrant, Clean) render correctly in the reader
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const TEST_BOOK = {
  id: 'test-book-theme-sync',
  title: 'Theme Test Book',
  author: 'Test Author',
  format: 'epub' as const,
  status: 'reading' as const,
  chapters: [],
  source: { type: 'local' as const, opfsPath: '/test/theme-test.epub' },
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

/**
 * Open the book reader with test mode enabled and optional color scheme preset.
 */
async function openReader(
  page: import('@playwright/test').Page,
  opts?: { colorScheme?: 'professional' | 'vibrant' | 'clean'; readerTheme?: string }
) {
  await page.addInitScript(
    ({ colorScheme, readerTheme }) => {
      // Skip onboarding
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
      localStorage.setItem('knowlune-sidebar-v1', 'false')

      // Set color scheme if provided
      if (colorScheme) {
        const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
        settings.colorScheme = colorScheme
        localStorage.setItem('app-settings', JSON.stringify(settings))
      }

      // Set reader theme if provided
      if (readerTheme) {
        localStorage.setItem(
          'knowlune-reader-settings-v1',
          JSON.stringify({
            theme: readerTheme,
            fontSize: 100,
            fontFamily: 'default',
            lineHeight: 1.6,
          })
        )
      }

      // Enable test mode for BookContentService (mock EPUB)
      ;(window as unknown as Record<string, unknown>).__BOOK_CONTENT_TEST_MODE__ = true
    },
    { colorScheme: opts?.colorScheme, readerTheme: opts?.readerTheme }
  )

  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Enable test mode
  await page.evaluate(() => {
    const fn = (window as unknown as Record<string, () => void>).__enableBookContentTestMode__
    if (typeof fn === 'function') fn()
  })

  // Seed test book
  await seedBooks(page, [TEST_BOOK])

  // Navigate to reader
  await page.goto(`/library/${TEST_BOOK.id}/read`)

  // Dismiss any dialogs
  // Intentional hard wait: dialog animations need time before dismissal
  await page.waitForTimeout(500)
  const backdrop = page.locator('[data-slot="dialog-overlay"]').first()
  if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    // Intentional hard wait: dialog close animation
    await page.waitForTimeout(200)
  }
}

/** Open settings panel via reader menu */
async function openSettingsPanel(page: import('@playwright/test').Page) {
  // Move mouse to ensure header is visible (auto-hides after idle)
  await page.mouse.move(100, 100)
  await expect(page.getByTestId('reader-header')).toBeVisible({ timeout: 3000 })
  await page.getByTestId('reader-menu-button').click()
  await page.getByTestId('reader-menu-settings').click()
  await expect(page.getByTestId('reader-settings-panel')).toBeVisible()
}

test.describe('E107-S05: Sync Reader Themes', () => {
  test('AC-2+4: Professional scheme uses warm cream background (#faf5ee)', async ({ page }) => {
    await openReader(page, { colorScheme: 'professional' })

    // Verify reader container uses Professional light background
    const container = page.getByTestId('epub-renderer')
    await expect(container).toBeVisible({ timeout: 5000 })
    await expect(container).toHaveClass(/bg-\[#faf5ee\]/)
  })

  test('AC-2+4: Clean scheme uses cool blue-white background (#f9f9fe)', async ({ page }) => {
    await openReader(page, { colorScheme: 'clean' })

    // Verify reader container uses Clean light background — distinct from Professional
    const container = page.getByTestId('epub-renderer')
    await expect(container).toBeVisible({ timeout: 5000 })
    await expect(container).toHaveClass(/bg-\[#f9f9fe\]/)
  })

  test('AC-1: sepia reader theme remains independent of app color scheme', async ({ page }) => {
    await openReader(page, { colorScheme: 'clean', readerTheme: 'sepia' })

    // Even with Clean color scheme, sepia should use sepia colors
    const container = page.getByTestId('epub-renderer')
    await expect(container).toBeVisible({ timeout: 5000 })
    await expect(container).toHaveClass(/bg-\[#f4ecd8\]/)
  })

  test('AC-4: dark reader theme uses app dark mode tokens', async ({ page }) => {
    await openReader(page, { colorScheme: 'professional', readerTheme: 'dark' })

    const container = page.getByTestId('epub-renderer')
    await expect(container).toBeVisible({ timeout: 5000 })
    await expect(container).toHaveClass(/bg-\[#1a1b26\]/)
  })

  test('AC-2: header derives colors from shared theme config', async ({ page }) => {
    await openReader(page, { colorScheme: 'professional' })

    // Ensure header is visible
    await page.mouse.move(100, 100)
    const header = page.getByTestId('reader-header')
    await expect(header).toBeVisible({ timeout: 3000 })

    // Professional light: overlay bg #faf5ee/60, text #1c1d2b
    await expect(header).toHaveClass(/bg-\[#faf5ee\]\/60/)
    await expect(header).toHaveClass(/text-\[#1c1d2b\]/)
  })

  test('AC-2: footer derives colors from shared theme config', async ({ page }) => {
    await openReader(page, { colorScheme: 'clean' })

    // Ensure footer is visible
    await page.mouse.move(100, 100)
    const footer = page.getByTestId('reader-footer')
    await expect(footer).toBeVisible({ timeout: 3000 })

    // Clean light: overlay bg #f9f9fe/60, text #2c333d
    await expect(footer).toHaveClass(/bg-\[#f9f9fe\]\/60/)
    await expect(footer).toHaveClass(/text-\[#2c333d\]/)
  })

  test('AC-4: settings panel theme pills reflect current color scheme', async ({ page }) => {
    await openReader(page, { colorScheme: 'clean' })
    await openSettingsPanel(page)

    // Light theme pill should use Clean bg (#f9f9fe), not Professional (#faf5ee)
    const lightPill = page.getByTestId('theme-light')
    await expect(lightPill).toBeVisible()
    await expect(lightPill).toHaveClass(/bg-\[#f9f9fe\]/)
  })

  test('AC-1: switching color scheme at runtime updates reader chrome', async ({ page }) => {
    await openReader(page, { colorScheme: 'professional' })

    // Verify Professional colors
    const container = page.getByTestId('epub-renderer')
    await expect(container).toBeVisible({ timeout: 5000 })
    await expect(container).toHaveClass(/bg-\[#faf5ee\]/)

    // Switch to Clean at runtime via settings event
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.colorScheme = 'clean'
      localStorage.setItem('app-settings', JSON.stringify(settings))
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    // Container should now use Clean bg
    await expect(container).toHaveClass(/bg-\[#f9f9fe\]/, { timeout: 3000 })
  })
})

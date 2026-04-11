/**
 * E2E Tests for E107-S05: Sync Reader Themes
 *
 * Acceptance Criteria:
 * - AC-1: When the app theme changes, the EPUB reader iframe background and text colors update to match
 * - AC-2: Reader theme state is derived from the app's theme system (CSS custom properties), not hardcoded
 * - AC-3: Theme transitions are smooth (no flash of wrong colors when opening a book or switching themes)
 * - AC-4: All three color schemes (Professional, Vibrant, Clean) render correctly in the reader
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

/** Seed a single EPUB book for reader theme tests */
async function seedTestBook(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: 'test-book-theme-sync',
      title: 'Theme Test Book',
      author: 'Test Author',
      format: 'epub',
      status: 'reading',
      chapters: [],
      source: { type: 'local', opfsPath: '/test/theme-test.epub' },
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
  ])
}

test.describe('E107-S05: Sync Reader Themes', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
  })

  test('AC-1: reader background updates when app switches to dark mode', async ({ page }) => {
    await page.goto('/library')
    await seedTestBook(page)

    // Set app to dark mode
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('app-settings', JSON.stringify(settings))
      document.documentElement.classList.add('dark')
      window.dispatchEvent(new CustomEvent('settingsUpdated'))
    })

    // Navigate to book reader
    // The reader should pick up the dark app theme
    // TODO: Navigate to reader route and verify iframe background matches dark theme tokens
    test.fail()
  })

  test('AC-2: reader theme colors derived from app theme tokens, not hardcoded', async ({
    page,
  }) => {
    // Set Clean color scheme (which has a different background: #f9f9fe vs #faf5ee)
    await page.addInitScript(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.colorScheme = 'clean'
      localStorage.setItem('app-settings', JSON.stringify(settings))
    })

    await page.goto('/library')
    await seedTestBook(page)

    // Navigate to book reader
    // Reader container background should use Clean scheme's #f9f9fe, not Professional's #faf5ee
    // TODO: Verify reader container background matches Clean color scheme
    test.fail()
  })

  test('AC-3: no flash of wrong colors when opening a book', async ({ page }) => {
    // Set app to dark mode before navigation
    await page.addInitScript(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.theme = 'dark'
      localStorage.setItem('app-settings', JSON.stringify(settings))
    })

    await page.goto('/library')
    await seedTestBook(page)

    // Navigate to reader — the initial render should have correct dark background
    // without a brief flash of light theme
    // TODO: Navigate to reader and verify initial background is dark
    test.fail()
  })

  test('AC-4: Professional color scheme renders correctly in reader', async ({ page }) => {
    await page.addInitScript(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.colorScheme = 'professional'
      settings.theme = 'light'
      localStorage.setItem('app-settings', JSON.stringify(settings))
    })

    await page.goto('/library')
    await seedTestBook(page)

    // Reader should use Professional light background (#faf5ee)
    // TODO: Navigate to reader and verify background color
    test.fail()
  })

  test('AC-4: Clean color scheme renders correctly in reader', async ({ page }) => {
    await page.addInitScript(() => {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}')
      settings.colorScheme = 'clean'
      settings.theme = 'light'
      localStorage.setItem('app-settings', JSON.stringify(settings))
    })

    await page.goto('/library')
    await seedTestBook(page)

    // Reader should use Clean light background (#f9f9fe)
    // TODO: Navigate to reader and verify background color
    test.fail()
  })

  test('AC-1: sepia reader theme remains independent of app color scheme', async ({ page }) => {
    await page.addInitScript(() => {
      // Set reader to sepia theme
      localStorage.setItem(
        'knowlune-reader-settings-v1',
        JSON.stringify({ theme: 'sepia', fontSize: 100, fontFamily: 'default', lineHeight: 1.6 })
      )
    })

    await page.goto('/library')
    await seedTestBook(page)

    // Reader in sepia mode should always use sepia colors (#F4ECD8)
    // regardless of app color scheme
    // TODO: Navigate to reader and verify sepia background
    test.fail()
  })
})

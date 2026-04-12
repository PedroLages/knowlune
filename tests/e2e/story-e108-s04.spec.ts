/**
 * E2E Tests for E108-S04: Audiobook Settings Panel
 *
 * Acceptance Criteria:
 * - AC-1: Settings panel opens from audiobook player
 * - AC-2: Default speed persists and is applied to new sessions
 * - AC-3: Skip Silence toggle is visible (with "Coming soon" label)
 * - AC-4: Default sleep timer selection is persisted
 * - AC-5: Auto-bookmark toggle persists
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const AUDIOBOOK_PREFS_KEY = 'knowlune:audiobook-prefs-v1'

const testAudiobook = {
  id: 'test-audiobook-e108-s04',
  title: 'Test Audiobook',
  author: 'Test Author',
  format: 'audiobook' as const,
  status: 'reading' as const,
  progress: 10,
  chapters: [{ title: 'Chapter 1', duration: 3600, src: '' }],
  source: { type: 'local' as const, opfsPath: '/test/test.m4b' },
  totalDuration: 3600,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

test.describe('E108-S04: Audiobook Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss all overlays (onboarding, welcome wizard, sidebar) before navigation
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

    await page.goto('/library')
    await seedBooks(page, [testAudiobook])
    await page.reload({ waitUntil: 'domcontentloaded' })
  })

  test('AC-1: Settings panel opens from audiobook player settings button', async ({ page }) => {
    // Navigate into the audiobook reader
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    // Open settings panel
    const settingsButton = page.getByTestId('audiobook-settings-button')
    await expect(settingsButton).toBeVisible()
    await settingsButton.click()

    // Settings sheet should be visible
    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('Audiobook Settings')
  })

  test('AC-2: Speed preset buttons are rendered and clicking one persists preference', async ({
    page,
  }) => {
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    // Verify speed presets are rendered (expect at least the 1.0x button)
    const speed1x = page.getByTestId('speed-preset-1')
    await expect(speed1x).toBeVisible()

    // Click 1.5x speed
    const speed15x = page.getByTestId('speed-preset-1.5')
    await expect(speed15x).toBeVisible()
    await speed15x.click()

    // Verify preference was persisted to localStorage
    const prefs = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    }, AUDIOBOOK_PREFS_KEY)

    expect(prefs).not.toBeNull()
    expect(prefs.defaultSpeed).toBe(1.5)
  })

  test('AC-3: Skip Silence toggle is visible and marked as coming soon', async ({ page }) => {
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    // Skip silence toggle should be visible
    const skipSilenceToggle = page.getByTestId('skip-silence-toggle')
    await expect(skipSilenceToggle).toBeVisible()

    // "Coming soon" badge should be visible
    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toContainText('Coming soon')

    // Toggle should be disabled
    await expect(skipSilenceToggle).toBeDisabled()
  })

  test('AC-4: Default sleep timer selection persists', async ({ page }) => {
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    // Select 30-minute sleep timer
    const timer30 = page.getByTestId('sleep-timer-30')
    await expect(timer30).toBeVisible()
    await timer30.click()

    // Verify persisted
    const prefs = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    }, AUDIOBOOK_PREFS_KEY)

    expect(prefs).not.toBeNull()
    expect(prefs.defaultSleepTimer).toBe(30)
  })

  test('AC-5: Auto-bookmark toggle persists preference', async ({ page }) => {
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    // Toggle auto-bookmark
    const autoBookmarkToggle = page.getByTestId('auto-bookmark-toggle')
    await expect(autoBookmarkToggle).toBeVisible()
    await autoBookmarkToggle.click()

    // Verify persisted
    const prefs = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    }, AUDIOBOOK_PREFS_KEY)

    expect(prefs).not.toBeNull()
    expect(prefs.autoBookmarkOnStop).toBe(true)
  })

  test('Settings panel closes on sheet dismiss', async ({ page }) => {
    await page.goto(`/library/test-audiobook-e108-s04/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible()
  })
})

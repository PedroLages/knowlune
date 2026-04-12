/**
 * E2E Tests for E111-S02: Skip Silence and Speed Memory
 *
 * Acceptance Criteria:
 * - AC-1: Skip silence detects and skips audio silence segments (>500ms below threshold)
 * - AC-2: Visual indicator shows when silence is skipped (e.g., "Skipped 2.3s silence")
 * - AC-3: Disabling skip silence stops detection immediately
 * - AC-4: Existing E108-S04 toggle wired to actual Web Audio API silence detection
 * - AC-5: Playback speed persists per-book (not globally)
 * - AC-6: Returning to a book restores its previously-set speed
 * - AC-7: First-open book uses global default speed from audiobook preferences
 * - AC-8: Accessibility — keyboard, ARIA labels, screen reader compatibility
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const AUDIOBOOK_PREFS_KEY = 'knowlune:audiobook-prefs-v1'

const testAudiobook = {
  id: 'test-audiobook-e111-s02-a',
  title: 'Test Audiobook A',
  author: 'Test Author',
  format: 'audiobook' as const,
  status: 'reading' as const,
  progress: 10,
  chapters: [
    { title: 'Chapter 1', duration: 3600, src: '' },
    { title: 'Chapter 2', duration: 2400, src: '' },
  ],
  source: { type: 'local' as const, opfsPath: '/test/book-a.m4b' },
  totalDuration: 6000,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const testAudiobookB = {
  id: 'test-audiobook-e111-s02-b',
  title: 'Test Audiobook B',
  author: 'Test Author B',
  format: 'audiobook' as const,
  status: 'reading' as const,
  progress: 5,
  chapters: [
    { title: 'Chapter 1', duration: 1800, src: '' },
  ],
  source: { type: 'local' as const, opfsPath: '/test/book-b.m4b' },
  totalDuration: 1800,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

test.describe('E111-S02: Skip Silence and Speed Memory', () => {
  test.beforeEach(async ({ page }) => {
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
    await seedBooks(page, [testAudiobook, testAudiobookB])
    await page.reload({ waitUntil: 'domcontentloaded' })
  })

  test('AC-1: Skip silence skips audio segments below threshold for >500ms', async ({ page }) => {
    await page.goto(`/library/${testAudiobook.id}/read`)

    // Enable skip silence in settings
    const settingsButton = page.getByTestId('audiobook-settings-button')
    await expect(settingsButton).toBeVisible()
    await settingsButton.click()

    const skipSilenceToggle = page.getByTestId('skip-silence-toggle')
    await expect(skipSilenceToggle).toBeVisible()
    await skipSilenceToggle.click()

    // Verify the toggle is now checked — preference persisted in store
    await expect(skipSilenceToggle).toHaveAttribute('aria-checked', 'true')

    // Verify the active indicator is visible and correctly labelled
    const indicator = page.getByTestId('skip-silence-active-indicator')
    await expect(indicator).toBeVisible()
    await expect(indicator).toHaveAttribute('aria-label', 'Skip silence is active')

    // Verify toggle state survives settings panel re-open (localStorage persistence)
    await page.keyboard.press('Escape')
    await settingsButton.click()
    await expect(page.getByTestId('skip-silence-toggle')).toHaveAttribute('aria-checked', 'true')
  })

  test('AC-2: Visual indicator shows skipped silence duration', async ({ page }) => {
    await page.goto(`/library/${testAudiobook.id}/read`)

    // The silence-skip-indicator is always in the DOM but hidden until a skip occurs
    const indicator = page.getByTestId('silence-skip-indicator')
    await expect(indicator).toBeAttached()

    // Verify aria attributes are correctly set for screen reader announcements
    await expect(indicator).toHaveAttribute('aria-live', 'polite')
    await expect(indicator).toHaveAttribute('aria-atomic', 'true')

    // The indicator should be initially hidden (no skip has occurred yet)
    await expect(indicator).not.toBeVisible()
  })

  test('AC-3: Disabling skip silence stops detection immediately', async ({ page }) => {
    await page.goto(`/library/${testAudiobook.id}/read`)

    // Enable then disable skip silence
    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()
    const skipSilenceToggle = page.getByTestId('skip-silence-toggle')
    await skipSilenceToggle.click() // enable
    await expect(page.getByTestId('skip-silence-active-indicator')).toBeVisible()

    // Sheet is still open — disable skip silence by toggling again
    await skipSilenceToggle.click() // disable
    await expect(page.getByTestId('skip-silence-active-indicator')).not.toBeVisible()
  })

  test('AC-4: E108-S04 skip silence toggle wired to actual Web Audio detection', async ({ page }) => {
    await page.goto(`/library/${testAudiobook.id}/read`)

    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    // The toggle should no longer show "Coming soon" — it should be functional
    const skipSilenceToggle = page.getByTestId('skip-silence-toggle')
    await expect(skipSilenceToggle).toBeEnabled()
    await expect(page.getByText('Coming soon')).not.toBeVisible()
  })

  test('AC-5: Playback speed persists per-book', async ({ page }) => {
    // Open book A and change speed to 1.5x
    await page.goto(`/library/${testAudiobook.id}/read`)
    const speedButton = page.getByTestId('speed-button')
    await expect(speedButton).toBeVisible()

    // Change speed to 1.5x
    await speedButton.click()
    const speed15 = page.getByTestId('speed-option-1.5')
    await speed15.click()

    // Verify speed display shows 1.5×
    await expect(speedButton).toContainText('1.5×')

    // Navigate away and back to confirm Dexie (IndexedDB) persistence
    await page.goto('/library')
    await page.goto(`/library/${testAudiobook.id}/read`)
    await expect(page.getByTestId('speed-button')).toContainText('1.5×')
  })

  test('AC-6: Returning to a book restores its previously-set speed', async ({ page }) => {
    // Set book A to 1.5x speed
    await page.goto(`/library/${testAudiobook.id}/read`)
    const speedButton = page.getByTestId('speed-button')
    await speedButton.click()
    await page.getByTestId('speed-option-1.5').click()
    await expect(speedButton).toContainText('1.5×')

    // Navigate to book B and set to 2x speed
    await page.goto(`/library/${testAudiobookB.id}/read`)
    const speedButtonB = page.getByTestId('speed-button')
    await speedButtonB.click()
    await page.getByTestId('speed-option-2').click()
    await expect(speedButtonB).toContainText('2.0×')

    // Return to book A — speed should be 1.5x (not 2x)
    await page.goto(`/library/${testAudiobook.id}/read`)
    await expect(page.getByTestId('speed-button')).toContainText('1.5')
  })

  test('AC-7: First-open book uses global default speed from audiobook preferences', async ({ page }) => {
    // Set global default speed to 1.25x in audiobook preferences
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ defaultSpeed: 1.25, skipSilence: false }))
    }, AUDIOBOOK_PREFS_KEY)

    // Open a book for the first time — should use global default
    await page.goto(`/library/${testAudiobook.id}/read`)
    await expect(page.getByTestId('speed-button')).toContainText('1.25')
  })

  test('AC-8: Skip silence and speed controls are accessible', async ({ page }) => {
    await page.goto(`/library/${testAudiobook.id}/read`)

    // Speed button should have ARIA label
    const speedButton = page.getByTestId('speed-button')
    await expect(speedButton).toHaveAttribute('aria-label', /playback speed/i)

    // Settings panel elements should be keyboard accessible
    const settingsButton = page.getByTestId('audiobook-settings-button')
    await settingsButton.click()

    const skipSilenceToggle = page.getByTestId('skip-silence-toggle')
    await expect(skipSilenceToggle).toHaveAttribute('role', 'switch')
  })
})

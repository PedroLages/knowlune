/**
 * E2E Tests for E111-S03: Sleep Timer End of Chapter
 *
 * Acceptance Criteria:
 * - AC-1: EOC mode fades out and pauses at chapter boundary
 * - AC-2: Chapter progress bar visible in popover when EOC active
 * - AC-3: EOC works for single-file M4B (chapterend event)
 * - AC-4: Countdown timer badge shows remaining time (regression)
 * - AC-5: Post-sleep toast appears on re-open (regression)
 * - AC-6: Accessible — keyboard, ARIA labels, screen reader
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/seed-helpers'
import { mockAudioElement } from '../support/helpers/audio-mock'
import { FIXED_DATE } from '../utils/test-time'

const BOOK_ID = 'test-audiobook-e111-s03'

const testAudiobook = {
  id: BOOK_ID,
  title: 'Test Audiobook Sleep Timer',
  author: 'Test Author',
  format: 'audiobook' as const,
  status: 'reading' as const,
  progress: 10,
  chapters: [
    {
      id: `${BOOK_ID}-ch1`,
      bookId: BOOK_ID,
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time' as const, seconds: 0 },
      duration: 600,
      src: '',
    },
    {
      id: `${BOOK_ID}-ch2`,
      bookId: BOOK_ID,
      title: 'Chapter 2',
      order: 1,
      position: { type: 'time' as const, seconds: 600 },
      duration: 600,
      src: '',
    },
  ],
  source: { type: 'local' as const, opfsPath: '/test/sleep-timer-book.m4b' },
  totalDuration: 1200,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

test.describe('E111-S03: Sleep Timer End of Chapter', () => {
  test.beforeEach(async ({ page }) => {
    await mockAudioElement(page)
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

  test('AC-1/AC-3: EOC badge shows "EOC" when end-of-chapter mode is active', async ({
    page,
  }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    const sleepTimerButton = page.getByTestId('sleep-timer-button')
    await expect(sleepTimerButton).toBeVisible()
    await sleepTimerButton.click()

    // Select "End of chapter"
    const eocOption = page.getByRole('option', { name: 'End of chapter' })
    await expect(eocOption).toBeVisible()
    await eocOption.click()

    // Badge should show "EOC"
    await expect(sleepTimerButton).toContainText('EOC')
  })

  test('AC-2: Chapter progress bar renders in popover when EOC active', async ({ page }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    const sleepTimerButton = page.getByTestId('sleep-timer-button')
    await sleepTimerButton.click()

    // Select EOC
    await page.getByRole('option', { name: 'End of chapter' }).click()

    // Re-open popover to see progress bar
    await sleepTimerButton.click()

    const progressBar = page.getByTestId('chapter-progress-bar')
    await expect(progressBar).toBeVisible()
    await expect(progressBar.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Current chapter progress'
    )
  })

  test('AC-4: Countdown timer badge shows remaining time', async ({ page }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    const sleepTimerButton = page.getByTestId('sleep-timer-button')
    await sleepTimerButton.click()

    // Select 30 minutes
    await page.getByRole('option', { name: '30 minutes' }).click()

    // Badge should show "30m"
    await expect(sleepTimerButton).toContainText('30m')

    // Chapter progress bar should NOT be visible (only for EOC)
    await sleepTimerButton.click()
    await expect(page.getByTestId('chapter-progress-bar')).not.toBeVisible()
  })

  test('AC-5: Post-sleep toast appears when sleep-timer-ended flag is set', async ({ page }) => {
    // Set the localStorage flag before navigating to the audiobook
    await page.evaluate(() => {
      localStorage.setItem('knowlune:sleep-timer-ended', '1')
    })

    await page.goto(`/library/${BOOK_ID}/read`)

    // Toast should appear
    await expect(page.getByText(/sleep timer ended/i)).toBeVisible({ timeout: 5000 })

    // Flag should be consumed (removed from localStorage)
    const flag = await page.evaluate(() => localStorage.getItem('knowlune:sleep-timer-ended'))
    expect(flag).toBeNull()
  })

  test('AC-6: Sleep timer button has correct ARIA label', async ({ page }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    const sleepTimerButton = page.getByTestId('sleep-timer-button')
    await expect(sleepTimerButton).toHaveAttribute('aria-label', 'Sleep timer')

    // Activate EOC — label should update
    await sleepTimerButton.click()
    await page.getByRole('option', { name: 'End of chapter' }).click()
    await expect(sleepTimerButton).toHaveAttribute('aria-label', /Sleep timer: EOC/)
  })

  test('AC-6: Sleep timer popover is keyboard navigable', async ({ page }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    // Focus the sleep timer button via keyboard
    const sleepTimerButton = page.getByTestId('sleep-timer-button')
    await sleepTimerButton.focus()
    await page.keyboard.press('Enter')

    // Popover listbox should be visible
    const listbox = page.getByRole('listbox', { name: 'Sleep timer' })
    await expect(listbox).toBeVisible()

    // Options should be present
    await expect(page.getByRole('option', { name: '15 minutes' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'End of chapter' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Off' })).toBeVisible()
  })

  test('EOC can be cancelled by selecting Off', async ({ page }) => {
    await page.goto(`/library/${BOOK_ID}/read`)

    const sleepTimerButton = page.getByTestId('sleep-timer-button')

    // Activate EOC
    await sleepTimerButton.click()
    await page.getByRole('option', { name: 'End of chapter' }).click()
    await expect(sleepTimerButton).toContainText('EOC')

    // Cancel by selecting Off
    // The popover re-renders as chapter progress updates, so use getByText for stability
    await sleepTimerButton.click()
    await expect(page.getByRole('listbox', { name: 'Sleep timer' })).toBeVisible()
    await page.locator('[role="listbox"] button:has-text("Off")').click({ force: true })

    // Badge should be gone
    await expect(sleepTimerButton).not.toContainText('EOC')
  })
})

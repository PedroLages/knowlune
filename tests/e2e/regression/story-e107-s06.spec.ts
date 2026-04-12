/**
 * E2E Tests for E107-S06: Fix Mini-Player Interactivity
 *
 * Acceptance Criteria:
 * - AC-1: Audio mini-player remains visible when audio is paused (not just when playing)
 * - AC-4: Play/pause button in AudioMiniPlayer toggles correctly without stale state
 *
 * Test Strategy:
 * - Seed the book into IndexedDB, then inject Zustand store state via the
 *   window.__audioPlayerStore__ test handle (exposed by main.tsx in dev mode)
 *   to simulate an active audiobook session without navigating through the reader.
 * - This avoids brittle reader-page navigation and targets the mini-player directly.
 *
 * NOTE: Headless browsers cannot play audio — tests assert component state
 * (isPlaying Zustand state, aria-label, icon) not actual audio output.
 */

import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_AUDIOBOOK = {
  id: 'e107-s06-audiobook',
  title: 'Mini-Player Test Book',
  author: 'Test Author',
  format: 'audiobook',
  status: 'reading',
  tags: [],
  chapters: [
    {
      id: 'ch-1',
      bookId: 'e107-s06-audiobook',
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
  ],
  source: { type: 'local', opfsPath: '/books/e107-s06/book.m4b' },
  totalDuration: 3600,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

/**
 * Stub HTMLMediaElement.play() so it resolves immediately in headless mode
 * (avoids autoplay-policy UnhandledPromiseRejection).
 */
async function mockAudioElement(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function () {
        // Mirror isPlaying to the Zustand store when play() is called
        ;(window as Window & { __TEST_PLAY_CALLED__?: boolean }).__TEST_PLAY_CALLED__ = true
        return Promise.resolve()
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: function () {
        ;(window as Window & { __TEST_PAUSE_CALLED__?: boolean }).__TEST_PAUSE_CALLED__ = true
      },
    })
  })
}

/**
 * Set up the page: mock audio, skip onboarding, seed book into IndexedDB.
 * Navigates to /library so the Layout (which renders AudioMiniPlayer) is mounted.
 */
async function setupMiniPlayerTest(page: import('@playwright/test').Page): Promise<void> {
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

  // Navigate to / first so we can seed IndexedDB
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Seed the test audiobook into IndexedDB
  await seedIndexedDBStore(page, DB_NAME, 'books', [TEST_AUDIOBOOK] as unknown as Record<
    string,
    unknown
  >[])

  // Navigate to /library — the Layout is mounted here and renders AudioMiniPlayer
  await page.goto('/library')
  await page.waitForLoadState('domcontentloaded')

  // Wait for the book store to be accessible via the window test handle
  await page.waitForFunction(
    () => !!(window as Window & { __audioPlayerStore__?: unknown }).__audioPlayerStore__,
    {
      timeout: 10000,
    }
  )

  // Load books into the book store first (normally triggered by Library page useEffect)
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bookStore = (window as any).__bookStore__
      if (!bookStore) return false
      const state = bookStore.getState()
      if (!state.isLoaded) {
        // Trigger loadBooks if not yet loaded
        state.loadBooks()
        return false
      }
      return state.books.length > 0
    },
    { timeout: 10000 }
  )

  // Set the current audiobook via the store test handle
  await page.evaluate((bookId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__audioPlayerStore__
    if (store) {
      store.getState().setCurrentBook(bookId)
    }
  }, TEST_AUDIOBOOK.id)
}

test.describe('E107-S06: Audio Mini-Player Interactivity', () => {
  test('AC-1: mini-player is visible when audio is paused (not only when playing)', async ({
    page,
  }) => {
    await setupMiniPlayerTest(page)

    // isPlaying defaults to false (paused) — mini-player must still be visible
    const miniPlayer = page.getByTestId('audio-mini-player')
    await expect(miniPlayer).toBeVisible({ timeout: 5000 })

    // The play/pause button should show "Play" (paused state) — exact match avoids "Open full player" collision
    const playPauseBtn = miniPlayer.getByRole('button', { name: 'Play', exact: true })
    await expect(playPauseBtn).toBeVisible()
    await expect(playPauseBtn).toHaveAttribute('aria-label', 'Play')

    // Mini-player must remain visible in paused state (regression from the old bug
    // where it was hidden whenever isPlaying was false)
    await expect(miniPlayer).toBeVisible()
  })

  test('AC-4: play/pause button aria-label reflects isPlaying state without stale closure', async ({
    page,
  }) => {
    await setupMiniPlayerTest(page)

    const miniPlayer = page.getByTestId('audio-mini-player')
    await expect(miniPlayer).toBeVisible({ timeout: 5000 })

    // Initially paused — button should say "Play" (exact match to avoid "Open full player" collision)
    await expect(miniPlayer.getByRole('button', { name: 'Play', exact: true })).toBeVisible()

    // Simulate isPlaying → true via store (as if audio started playing)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__audioPlayerStore__
      if (store) store.getState().setIsPlaying(true)
    })

    // Button should reactively update to "Pause" without stale closure
    await expect(miniPlayer.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(miniPlayer.getByRole('button', { name: 'Play', exact: true })).not.toBeVisible()

    // Simulate isPlaying → false (paused)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__audioPlayerStore__
      if (store) store.getState().setIsPlaying(false)
    })

    // Button should revert to "Play"
    await expect(miniPlayer.getByRole('button', { name: 'Play', exact: true })).toBeVisible({
      timeout: 3000,
    })
    await expect(miniPlayer.getByRole('button', { name: 'Pause', exact: true })).not.toBeVisible()
  })

  test('AC-4: play/pause button has correct type="button" attribute', async ({ page }) => {
    await setupMiniPlayerTest(page)

    const miniPlayer = page.getByTestId('audio-mini-player')
    await expect(miniPlayer).toBeVisible({ timeout: 5000 })

    // All buttons in the mini-player should have explicit type="button"
    // (prevents unintentional form submission)
    const buttons = miniPlayer.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toHaveAttribute('type', 'button')
    }
  })
})

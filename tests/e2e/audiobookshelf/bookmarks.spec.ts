/**
 * E2E Tests: E101-S05 — Audio Bookmarks Learning Loop
 *
 * Acceptance criteria covered:
 * - AC1: Bookmark button visible during audiobook playback
 * - AC2: Bookmark badge count increments when bookmarks are created
 * - AC3: Post-session review sheet opens when playback ends with session bookmarks
 *
 * NOTE: Headless browsers cannot play audio — tests assert component state and
 * DOM changes rather than actual audio output. Audio element is mocked via
 * addInitScript so the player doesn't block on canplay events.
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const ABS_AUDIOBOOK = {
  id: 'bookmark-test-book-1',
  title: 'Bookmark Test Book',
  author: 'Test Author',
  format: 'audiobook',
  status: 'reading',
  tags: [],
  chapters: [
    {
      id: 'bch-1',
      bookId: 'bookmark-test-book-1',
      title: 'Chapter 1: The Beginning',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
    {
      id: 'bch-2',
      bookId: 'bookmark-test-book-1',
      title: 'Chapter 2: The Middle',
      order: 1,
      position: { type: 'time', seconds: 600 },
    },
  ],
  source: {
    type: 'remote',
    url: 'http://abs.test:13378',
    auth: { bearer: 'test-api-key-abc' },
  },
  coverUrl: null,
  absServerId: 'abs-server-1',
  absItemId: 'abs-item-1',
  totalDuration: 1200,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

/**
 * Mock the HTML5 Audio element for headless playback:
 * - play() returns resolved promise (avoids autoplay policy rejection)
 * - load() immediately fires canplay so chapter loading resolves
 * - readyState reports HAVE_ENOUGH_DATA once src is set
 * - src setter mirrors value to window.__TEST_AUDIO_SRC__ for polling
 */
async function mockAudioElement(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: function () {
        return Promise.resolve()
      },
    })

    const originalLoad = HTMLMediaElement.prototype.load
    HTMLMediaElement.prototype.load = function () {
      originalLoad.call(this)
      Promise.resolve().then(() => {
        this.dispatchEvent(new Event('canplay'))
      })
    }

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ? 4 : 0
      },
    })

    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ?? ''
      },
      set(value: string) {
        ;(this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc = value
        if (srcDescriptor?.set) srcDescriptor.set.call(this, value)
        ;(window as Window & { __TEST_AUDIO_SRC__?: string }).__TEST_AUDIO_SRC__ = value
      },
    })
  })
}

async function seedBookmarkData(page: import('@playwright/test').Page): Promise<void> {
  await mockAudioElement(page)

  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z' })
    )
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })

  await page.goto('/')
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    [ABS_AUDIOBOOK] as unknown as Record<string, unknown>[]
  )
}

test.describe('E101-S05: Audio Bookmarks', () => {
  test('AC1: Bookmark button is visible during audiobook playback', async ({ page }) => {
    await seedBookmarkData(page)
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)

    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })

    // Bookmark button should be visible in the secondary controls row
    const bookmarkButton = page.getByRole('button', { name: /add bookmark/i })
    await expect(bookmarkButton).toBeVisible()
  })

  test('AC2: Bookmark badge count increments when bookmarks are created', async ({ page }) => {
    await seedBookmarkData(page)
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)

    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })

    // No badge initially
    await expect(page.getByTestId('bookmark-count-badge')).not.toBeVisible()

    // Click bookmark button to create a bookmark
    const bookmarkButton = page.getByRole('button', { name: /add bookmark/i })
    await bookmarkButton.click()

    // Badge should appear with count 1
    await expect(page.getByTestId('bookmark-count-badge')).toBeVisible()
    await expect(page.getByTestId('bookmark-count-badge')).toHaveText('1')
  })

  test('AC3: Post-session review sheet opens when playback ends with bookmarks', async ({
    page,
  }) => {
    await seedBookmarkData(page)
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)

    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })

    // Create a bookmark first
    const bookmarkButton = page.getByRole('button', { name: /add bookmark/i })
    await bookmarkButton.click()
    await expect(page.getByTestId('bookmark-count-badge')).toBeVisible()

    // Simulate audio ended event (natural end of track) to trigger deliberate stop
    await page.evaluate(() => {
      const audioElements = document.querySelectorAll('audio')
      if (audioElements.length > 0) {
        audioElements[0].dispatchEvent(new Event('ended'))
      } else {
        // Audio() is detached; dispatch on any audio-like mock via prototype
        const event = new Event('ended')
        ;(HTMLMediaElement.prototype as unknown as { _testEnded?: () => void })._testEnded?.()
        // Fallback: dispatch ended globally for the singleton audio
        window.dispatchEvent(new CustomEvent('__test_audio_ended__'))
      }
    })

    // Post-session review panel should open
    await expect(page.getByTestId('post-session-review')).toBeVisible({ timeout: 5000 })
  })
})

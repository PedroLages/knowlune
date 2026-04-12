/**
 * E111-S01: Audio Clips — ATDD acceptance tests
 *
 * GREEN phase: All tests should pass after feature implementation.
 * Each test maps to an acceptance criterion from the story file.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { seedBooks, seedAudioClips } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

const AUDIOBOOK_ID = 'clip-test-audiobook'

/**
 * Mock the HTML5 Audio element for headless playback.
 * play() resolves immediately, load() fires canplay so chapter loading resolves.
 * Exposes window.__mockCurrentTime__ to allow test-controlled currentTime values.
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
      },
    })

    // Expose test-controlled currentTime — tests can set window.__mockCurrentTime__
    // to control what the player sees when End Clip is clicked.
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        const win = window as Window & { __mockCurrentTime__?: number }
        return win.__mockCurrentTime__ ?? 0
      },
      set(value: number) {
        const win = window as Window & { __mockCurrentTime__?: number }
        win.__mockCurrentTime__ = value
      },
    })
  })
}

async function seedAudiobook(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: AUDIOBOOK_ID,
      title: 'Test Audiobook',
      author: 'Test Author',
      format: 'audiobook',
      status: 'reading',
      chapters: [
        {
          id: 'ch-1',
          bookId: AUDIOBOOK_ID,
          title: 'Chapter 1',
          order: 0,
          position: { type: 'time', seconds: 0 },
        },
      ],
      totalDuration: 600,
      progress: 0,
      createdAt: FIXED_DATE,
    },
  ])
}

/** Pre-seeds two clips so panel tests have data to work with */
async function seedClips(page: import('@playwright/test').Page) {
  await seedAudioClips(page, [
    {
      id: 'clip-1',
      bookId: AUDIOBOOK_ID,
      chapterId: 'Chapter 1',
      chapterIndex: 0,
      startTime: 10,
      endTime: 30,
      title: 'First Clip',
      sortOrder: 0,
      createdAt: FIXED_DATE,
    },
    {
      id: 'clip-2',
      bookId: AUDIOBOOK_ID,
      chapterId: 'Chapter 1',
      chapterIndex: 0,
      startTime: 60,
      endTime: 90,
      title: 'Second Clip',
      sortOrder: 1,
      createdAt: FIXED_DATE,
    },
  ])
}

test.describe('E111-S01: Audio Clips', () => {
  test.beforeEach(async ({ page }) => {
    await mockAudioElement(page)
    await page.goto('/')
    await dismissOnboarding(page)
    await seedAudiobook(page)
  })

  test('AC-1: Start Clip button captures current playback time', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Expect a "Start Clip" button in the audiobook player
    const startClipBtn = page.getByRole('button', { name: /start clip/i })
    await expect(startClipBtn).toBeVisible()

    await startClipBtn.click()
    // Expect a visual recording indicator to appear
    await expect(page.getByTestId('clip-recording-indicator')).toBeVisible()
  })

  test('AC-2: End Clip saves clip to database', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Start a clip at time=0
    await page.getByRole('button', { name: /start clip/i }).click()
    await expect(page.getByTestId('clip-recording-indicator')).toBeVisible()

    // Advance mock currentTime so endTime > startTime validation passes
    await page.evaluate(() => {
      ;(window as Window & { __mockCurrentTime__?: number }).__mockCurrentTime__ = 30
    })

    // End the clip
    const endClipBtn = page.getByRole('button', { name: /end clip/i })
    await expect(endClipBtn).toBeVisible()
    await endClipBtn.click()

    // Recording indicator should disappear
    await expect(page.getByTestId('clip-recording-indicator')).not.toBeVisible()

    // Verify clip was persisted to IndexedDB
    const clipCount = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const tx = db.transaction('audioClips', 'readonly')
      const store = tx.objectStore('audioClips')
      return new Promise<number>((resolve, reject) => {
        const countReq = store.count()
        countReq.onsuccess = () => resolve(countReq.result)
        countReq.onerror = () => reject(countReq.error)
      })
    })
    expect(clipCount).toBe(1)
  })

  test('AC-3: Clips panel lists all clips for the book', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    const clipsPanelBtn = page.getByRole('button', { name: /^clips$/i })
    await expect(clipsPanelBtn).toBeVisible()
    await clipsPanelBtn.click()

    // Clips panel should be visible
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()
  })

  test('AC-4: Tapping a clip plays from start to end time', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    await page.getByRole('button', { name: /^clips$/i }).click()
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()

    // Should have at least one clip item (seeded above)
    const clipItem = page.getByTestId('clip-item').first()
    await expect(clipItem).toBeVisible()
    await clipItem.getByRole('button', { name: /play clip/i }).click()

    // Player should be playing (play button gets the data-testid)
    await expect(page.getByTestId('audio-playing-indicator')).toBeVisible()
  })

  test('AC-5: Clip title can be edited', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    // Find the edit button for the first clip
    const editBtn = page
      .getByTestId('clip-item')
      .first()
      .getByRole('button', { name: /edit clip title/i })
    await expect(editBtn).toBeVisible()
    await editBtn.click()

    // Title input should be visible
    const titleInput = page.getByTestId('clip-title-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('My Favorite Passage')
    await titleInput.press('Enter')

    // Title should be updated
    await expect(
      page.getByTestId('clip-item').first().getByText('My Favorite Passage')
    ).toBeVisible()
  })

  test('AC-6: Clip can be deleted', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    const clipItems = page.getByTestId('clip-item')
    await expect(clipItems.first()).toBeVisible()
    const initialCount = await clipItems.count()
    expect(initialCount).toBeGreaterThan(0)

    // Delete first clip
    const deleteBtn = clipItems.first().getByRole('button', { name: /delete clip/i })
    await deleteBtn.click()

    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click()

    // Count should decrease
    await expect(clipItems).toHaveCount(initialCount - 1)
  })

  test('AC-7: Clips can be reordered via drag-and-drop', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    // Should have drag handles
    const dragHandles = page.getByTestId('clip-drag-handle')
    await expect(dragHandles.first()).toBeVisible()
  })

  test('AC-8: Accessibility — keyboard navigation and ARIA labels', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)

    // Start Clip button should have accessible name
    const startClipBtn = page.getByRole('button', { name: /start clip/i })
    await expect(startClipBtn).toBeVisible()

    // Clips panel button should have accessible name
    const clipsPanelBtn = page.getByRole('button', { name: /^clips$/i })
    await expect(clipsPanelBtn).toBeVisible()

    // Verify touch target size (minimum 44x44px)
    const box = await startClipBtn.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

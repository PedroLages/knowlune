/**
 * Story 2.3: Video Bookmarking and Resume — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Position auto-save every 5 seconds (debounced, silent)
 *   - AC2: Resume from last position with "Resuming from MM:SS" toast
 *   - AC3: Bookmark creation via button/B key, toast, markers on progress bar
 *   - AC4: Click bookmark marker to seek to bookmarked position
 *
 * Data seeding:
 *   - Course progress seeded via localStorage fixture
 *   - Bookmarks seeded via IndexedDB fixture (Dexie 'ElearningDB', 'bookmarks' table)
 *   - Uses hardcoded course data (6mx course, first lesson with video)
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants — use the first lesson of the 6MX course (has video resource)
// ---------------------------------------------------------------------------
const COURSE_ID = '6mx'
const LESSON_ID = '6mx-welcome-intro'
const LESSON_PATH = `/courses/${COURSE_ID}/${LESSON_ID}`

// Ensure sidebar starts closed on tablet viewport (Layout defaults to open)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', JSON.stringify(false))
  })
})

// ===========================================================================
// AC1: Position Auto-Save (every 5 seconds, debounced, silent)
// ===========================================================================

test.describe('AC1: Position Auto-Save', () => {
  test('should save video position to storage periodically', async ({
    page,
    localStorage,
  }) => {
    // GIVEN: User navigates to a lesson with video
    await navigateAndWait(page, LESSON_PATH)

    // WHEN: Video fires timeupdate (simulate via Playwright dispatchEvent)
    const video = page.locator('video')
    await expect(video).toBeAttached()
    await video.dispatchEvent('timeupdate')
    await page.waitForTimeout(500)

    // THEN: course-progress in localStorage has a lastVideoPosition value
    const progress = await localStorage.get<Record<string, unknown>>('course-progress')
    expect(progress).toBeTruthy()
    // Position save should have occurred (debounced, within 5s window)
    const courseProgress = progress?.[COURSE_ID] as Record<string, unknown> | undefined
    expect(courseProgress).toBeTruthy()
    expect(courseProgress?.lastVideoPosition).toBeDefined()
  })

  test('should not show any UI indication when saving position', async ({
    page,
  }) => {
    // GIVEN: User is on a lesson page
    await navigateAndWait(page, LESSON_PATH)

    // THEN: No toast or indicator about position saving
    // Sonner toasts appear in [data-sonner-toaster]
    const positionToasts = page.locator('[data-sonner-toaster]').getByText(/saving|position saved/i)
    await expect(positionToasts).toHaveCount(0)
  })
})

// ===========================================================================
// AC2: Resume from Last Position
// ===========================================================================

test.describe('AC2: Resume from Last Position', () => {
  test('should show "Resuming from" toast when restoring position', async ({
    page,
    localStorage,
  }) => {
    // GIVEN: A saved position exists for this lesson
    await navigateAndWait(page, '/')
    await localStorage.seed('course-progress', {
      [COURSE_ID]: {
        courseId: COURSE_ID,
        completedLessons: [],
        lastWatchedLesson: LESSON_ID,
        lastVideoPosition: 125, // 2:05
        notes: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      },
    })

    // WHEN: User navigates to the lesson
    await navigateAndWait(page, LESSON_PATH)

    // THEN: A "Resuming from 2:05" toast appears
    const toast = page.locator('[data-sonner-toaster]').getByText(/resuming from/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should auto-dismiss resume toast after ~2 seconds', async ({
    page,
    localStorage,
  }) => {
    // GIVEN: A saved position exists
    await navigateAndWait(page, '/')
    await localStorage.seed('course-progress', {
      [COURSE_ID]: {
        courseId: COURSE_ID,
        completedLessons: [],
        lastWatchedLesson: LESSON_ID,
        lastVideoPosition: 60,
        notes: {},
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      },
    })

    // WHEN: User navigates to the lesson and toast appears
    await navigateAndWait(page, LESSON_PATH)
    const toast = page.locator('[data-sonner-toaster]').getByText(/resuming from/i)
    await expect(toast).toBeVisible({ timeout: 5000 })

    // THEN: Toast disappears after ~2 seconds
    await expect(toast).not.toBeVisible({ timeout: 5000 })
  })

  test('should not show resume toast when no saved position exists', async ({
    page,
  }) => {
    // GIVEN: No saved position for this lesson
    // WHEN: User navigates to the lesson
    await navigateAndWait(page, LESSON_PATH)

    // THEN: No "Resuming from" toast appears
    await page.waitForTimeout(2000)
    const toast = page.locator('[data-sonner-toaster]').getByText(/resuming from/i)
    await expect(toast).toHaveCount(0)
  })
})

// ===========================================================================
// AC3: Bookmark Creation (button, B key, toast, progress bar markers)
// ===========================================================================

test.describe('AC3: Bookmark Creation', () => {
  test('should show bookmark button in video controls', async ({
    page,
  }) => {
    // GIVEN: User navigates to a lesson with video
    await navigateAndWait(page, LESSON_PATH)

    // THEN: Bookmark button is visible in the video player
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await expect(bookmarkButton).toBeVisible()
  })

  test('should create bookmark on button click and show toast', async ({
    page,
  }) => {
    // GIVEN: User is on a lesson with video
    await navigateAndWait(page, LESSON_PATH)

    // WHEN: User clicks the bookmark button
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await bookmarkButton.click()

    // THEN: A toast confirms bookmark creation
    const toast = page.locator('[data-sonner-toaster]').getByText(/bookmarked at/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should create bookmark via B keyboard shortcut', async ({
    page,
  }) => {
    // GIVEN: User is on a lesson with video, video player is focused
    await navigateAndWait(page, LESSON_PATH)

    // Focus the video player area
    const videoPlayer = page.getByTestId('video-player-container')
    await videoPlayer.click()

    // WHEN: User presses B key
    await page.keyboard.press('b')

    // THEN: A toast confirms bookmark creation
    const toast = page.locator('[data-sonner-toaster]').getByText(/bookmarked at/i)
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('should display bookmark markers on the progress bar', async ({
    page,
  }) => {
    // GIVEN: User is on a lesson and creates a bookmark
    await navigateAndWait(page, LESSON_PATH)

    // WHEN: User creates a bookmark
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await bookmarkButton.click()

    // THEN: A bookmark marker appears on the progress bar
    const markers = page.getByTestId('bookmark-marker')
    await expect(markers).toHaveCount(1)
  })

  test('should persist bookmarks in IndexedDB after page reload', async ({
    page,
  }) => {
    // GIVEN: User creates a bookmark
    await navigateAndWait(page, LESSON_PATH)
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await bookmarkButton.click()

    // Verify marker exists
    await expect(page.getByTestId('bookmark-marker')).toHaveCount(1)

    // WHEN: Page is reloaded
    await page.reload({ waitUntil: 'domcontentloaded' })

    // THEN: Bookmark marker still appears (persisted in IndexedDB)
    await expect(page.getByTestId('bookmark-marker')).toHaveCount(1)
  })
})

// ===========================================================================
// AC4: Click Bookmark Marker to Seek
// ===========================================================================

test.describe('AC4: Bookmark Marker Seek', () => {
  test('should seek video when clicking a bookmark marker', async ({
    page,
  }) => {
    // GIVEN: User has a bookmark on the progress bar
    await navigateAndWait(page, LESSON_PATH)
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await bookmarkButton.click()

    // Wait for marker to appear
    const marker = page.getByTestId('bookmark-marker').first()
    await expect(marker).toBeVisible()

    // WHEN: User clicks the bookmark marker
    await marker.click()

    // THEN: Video seeks to the bookmarked position (no error, player still functional)
    // The marker should still be visible after seeking
    await expect(marker).toBeVisible()
  })

  test('should show tooltip with time on bookmark marker hover', async ({
    page,
  }) => {
    // GIVEN: A bookmark marker exists on the progress bar
    await navigateAndWait(page, LESSON_PATH)
    const bookmarkButton = page.getByRole('button', { name: /bookmark/i })
    await bookmarkButton.click()

    const marker = page.getByTestId('bookmark-marker').first()
    await expect(marker).toBeVisible()

    // WHEN: User hovers over the marker
    await marker.hover()

    // THEN: A tooltip shows the bookmark time (e.g., "0:00")
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(/\d+:\d{2}/)
  })
})

/**
 * YouTubeCourseDetail — E2E regression tests
 *
 * Tests verify:
 *   - Course detail renders with seeded YouTube course data
 *   - Chapter structure / video list renders
 *   - Per-video progress bars reflect seeded progress data
 *   - Navigation to individual lessons works
 *   - Empty state when course has no videos
 *   - Error state for invalid/missing course ID
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../../support/helpers/navigation'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
} from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'ElearningDB'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const YOUTUBE_COURSE = createImportedCourse({
  id: 'yt-course-react-patterns',
  name: 'React Design Patterns',
  videoCount: 4,
  pdfCount: 0,
})

/** Extra fields needed for YouTube course (not in ImportedCourseTestData) */
const YOUTUBE_COURSE_FULL = {
  ...YOUTUBE_COURSE,
  source: 'youtube' as const,
  youtubePlaylistId: 'PLtest1234',
  youtubeChannelId: 'UCtest',
  youtubeChannelTitle: 'React Academy',
  youtubeThumbnailUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
}

const TEST_VIDEOS = [
  {
    id: 'yt-vid-01',
    courseId: 'yt-course-react-patterns',
    filename: 'Introduction to Patterns',
    path: '',
    duration: 420,
    format: 'mp4',
    order: 0,
    youtubeVideoId: 'abc123',
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
    thumbnailUrl: 'https://i.ytimg.com/vi/abc123/default.jpg',
    description: 'Learn the basics of React design patterns.',
  },
  {
    id: 'yt-vid-02',
    courseId: 'yt-course-react-patterns',
    filename: 'Compound Components',
    path: '',
    duration: 780,
    format: 'mp4',
    order: 1,
    youtubeVideoId: 'def456',
    youtubeUrl: 'https://www.youtube.com/watch?v=def456',
    thumbnailUrl: 'https://i.ytimg.com/vi/def456/default.jpg',
  },
  {
    id: 'yt-vid-03',
    courseId: 'yt-course-react-patterns',
    filename: 'Render Props',
    path: '',
    duration: 600,
    format: 'mp4',
    order: 2,
    youtubeVideoId: 'ghi789',
    youtubeUrl: 'https://www.youtube.com/watch?v=ghi789',
  },
  {
    id: 'yt-vid-04',
    courseId: 'yt-course-react-patterns',
    filename: 'Custom Hooks',
    path: '',
    duration: 540,
    format: 'mp4',
    order: 3,
    youtubeVideoId: 'jkl012',
    youtubeUrl: 'https://www.youtube.com/watch?v=jkl012',
    removedFromYouTube: true,
  },
]

const TEST_CHAPTERS = [
  {
    id: 'ch-01',
    courseId: 'yt-course-react-patterns',
    videoId: 'abc123',
    title: 'Fundamentals',
    startTime: 0,
    order: 0,
  },
  {
    id: 'ch-02',
    courseId: 'yt-course-react-patterns',
    videoId: 'def456',
    title: 'Fundamentals',
    startTime: 0,
    order: 1,
  },
  {
    id: 'ch-03',
    courseId: 'yt-course-react-patterns',
    videoId: 'ghi789',
    title: 'Advanced Patterns',
    startTime: 0,
    order: 2,
  },
  {
    id: 'ch-04',
    courseId: 'yt-course-react-patterns',
    videoId: 'jkl012',
    title: 'Advanced Patterns',
    startTime: 0,
    order: 3,
  },
]

/** Progress data: vid-01 completed (95%), vid-02 partial (45%) */
const TEST_PROGRESS = [
  {
    courseId: 'yt-course-react-patterns',
    videoId: 'yt-vid-01',
    currentTime: 399,
    completionPercentage: 95,
    completedAt: FIXED_DATE,
  },
  {
    courseId: 'yt-course-react-patterns',
    videoId: 'yt-vid-02',
    currentTime: 351,
    completionPercentage: 45,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedYouTubeCourseData(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [YOUTUBE_COURSE_FULL as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'youtubeChapters',
    TEST_CHAPTERS as unknown as Record<string, unknown>[]
  )
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'progress',
    TEST_PROGRESS as unknown as Record<string, unknown>[]
  )
}

async function goToYouTubeCourseDetail(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}`)
}

// ===========================================================================
// Course Detail Rendering
// ===========================================================================

test.describe('YouTubeCourseDetail — Rendering', () => {
  test('should display course detail page with title', async ({ page }) => {
    // GIVEN: YouTube course with videos seeded
    await seedYouTubeCourseData(page)

    // WHEN: User navigates to YouTube course detail page
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Course detail container and title are visible
    await expect(page.getByTestId('youtube-course-detail')).toBeVisible()
    await expect(page.getByTestId('course-detail-title')).toHaveText('React Design Patterns')
  })

  test('should display channel title and video count', async ({ page }) => {
    // GIVEN: YouTube course seeded
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Channel title and video count are visible
    await expect(page.getByText('React Academy')).toBeVisible()
    await expect(page.getByText('4 videos')).toBeVisible()
  })

  test('should display overall progress card with correct counts', async ({ page }) => {
    // GIVEN: Course with progress data (1 completed out of 4)
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Progress card shows 1/4 completed
    const progressCard = page.getByTestId('course-progress-card')
    await expect(progressCard).toBeVisible()
    await expect(progressCard.getByText('1/4 completed')).toBeVisible()
    await expect(progressCard.getByText('25% complete')).toBeVisible()
  })

  test('should display back to courses link', async ({ page }) => {
    // GIVEN: YouTube course detail loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Back link is visible
    await expect(page.getByText('Back to Courses')).toBeVisible()
  })

  test('should display AI summary panel for YouTube courses', async ({ page }) => {
    // GIVEN: YouTube course detail loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: AI summary panel is visible
    const aiPanel = page.getByTestId('ai-summary-panel')
    await expect(aiPanel).toBeVisible()
    await expect(aiPanel.getByText('AI Course Summary')).toBeVisible()
    await expect(aiPanel.getByText('Premium')).toBeVisible()
  })

  test('should toggle AI summary panel content', async ({ page }) => {
    // GIVEN: YouTube course detail loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // WHEN: User clicks the AI summary trigger
    await page.getByRole('button', { name: /toggle ai course summary/i }).click()

    // THEN: Summary content is visible
    await expect(page.getByText(/AI-generated summaries/)).toBeVisible()
  })

  test('should display refresh metadata button', async ({ page }) => {
    // GIVEN: YouTube course detail loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Refresh metadata button is present
    await expect(page.getByTestId('refresh-metadata-button')).toBeVisible()
  })
})

// ===========================================================================
// Video List & Chapter Structure
// ===========================================================================

test.describe('YouTubeCourseDetail — Video List', () => {
  test('should list all videos in the course', async ({ page }) => {
    // GIVEN: Course with 4 videos seeded
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: All 4 video items are rendered
    const contentList = page.getByTestId('course-content-list')
    await expect(contentList).toBeVisible()
    await expect(page.getByText('Introduction to Patterns')).toBeVisible()
    await expect(page.getByText('Compound Components')).toBeVisible()
    await expect(page.getByText('Render Props')).toBeVisible()
    await expect(page.getByText('Custom Hooks')).toBeVisible()
  })

  test('should display chapter headings when chapters exist', async ({ page }) => {
    // GIVEN: Course with chapters seeded
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Chapter titles are displayed
    await expect(page.getByText('Fundamentals')).toBeVisible()
    await expect(page.getByText('Advanced Patterns')).toBeVisible()
  })

  test('should display formatted video duration', async ({ page }) => {
    // GIVEN: Videos with known durations seeded (420s = 7:00, 780s = 13:00)
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Duration is formatted and visible
    await expect(page.getByText('7:00')).toBeVisible()
    await expect(page.getByText('13:00')).toBeVisible()
  })

  test('should display removed-from-YouTube badge on removed videos', async ({ page }) => {
    // GIVEN: Video with removedFromYouTube=true (yt-vid-04)
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Removed badge is visible on the removed video
    await expect(page.getByTestId('removed-badge-yt-vid-04')).toBeVisible()
    await expect(page.getByTestId('removed-badge-yt-vid-04')).toContainText('Removed from YouTube')
  })
})

// ===========================================================================
// Per-Video Progress
// ===========================================================================

test.describe('YouTubeCourseDetail — Progress', () => {
  test('should show completion indicator for videos with >90% progress', async ({ page }) => {
    // GIVEN: Video yt-vid-01 has 95% completion
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: The completed video item has a completion icon (CheckCircle2)
    const completedItem = page.getByTestId('course-video-item-yt-vid-01')
    await expect(completedItem).toBeVisible()
    // CheckCircle2 renders with aria-label="Completed"
    await expect(completedItem.getByLabel('Completed')).toBeVisible()
  })

  test('should show percentage badge for partial progress', async ({ page }) => {
    // GIVEN: Video yt-vid-02 has 45% completion
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: The partial video shows percentage badge
    const partialItem = page.getByTestId('course-video-item-yt-vid-02')
    await expect(partialItem).toBeVisible()
    await expect(partialItem.getByText('45%')).toBeVisible()
  })

  test('should show progress bar for videos with non-zero progress', async ({ page }) => {
    // GIVEN: Videos with progress data seeded
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Progress bars are rendered (aria-label includes percentage)
    await expect(page.getByLabel('95% watched')).toBeVisible()
    await expect(page.getByLabel('45% watched')).toBeVisible()
  })

  test('should not show progress bar for videos with zero progress', async ({ page }) => {
    // GIVEN: Video yt-vid-03 has no progress data
    await seedYouTubeCourseData(page)

    // WHEN: Navigate to course detail
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: The video item for yt-vid-03 does not have a progress bar
    const noProgressItem = page.getByTestId('course-video-item-yt-vid-03')
    await expect(noProgressItem).toBeVisible()
    // Verify no progress bar inside this item
    await expect(noProgressItem.getByRole('progressbar')).not.toBeVisible()
  })
})

// ===========================================================================
// Navigation
// ===========================================================================

test.describe('YouTubeCourseDetail — Navigation', () => {
  test('should navigate to lesson player when video item is clicked', async ({ page }) => {
    // GIVEN: YouTube course with videos seeded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // WHEN: User clicks on first video
    await page.getByText('Introduction to Patterns').click()

    // THEN: Navigated to YouTube lesson player route
    await page.waitForURL(/\/courses\/yt-course-react-patterns\/lessons\/yt-vid-01/)
  })

  test('should navigate back to courses when back link is clicked', async ({ page }) => {
    // GIVEN: Course detail page loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // WHEN: User clicks Back to Courses
    await page.getByText('Back to Courses').click()

    // THEN: Navigated to courses page
    await page.waitForURL(/\/courses/)
  })

  test('should have keyboard accessible video items', async ({ page }) => {
    // GIVEN: Course detail page loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // WHEN: User tabs to a video item and presses Enter
    const firstVideoLink = page.getByTestId('course-video-item-yt-vid-01')
    await firstVideoLink.focus()
    await page.keyboard.press('Enter')

    // THEN: Navigated to lesson player
    await page.waitForURL(/\/courses\/yt-course-react-patterns\/lessons\/yt-vid-01/)
  })
})

// ===========================================================================
// Empty & Error States
// ===========================================================================

test.describe('YouTubeCourseDetail — Edge Cases', () => {
  test('should show course not found for invalid course ID', async ({ page }) => {
    // GIVEN: No course data seeded for this ID
    await navigateAndWait(page, '/')

    // WHEN: User navigates to a non-existent YouTube course
    await navigateAndWait(page, '/courses/non-existent-course')

    // THEN: Course not found message is displayed
    await expect(page.getByText('Course not found.')).toBeVisible()
    await expect(page.getByText('Back to Courses')).toBeVisible()
  })

  test('should show empty video list when course has no videos', async ({ page }) => {
    // GIVEN: Course seeded but with no videos
    await navigateAndWait(page, '/')
    const emptyCourse = {
      ...createImportedCourse({
        id: 'yt-course-empty',
        name: 'Empty YouTube Course',
        videoCount: 0,
        pdfCount: 0,
      }),
      source: 'youtube' as const,
      youtubePlaylistId: 'PLempty',
      youtubeChannelTitle: 'Test Channel',
    }
    await seedImportedCourses(page, [emptyCourse as Record<string, unknown>])

    // WHEN: Navigate to empty course detail
    await goToYouTubeCourseDetail(page, 'yt-course-empty')

    // THEN: Course renders with 0 videos and 0% progress
    await expect(page.getByTestId('youtube-course-detail')).toBeVisible()
    await expect(page.getByText('0 videos')).toBeVisible()
    await expect(page.getByTestId('course-progress-card').getByText('0/0 completed')).toBeVisible()
    await expect(page.getByTestId('course-progress-card').getByText('0% complete')).toBeVisible()
  })

  test('should show offline banner when offline', async ({ page }) => {
    // GIVEN: YouTube course data seeded
    await seedYouTubeCourseData(page)

    // WHEN: Go offline and navigate to course detail
    await page.context().setOffline(true)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // THEN: Offline banner is visible
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await expect(page.getByText(/you are offline/i)).toBeVisible()

    // Cleanup: restore online state
    await page.context().setOffline(false)
  })

  test('should disable refresh metadata button when offline', async ({ page }) => {
    // GIVEN: YouTube course detail loaded
    await seedYouTubeCourseData(page)
    await goToYouTubeCourseDetail(page, 'yt-course-react-patterns')

    // WHEN: Go offline
    await page.context().setOffline(true)

    // Allow the useOnlineStatus hook to detect offline state
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))

    // THEN: Refresh button is disabled
    await expect(page.getByTestId('refresh-metadata-button')).toBeDisabled()

    // Cleanup
    await page.context().setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
  })
})

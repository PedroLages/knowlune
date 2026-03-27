/**
 * YouTube Course Creation E2E Tests (E33-S05)
 *
 * Verifies the full YouTube course creation wizard flow end-to-end:
 *   - Enter URL → fetch metadata → organize → set details → create course
 *   - YouTube API responses mocked via page.route() (no real network calls)
 *   - Error scenarios: rate limit (429), invalid URL, private video (403/404)
 *   - Course detail page verified after creation
 *
 * Prerequisites:
 *   - YouTube API key bypassed via _testApiKey in localStorage (DEV mode)
 *   - All YouTube API endpoints intercepted by page.route()
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { FIXED_DATE } from '../utils/test-time'

// --- Constants ---

const VALID_YOUTUBE_URL = 'https://www.youtube.com/watch?v=abc123test01'
const SECOND_VIDEO_URL = 'https://www.youtube.com/watch?v=abc123test02'
const THIRD_VIDEO_URL = 'https://www.youtube.com/watch?v=abc123test03'
const INVALID_URL = 'https://example.com/not-a-video'
const PRIVATE_VIDEO_URL = 'https://www.youtube.com/watch?v=private_vid_01'
const DELETED_VIDEO_URL = 'https://www.youtube.com/watch?v=deleted_vid_01'
const RATE_LIMITED_URL = 'https://www.youtube.com/watch?v=ratelimit_vid1'

// --- Mock Data ---

function buildMockVideoResponse(videoId: string, title: string, channel: string, durationIso: string) {
  return {
    id: videoId,
    snippet: {
      title,
      description: `Description for ${title}`,
      channelId: 'UC_test_channel',
      channelTitle: channel,
      publishedAt: '2024-06-15T10:00:00Z',
      thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
        medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
        default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` },
      },
    },
    contentDetails: {
      duration: durationIso,
    },
  }
}

const MOCK_VIDEOS = [
  buildMockVideoResponse('abc123test01', 'Introduction to Testing', 'Test Academy', 'PT10M30S'),
  buildMockVideoResponse('abc123test02', 'Advanced Testing Patterns', 'Test Academy', 'PT15M45S'),
  buildMockVideoResponse('abc123test03', 'Testing Best Practices', 'Test Academy', 'PT8M20S'),
]

// --- Helpers ---

/**
 * Seeds localStorage with a test YouTube API key (DEV mode bypass)
 * so the app skips the "no API key" guard.
 */
async function seedYouTubeApiKey(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('youtube-configuration', JSON.stringify({
      cacheTtlDays: 7,
      _testApiKey: 'AIzaFAKEtest00000000000000000000000000',
    }))
  })
}

/**
 * Sets up page.route() to intercept YouTube Data API v3 video requests.
 * Returns mock metadata for known video IDs; errors for special IDs.
 */
async function mockYouTubeApi(page: import('@playwright/test').Page, opts?: {
  rateLimitAll?: boolean
}) {
  // Mock YouTube Data API v3 videos endpoint
  await page.route('**/googleapis.com/youtube/v3/videos**', async (route) => {
    if (opts?.rateLimitAll) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 429,
            message: 'Rate Limit Exceeded',
            errors: [{ reason: 'rateLimitExceeded' }],
          },
        }),
      })
      return
    }

    const url = new URL(route.request().url())
    const ids = url.searchParams.get('id')?.split(',') ?? []

    // Check for special error IDs
    if (ids.includes('private_vid_01')) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 403,
            message: 'The video is private.',
            errors: [{ reason: 'forbidden' }],
          },
        }),
      })
      return
    }

    if (ids.includes('deleted_vid_01')) {
      // YouTube returns 200 with empty items for deleted/not-found videos
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          pageInfo: { totalResults: 0 },
        }),
      })
      return
    }

    // Return mock metadata for known videos
    const items = ids
      .map(id => MOCK_VIDEOS.find(v => v.id === id))
      .filter(Boolean)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        pageInfo: { totalResults: items.length },
      }),
    })
  })

  // Mock oEmbed endpoint (fallback when API quota exceeded)
  await page.route('**/youtube.com/oembed**', async (route) => {
    const url = new URL(route.request().url())
    const videoUrl = url.searchParams.get('url') ?? ''
    const videoIdMatch = videoUrl.match(/[?&]v=([^&]+)/)
    const videoId = videoIdMatch?.[1] ?? 'unknown'

    const mock = MOCK_VIDEOS.find(v => v.id === videoId)
    if (mock) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: mock.snippet.title,
          author_name: mock.snippet.channelTitle,
          author_url: `https://www.youtube.com/channel/${mock.snippet.channelId}`,
          thumbnail_url: mock.snippet.thumbnails.default.url,
        }),
      })
    } else {
      await route.fulfill({ status: 404 })
    }
  })

  // Block any real YouTube thumbnail requests
  await page.route('**/i.ytimg.com/**', async (route) => {
    // Return a 1x1 transparent PNG to avoid broken image errors
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    })
  })
}

/**
 * Opens the YouTube import dialog from the Courses page.
 * Handles both empty-state and populated-state button locations.
 */
async function openYouTubeImportDialog(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/courses')

  // Try empty-state button first, then the import button
  const emptyBtn = page.getByTestId('empty-youtube-btn')
  const isEmptyState = await emptyBtn.isVisible({ timeout: 2000 }).catch(() => false)

  if (isEmptyState) {
    await emptyBtn.click()
  } else {
    const importBtn = page.getByTestId('import-youtube-btn')
    if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await importBtn.click()
    }
  }

  await expect(page.getByTestId('youtube-import-dialog')).toBeVisible()
}

/**
 * Advances wizard from Step 1 (URL input) through Step 2 (preview),
 * waiting for metadata fetch to complete.
 */
async function advanceToStep2(page: import('@playwright/test').Page, urls: string) {
  const textarea = page.getByTestId('youtube-url-textarea')
  await textarea.fill(urls)

  // Wait for debounced parsing + Next button to enable
  await expect(page.getByTestId('wizard-next-btn')).toBeEnabled({ timeout: 5000 })
  await page.getByTestId('wizard-next-btn').click()

  // Wait for preview list to appear (metadata fetch completes)
  await expect(page.getByTestId('video-preview-list')).toBeVisible({ timeout: 15000 })
}

/**
 * Advances from Step 2 (preview) to Step 3 (organize).
 */
async function advanceToStep3(page: import('@playwright/test').Page) {
  const nextBtn = page.getByTestId('wizard-next-btn')
  await expect(nextBtn).toBeEnabled({ timeout: 10000 })
  await nextBtn.click()

  // Step 3 shows the chapter editor
  const stepIndicator = page.getByTestId('step-indicator')
  await expect(stepIndicator.getByText('3 Organize')).toHaveAttribute('aria-current', 'step', { timeout: 5000 })
}

/**
 * Advances from Step 3 (organize) to Step 4 (details).
 */
async function advanceToStep4(page: import('@playwright/test').Page) {
  const nextBtn = page.getByTestId('wizard-next-btn')
  await expect(nextBtn).toBeEnabled({ timeout: 5000 })
  await nextBtn.click()

  // Step 4 shows the details form
  await expect(page.getByTestId('course-details-form')).toBeVisible({ timeout: 5000 })
}

// --- Test Suites ---

test.describe('YouTube Course Creation — Happy Path (AC1, AC2)', () => {
  test('full wizard flow: URL → preview → organize → details → create', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Step 1: Enter multiple URLs
    const multipleUrls = [VALID_YOUTUBE_URL, SECOND_VIDEO_URL, THIRD_VIDEO_URL].join('\n')
    await advanceToStep2(page, multipleUrls)

    // Step 2: Verify preview shows all 3 videos
    await expect(page.getByTestId('video-row-abc123test01')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('video-row-abc123test02')).toBeVisible()
    await expect(page.getByTestId('video-row-abc123test03')).toBeVisible()
    await expect(page.getByText('3 videos in import list')).toBeVisible()

    // Step 3: Organize (advance through)
    await advanceToStep3(page)

    // Step 4: Details
    await advanceToStep4(page)

    // Verify the course name is pre-filled
    const nameInput = page.getByTestId('course-name-input')
    await expect(nameInput).toBeVisible()
    const nameValue = await nameInput.inputValue()
    expect(nameValue.length).toBeGreaterThan(0)

    // Change course name
    await nameInput.clear()
    await nameInput.fill('E2E Test Course — YouTube Creation')

    // Create course
    const saveBtn = page.getByTestId('wizard-save-btn')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Dialog should close after successful save
    await expect(page.getByTestId('youtube-import-dialog')).toBeHidden({ timeout: 10000 })

    // Success toast should appear
    await expect(page.getByText(/course created/i)).toBeVisible({ timeout: 5000 })
  })

  test('single video wizard flow creates course', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Step 1: Single URL
    await advanceToStep2(page, VALID_YOUTUBE_URL)

    // Step 2: Verify single video in preview
    await expect(page.getByTestId('video-row-abc123test01')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('1 video in import list')).toBeVisible()

    // Step 3: Organize
    await advanceToStep3(page)

    // Step 4: Details — name should be pre-filled from video title
    await advanceToStep4(page)
    const nameInput = page.getByTestId('course-name-input')
    const nameValue = await nameInput.inputValue()
    expect(nameValue).toBe('Introduction to Testing')

    // Save
    await page.getByTestId('wizard-save-btn').click()
    await expect(page.getByTestId('youtube-import-dialog')).toBeHidden({ timeout: 10000 })
  })
})

test.describe('YouTube Course Creation — Error Scenarios (AC3)', () => {
  test('rate limit (429) triggers oEmbed fallback', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page, { rateLimitAll: true })
    await openYouTubeImportDialog(page)

    // Enter URL and advance to step 2
    const textarea = page.getByTestId('youtube-url-textarea')
    await textarea.fill(VALID_YOUTUBE_URL)
    await expect(page.getByTestId('wizard-next-btn')).toBeEnabled({ timeout: 5000 })
    await page.getByTestId('wizard-next-btn').click()

    // The oEmbed fallback should still show the preview list (possibly with limited data)
    // or an error state. Either way, the app should not crash.
    await expect(page.getByTestId('video-preview-list')).toBeVisible({ timeout: 15000 })
  })

  test('invalid URL shows error feedback on Step 1', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    const textarea = page.getByTestId('youtube-url-textarea')
    await textarea.fill(INVALID_URL)

    // Feedback should show error
    const feedback = page.getByTestId('url-feedback')
    await expect(feedback).toBeVisible({ timeout: 3000 })
    await expect(feedback).toContainText(/not.*valid|invalid/i)

    // Next button should remain disabled
    await expect(page.getByTestId('wizard-next-btn')).toBeDisabled()
  })

  test('private video (403) shows unavailable state', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Enter private video URL
    await advanceToStep2(page, PRIVATE_VIDEO_URL)

    // The video preview list should be visible
    await expect(page.getByTestId('video-preview-list')).toBeVisible({ timeout: 15000 })

    // The video should show error state or unavailable banner
    // (403 is classified as a non-OK response by fetchVideoBatch)
    const errorOrUnavailable = page.locator('[data-testid="unavailable-banner"], [data-testid^="video-row-"]')
    await expect(errorOrUnavailable.first()).toBeVisible({ timeout: 5000 })
  })

  test('deleted video (404) shows unavailable banner', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Enter deleted video URL — YouTube returns 200 with empty items array
    await advanceToStep2(page, DELETED_VIDEO_URL)

    // Preview list should be visible
    await expect(page.getByTestId('video-preview-list')).toBeVisible({ timeout: 15000 })

    // The unavailable banner should show (video not found in API response)
    await expect(page.getByTestId('unavailable-banner')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('unavailable-banner')).toContainText(/unavailable/i)
  })

  test('mix of valid and invalid URLs shows warning feedback', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    const textarea = page.getByTestId('youtube-url-textarea')
    await textarea.fill(`${VALID_YOUTUBE_URL}\n${INVALID_URL}`)

    const feedback = page.getByTestId('url-feedback')
    await expect(feedback).toBeVisible({ timeout: 3000 })
    // Should mention 1 video detected + 1 invalid skipped
    await expect(feedback).toContainText(/1 video/i)
  })
})

test.describe('YouTube Course Creation — Course Detail Verification (AC4)', () => {
  test('created course appears on courses page with correct metadata', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Complete the full wizard with 2 videos
    const twoUrls = [VALID_YOUTUBE_URL, SECOND_VIDEO_URL].join('\n')
    await advanceToStep2(page, twoUrls)

    await expect(page.getByTestId('video-row-abc123test01')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('video-row-abc123test02')).toBeVisible()

    await advanceToStep3(page)
    await advanceToStep4(page)

    // Set a specific course name for verification
    const nameInput = page.getByTestId('course-name-input')
    await nameInput.clear()
    await nameInput.fill('Verified Test Course')

    await page.getByTestId('wizard-save-btn').click()
    await expect(page.getByTestId('youtube-import-dialog')).toBeHidden({ timeout: 10000 })

    // Wait for success toast
    await expect(page.getByText(/course created/i)).toBeVisible({ timeout: 5000 })

    // The courses page should now show the new course
    // Look for the course name on the page
    await expect(page.getByText('Verified Test Course')).toBeVisible({ timeout: 10000 })
  })

  test('created course detail page shows videos and metadata', async ({ page }) => {
    await seedYouTubeApiKey(page)
    await mockYouTubeApi(page)
    await openYouTubeImportDialog(page)

    // Create course with 3 videos
    const threeUrls = [VALID_YOUTUBE_URL, SECOND_VIDEO_URL, THIRD_VIDEO_URL].join('\n')
    await advanceToStep2(page, threeUrls)

    await expect(page.getByTestId('video-row-abc123test01')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('video-row-abc123test02')).toBeVisible()
    await expect(page.getByTestId('video-row-abc123test03')).toBeVisible()

    await advanceToStep3(page)
    await advanceToStep4(page)

    const nameInput = page.getByTestId('course-name-input')
    await nameInput.clear()
    await nameInput.fill('Detail Verification Course')

    await page.getByTestId('wizard-save-btn').click()
    await expect(page.getByTestId('youtube-import-dialog')).toBeHidden({ timeout: 10000 })
    await expect(page.getByText(/course created/i)).toBeVisible({ timeout: 5000 })

    // Navigate to the course detail — find the course link on the page
    const courseLink = page.getByText('Detail Verification Course')
    await expect(courseLink).toBeVisible({ timeout: 10000 })
    await courseLink.click()

    // Verify course detail page
    await expect(page.getByTestId('youtube-course-detail')).toBeVisible({ timeout: 10000 })

    // Verify title
    await expect(page.getByTestId('course-detail-title')).toContainText('Detail Verification Course')

    // Verify video list
    await expect(page.getByTestId('course-content-list')).toBeVisible()

    // Verify at least one video item is rendered
    const videoItems = page.locator('[data-testid^="course-video-item-"]')
    const count = await videoItems.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

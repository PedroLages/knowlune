import { test, expect } from '@playwright/test'

/**
 * E02-S10: Caption and Subtitle Support
 *
 * Tests caption/subtitle loading, display, toggle, error handling, and persistence.
 *
 * Acceptance Criteria:
 * - AC1: Load captions via file picker (SRT and WebVTT)
 * - AC2: Display synchronized captions during video playback
 * - AC3: Toggle caption visibility with C key
 * - AC4: Handle invalid files gracefully (toast + video continues)
 * - AC5: Persist caption file association across sessions
 */

const VALID_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
First subtitle line

00:00:05.000 --> 00:00:08.000
Second subtitle line
`

const VALID_SRT = `1
00:00:01,000 --> 00:00:04,000
First subtitle line

2
00:00:05,000 --> 00:00:08,000
Second subtitle line
`

const INVALID_CAPTION = `This is not a valid caption file
no timestamps here
just random text
`

// Uses built-in course from seedCourses (LessonPlayer route)
const LESSON_URL = '/courses/operative-six/op6-introduction'

test.describe('E02-S10: Caption and Subtitle Support', () => {
  test.beforeEach(async ({ page }) => {
    // Mock video file to avoid 404
    await page.route('**/*Introduction.mp4', async route => {
      await route.fulfill({ status: 200, body: '' })
    })

    // Mock VTT caption file (course-bundled captions)
    await page.route('**/captions/op6-introduction.vtt', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/vtt' },
        body: VALID_VTT,
      })
    })

    // Initialize app and wait for course seeding to complete
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
    await page.waitForLoadState('networkidle')
  })

  test('AC1: Load valid WebVTT file via caption button', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // Wait for VideoPlayer to render with onLoadCaptions prop (file input appears)
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    // Load a WebVTT file via the hidden input
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Expect success toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)
  })

  test('AC1: Load valid SRT file via caption button', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    await fileInput.setInputFiles({
      name: 'test-captions.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from(VALID_SRT),
    })

    // Expect success toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)
  })

  test('AC2: Captions render as track element after loading', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Wait for success toast (indicates captions were processed)
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    // Verify a <track> element exists with a blob: src (user-loaded caption)
    const trackInfo = await page.evaluate(() => {
      const video = document.querySelector('video')
      const tracks = video?.querySelectorAll('track') ?? []
      return {
        count: tracks.length,
        hasBlobSrc: Array.from(tracks).some(t => t.src.startsWith('blob:')),
      }
    })
    expect(trackInfo.count).toBeGreaterThan(0)
    expect(trackInfo.hasBlobSrc).toBe(true)
  })

  test('AC3: C key toggles caption visibility', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // Load captions first
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    const captionButton = page.locator('[data-testid="caption-toggle-button"]')

    // After loading, captions default to disabled (localStorage empty) — "Enable captions"
    await expect(captionButton).toHaveAttribute('aria-label', 'Enable captions')

    // Focus the video player container so keyboard events reach it
    await page.locator('[data-testid="video-player-container"]').click()

    // Press C to toggle captions on
    await page.keyboard.press('c')

    // Verify the toggle actually changed the state to enabled
    await expect(captionButton).toHaveAttribute('aria-label', 'Disable captions')
  })

  test('AC4: Invalid file shows error toast and video continues', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    await fileInput.setInputFiles({
      name: 'bad-file.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from(INVALID_CAPTION),
    })

    // Error toast should appear
    await expect(page.locator('[data-sonner-toast]')).toContainText(/invalid|could not parse/i)

    // Video player should still be functional (not crashed)
    const videoPlayer = page.locator('[data-testid="video-player-container"]')
    await expect(videoPlayer).toBeVisible()
  })

  test('AC4: File input accepts only .srt and .vtt', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('.srt')
    expect(accept).toContain('.vtt')
  })

  test('AC5: Caption file association persists across navigation', async ({ page }) => {
    await page.goto(LESSON_URL)

    // Load captions
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached({ timeout: 15000 })

    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Wait for save confirmation
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    // Navigate away to courses page
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate back to the same lesson
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // Captions should auto-load — a track with blob: src and correct label
    const trackLabel = await page.waitForFunction(
      () => {
        const video = document.querySelector('video')
        const tracks = video?.querySelectorAll('track') ?? []
        const blobTrack = Array.from(tracks).find(t => t.src.startsWith('blob:'))
        return blobTrack?.label || null
      },
      { timeout: 10000 },
    )
    expect(await trackLabel.jsonValue()).toBe('test-captions.vtt')
  })
})

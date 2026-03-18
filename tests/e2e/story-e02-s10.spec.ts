import { test, expect } from '@playwright/test'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createOperativeSixCourse } from '../support/helpers/ai-summary-mocks'

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

/** Valid WebVTT content for testing */
const VALID_VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
First subtitle line

00:00:05.000 --> 00:00:08.000
Second subtitle line
`

/** Valid SRT content for testing */
const VALID_SRT = `1
00:00:01,000 --> 00:00:04,000
First subtitle line

2
00:00:05,000 --> 00:00:08,000
Second subtitle line
`

/** Malformed caption file (invalid timestamps) */
const INVALID_CAPTION = `This is not a valid caption file
no timestamps here
just random text
`

test.describe('E02-S10: Caption and Subtitle Support', () => {
  test.beforeEach(async ({ page }) => {
    // Mock video file
    await page.route('**/01-00- Introduction.mp4', async route => {
      await route.fulfill({ status: 200, body: '' })
    })

    // Navigate and initialize app
    await page.goto('/')

    // Prevent sidebar overlay in tablet viewports (640-1023px)
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

    // Seed imported course with video
    await seedImportedCourses(page, [createOperativeSixCourse()])
  })

  test('AC1: Load valid WebVTT file via file picker', async ({ page }) => {
    // Navigate to lesson player with a video
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Find and click the subtitles/captions button on the video player
    const captionButton = page.locator('[data-testid="video-player-container"]')
      .locator('button', { hasText: /caption|subtitle/i })
      .or(page.locator('[data-testid="load-captions-button"]'))
    await captionButton.click()

    // File picker should open — use setInputFiles on hidden file input
    const fileInput = page.locator('input[type="file"][accept*=".vtt"]')
      .or(page.locator('input[type="file"][accept*=".srt"]'))
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Expect success toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(/caption/i)
  })

  test('AC1: Load valid SRT file via file picker', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    const captionButton = page.locator('[data-testid="video-player-container"]')
      .locator('button', { hasText: /caption|subtitle/i })
      .or(page.locator('[data-testid="load-captions-button"]'))
    await captionButton.click()

    const fileInput = page.locator('input[type="file"][accept*=".srt"]')
      .or(page.locator('input[type="file"][accept*=".vtt"]'))
    await fileInput.setInputFiles({
      name: 'test-captions.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from(VALID_SRT),
    })

    // Expect success toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(/caption/i)
  })

  test('AC2: Display synchronized captions during video playback', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Load captions first
    const fileInput = page.locator('input[type="file"][accept*=".vtt"]')
      .or(page.locator('input[type="file"][accept*=".srt"]'))
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Verify a <track> element exists on the video
    const trackElement = page.locator('[data-testid="video-player-container"] track')
    await expect(trackElement).toBeAttached()
  })

  test('AC3: C key toggles caption visibility', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Load captions
    const fileInput = page.locator('input[type="file"][accept*=".vtt"]')
      .or(page.locator('input[type="file"][accept*=".srt"]'))
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Press C to toggle captions off
    await page.keyboard.press('c')

    // Press C again to toggle captions back on
    await page.keyboard.press('c')

    // Caption track should still be showing (mode = 'showing')
    const trackMode = await page.evaluate(() => {
      const video = document.querySelector('video')
      return video?.textTracks?.[0]?.mode
    })
    expect(trackMode).toBe('showing')
  })

  test('AC4: Invalid file shows error toast and video continues', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    const fileInput = page.locator('input[type="file"][accept*=".vtt"]')
      .or(page.locator('input[type="file"][accept*=".srt"]'))
    await fileInput.setInputFiles({
      name: 'bad-file.srt',
      mimeType: 'application/x-subrip',
      buffer: Buffer.from(INVALID_CAPTION),
    })

    // Error toast should appear
    await expect(page.locator('[data-sonner-toast]')).toContainText(/error|invalid|malformed/i)

    // Video player should still be functional
    const videoPlayer = page.locator('[data-testid="video-player-container"]')
    await expect(videoPlayer).toBeVisible()
  })

  test('AC4: File picker filters for .srt and .vtt only', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Check that the file input accepts only caption formats
    const fileInput = page.locator('input[type="file"][accept*=".srt"]')
      .or(page.locator('input[type="file"][accept*=".vtt"]'))
    await expect(fileInput).toBeAttached()

    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('.srt')
    expect(accept).toContain('.vtt')
  })

  test('AC5: Caption file association persists across sessions', async ({ page }) => {
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Load captions
    const fileInput = page.locator('input[type="file"][accept*=".vtt"]')
      .or(page.locator('input[type="file"][accept*=".srt"]'))
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Wait for save confirmation
    await expect(page.locator('[data-sonner-toast]')).toContainText(/caption/i)

    // Navigate away
    await page.goto('/')

    // Navigate back to the same video
    await page.goto('/#/courses/operative-six/01-00-introduction')

    // Captions should auto-load — track element should be present
    const trackElement = page.locator('[data-testid="video-player-container"] track')
    await expect(trackElement).toBeAttached()
  })
})

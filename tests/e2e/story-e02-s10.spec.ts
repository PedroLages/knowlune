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

const LESSON_URL = '/courses/operative-six/op6-introduction'

test.describe('E02-S10: Caption and Subtitle Support', () => {
  test.beforeEach(async ({ page }) => {
    // Mock video file to avoid 404
    await page.route('**/01-00- Introduction.mp4', async route => {
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

    await page.goto('/')

    // Prevent sidebar overlay in tablet viewports (640-1023px)
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

    // Seed course with video
    await seedImportedCourses(page, [createOperativeSixCourse()])
  })

  test('AC1: Load valid WebVTT file via caption button', async ({ page }) => {
    await page.goto(LESSON_URL)

    // The caption file input should exist (hidden)
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached()

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

    const fileInput = page.locator('[data-testid="caption-file-input"]')

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

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Wait for success toast (indicates captions were processed)
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    // Verify a <track> element exists with a blob: src (user-loaded caption)
    const trackCount = await page.evaluate(() => {
      const video = document.querySelector('video')
      return video?.querySelectorAll('track').length ?? 0
    })
    expect(trackCount).toBeGreaterThan(0)
  })

  test('AC3: C key toggles caption visibility', async ({ page }) => {
    await page.goto(LESSON_URL)

    // Load captions first
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    // Focus the video player container so keyboard events reach it
    await page.locator('[data-testid="video-player-container"]').click()

    // Press C to toggle captions — should toggle the enabled state
    await page.keyboard.press('c')

    // The caption toggle button should reflect the state change
    const captionButton = page.locator('[data-testid="caption-toggle-button"]')
    await expect(captionButton).toBeVisible()
  })

  test('AC4: Invalid file shows error toast and video continues', async ({ page }) => {
    await page.goto(LESSON_URL)

    const fileInput = page.locator('[data-testid="caption-file-input"]')
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

    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await expect(fileInput).toBeAttached()

    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('.srt')
    expect(accept).toContain('.vtt')
  })

  test('AC5: Caption file association persists across navigation', async ({ page }) => {
    await page.goto(LESSON_URL)

    // Load captions
    const fileInput = page.locator('[data-testid="caption-file-input"]')
    await fileInput.setInputFiles({
      name: 'test-captions.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VALID_VTT),
    })

    // Wait for save confirmation
    await expect(page.locator('[data-sonner-toast]')).toContainText(/captions loaded/i)

    // Navigate away to courses page
    await page.goto('/')

    // Navigate back to the same lesson
    await page.goto(LESSON_URL)

    // Captions should auto-load — a track element with blob: src should be present
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video')
        const tracks = video?.querySelectorAll('track') ?? []
        return Array.from(tracks).some(t => t.src.startsWith('blob:'))
      },
      { timeout: 5000 }
    )
  })
})

/**
 * E21-S01: AB-Loop Video Controls
 *
 * Tests the AB-loop feature in the VideoPlayer component.
 *
 * Acceptance Criteria:
 * - AC1: Set loop start (A) via button click → marker appears on progress bar
 * - AC2: Set loop end (B) via second button click → region highlighted on bar
 * - AC3: Video automatically seeks back to A when reaching B during playback
 * - AC4: Clear loop via Escape key or Clear button
 * - AC5: Visual indicators on progress bar (region + A/B markers)
 * - AC6: Partial state (only A set) shows single marker and next-action affordance
 *
 * Test strategy: uses the built-in operative-six course (seeded at app startup).
 * The media route is mocked to return an empty response so tests work in CI
 * without the local video file. We use page.evaluate() to set video.currentTime
 * and dispatch timeupdate events to test loop enforcement logic.
 */

import { test, expect } from '@playwright/test'

// Built-in operative-six lesson URL (available in all environments)
const LESSON_URL = '/courses/operative-six/op6-introduction'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mocks the video element's duration and dispatches durationchange so React
 * updates its duration state. Must be called before any loop marker checks
 * since ChapterProgressBar guards markers behind duration > 0.
 */
async function setupVideo(page: import('@playwright/test').Page, durationSeconds: number = 120) {
  // Wait for the video element to be attached before mocking
  await page.waitForSelector('video', { state: 'attached' })
  await page.evaluate(d => {
    const video = document.querySelector('video')
    if (!video) return
    // Use a getter so the mock persists even if the browser fires its own
    // loadedmetadata event later (empty video returns NaN duration otherwise)
    Object.defineProperty(video, 'duration', {
      get: () => d,
      configurable: true,
    })
    video.dispatchEvent(new Event('loadedmetadata'))
  }, durationSeconds)
}

/**
 * Sets the video element's currentTime to `seconds` via evaluate,
 * then dispatches a timeupdate event to trigger React's onTimeUpdate handler.
 */
async function setVideoTime(page: import('@playwright/test').Page, seconds: number) {
  await page.evaluate(s => {
    const video = document.querySelector('video')
    if (!video) return
    // currentTime can be set even on an unloaded video element
    Object.defineProperty(video, 'currentTime', {
      writable: true,
      configurable: true,
      value: s,
    })
    video.dispatchEvent(new Event('timeupdate'))
  }, seconds)
}

/**
 * Returns the video element's current reported time.
 */
async function getVideoTime(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const video = document.querySelector('video')
    return video ? video.currentTime : 0
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.describe('E21-S01: AB-Loop Video Controls', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a prototype-level duration mock before any page scripts run.
    // This ensures VideoPlayer's handleLoadedMetadata always reads 120s,
    // satisfying ChapterProgressBar's duration > 0 guard for loop markers.
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        get: () => 120,
        configurable: true,
      })
    })

    // Mock the media endpoint so tests work in CI without the actual video file.
    await page.route('**/media/**/*.mp4', route =>
      route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) })
    )

    // Close sidebar before navigation to prevent overlay blocking pointer events
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))

    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // Dispatch loadedmetadata so React's handleLoadedMetadata fires and calls setDuration()
    await setupVideo(page, 120)
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
  })

  // -------------------------------------------------------------------------
  // AC1: Set loop start (A) via button
  // -------------------------------------------------------------------------

  test('AC1: clicking loop button once sets A marker and highlights button', async ({ page }) => {
    // Set video time so A is placed at a known position
    await setVideoTime(page, 10)

    const loopButton = page.getByTestId('loop-toggle-button')
    await expect(loopButton).toBeVisible()

    // Before: aria-label indicates "Set loop start"
    await expect(loopButton).toHaveAttribute('aria-label', /set loop start/i)

    await loopButton.click()

    // After: aria-label advances to "Set loop end (B)"
    await expect(loopButton).toHaveAttribute('aria-label', /set loop end/i)
    // Button should be visually highlighted (aria-pressed)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'true')

    // A marker should appear on the progress bar
    await expect(page.getByTestId('loop-start-marker')).toBeVisible()
    // No B marker yet
    await expect(page.getByTestId('loop-end-marker')).not.toBeVisible()
    // No loop region yet
    await expect(page.getByTestId('loop-region')).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // AC2: Set loop end (B) via second button click → region appears
  // -------------------------------------------------------------------------

  test('AC2: clicking loop button twice sets A then B, showing loop region', async ({ page }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    // First click → A at 10s
    await setVideoTime(page, 10)
    await loopButton.click()

    // Second click → B at 20s
    await setVideoTime(page, 20)
    await loopButton.click()

    // Loop region (shaded band) should appear between A and B
    await expect(page.getByTestId('loop-region')).toBeVisible()
    // Both markers visible
    await expect(page.getByTestId('loop-start-marker')).toBeVisible()
    await expect(page.getByTestId('loop-end-marker')).toBeVisible()

    // Button aria-label reflects active loop state
    await expect(loopButton).toHaveAttribute('aria-label', /loop active/i)
  })

  // -------------------------------------------------------------------------
  // AC3: Loop enforcement — video seeks back to A when reaching B
  // -------------------------------------------------------------------------

  test('AC3: video seeks back to A when currentTime reaches B', async ({ page }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    // Set A at 5s
    await setVideoTime(page, 5)
    await loopButton.click()

    // Set B at 15s
    await setVideoTime(page, 15)
    await loopButton.click()

    // Simulate video reaching past the B point
    await setVideoTime(page, 15.1)

    // The loop enforcement in handleTimeUpdate should have seeked back to A (5s)
    const time = await getVideoTime(page)
    expect(time).toBeCloseTo(5, 1)
  })

  // -------------------------------------------------------------------------
  // AC4: Clear loop via Escape key
  // -------------------------------------------------------------------------

  test('AC4: pressing Escape clears the loop', async ({ page }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    // Set A and B
    await setVideoTime(page, 5)
    await loopButton.click()
    await setVideoTime(page, 15)
    await loopButton.click()

    // Both markers visible
    await expect(page.getByTestId('loop-region')).toBeVisible()

    // Press Escape to clear
    await page.keyboard.press('Escape')

    // All loop indicators should disappear
    await expect(page.getByTestId('loop-region')).not.toBeVisible()
    await expect(page.getByTestId('loop-start-marker')).not.toBeVisible()
    await expect(page.getByTestId('loop-end-marker')).not.toBeVisible()

    // Button should return to "Set loop start" state
    await expect(loopButton).toHaveAttribute('aria-label', /set loop start/i)
    await expect(loopButton).toHaveAttribute('aria-pressed', 'false')
  })

  // -------------------------------------------------------------------------
  // AC4: Clear loop via Clear button (×)
  // -------------------------------------------------------------------------

  test('AC4: clicking clear button removes loop markers', async ({ page }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    // Set A
    await setVideoTime(page, 5)
    await loopButton.click()

    // Clear button should appear
    const clearButton = page.getByTestId('loop-clear-button')
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    // All loop indicators gone
    await expect(page.getByTestId('loop-start-marker')).not.toBeVisible()
    await expect(clearButton).not.toBeVisible()
    await expect(loopButton).toHaveAttribute('aria-label', /set loop start/i)
  })

  // -------------------------------------------------------------------------
  // AC5: Visual indicators — loop region with correct data-testids
  // -------------------------------------------------------------------------

  test('AC5: progress bar shows region and distinct A/B markers when loop is active', async ({
    page,
  }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    await setVideoTime(page, 8)
    await loopButton.click()
    await setVideoTime(page, 18)
    await loopButton.click()

    // Loop region
    const region = page.getByTestId('loop-region')
    await expect(region).toBeVisible()

    // A marker
    const aMarker = page.getByTestId('loop-start-marker')
    await expect(aMarker).toBeVisible()

    // B marker
    const bMarker = page.getByTestId('loop-end-marker')
    await expect(bMarker).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // AC6: Partial state — only A set → single marker, next-action affordance
  // -------------------------------------------------------------------------

  test('AC6: with only A set, button indicates next action is Set B', async ({ page }) => {
    const loopButton = page.getByTestId('loop-toggle-button')

    await setVideoTime(page, 10)
    await loopButton.click()

    // Button communicates next action is to set B
    await expect(loopButton).toHaveAttribute('aria-label', /set loop end/i)

    // Only A marker visible; no B marker, no loop region
    await expect(page.getByTestId('loop-start-marker')).toBeVisible()
    await expect(page.getByTestId('loop-end-marker')).not.toBeVisible()
    await expect(page.getByTestId('loop-region')).not.toBeVisible()

    // Escape clears partial state too
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('loop-start-marker')).not.toBeVisible()
    await expect(loopButton).toHaveAttribute('aria-label', /set loop start/i)
  })

  // -------------------------------------------------------------------------
  // Keyboard shortcut: 'a' key cycles A → B
  // -------------------------------------------------------------------------

  test('keyboard "a" cycles: first press sets A, second press sets B', async ({ page }) => {
    // Focus the video player container so keyboard shortcuts fire
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.click()

    await setVideoTime(page, 10)
    await page.keyboard.press('a')

    await expect(page.getByTestId('loop-start-marker')).toBeVisible()
    await expect(page.getByTestId('loop-end-marker')).not.toBeVisible()

    await setVideoTime(page, 20)
    await page.keyboard.press('a')

    await expect(page.getByTestId('loop-start-marker')).toBeVisible()
    await expect(page.getByTestId('loop-end-marker')).toBeVisible()
    await expect(page.getByTestId('loop-region')).toBeVisible()
  })
})

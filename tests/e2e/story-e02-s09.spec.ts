/**
 * Story 2.9: Mini-Player & Theater Mode — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Mini-player appears fixed bottom-right when video scrolls out of view (playing only)
 *   - AC2: Theater mode hides desktop sidebar and expands video (T key + button)
 *   - AC3: Theater mode button hidden on mobile (< 1280px)
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const LESSON_URL = '/courses/operative-six/op6-introduction'

/** Navigate to lesson player and suppress mobile sidebar Sheet. */
async function goToLessonPlayer(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, LESSON_URL)
  await page.locator('video').waitFor({ state: 'visible', timeout: 10000 })
}

/** Scroll the lesson content container (inner overflow-y-auto div). */
async function scrollLessonContent(page: Parameters<typeof navigateAndWait>[0], y: number) {
  await page.getByTestId('lesson-content-scroll').evaluate((el, scrollY) => el.scrollBy(0, scrollY), y)
}

/**
 * Activate playing state via VideoPlayer's click handler (togglePlayPause).
 * This sets isPlaying = true synchronously regardless of video source availability,
 * and calls onPlayStateChange(true) which updates LessonPlayer's isVideoPlaying state.
 */
async function activatePlayState(page: Parameters<typeof navigateAndWait>[0]) {
  // Click the video element — VideoPlayer has onClick={togglePlayPause} on <video>
  await page.locator('video').click({ force: true })
  await page.waitForTimeout(100)
}

// ===========================================================================
// AC1: Mini-Player on Scroll
// ===========================================================================

test.describe('AC1: Mini-player on scroll', () => {
  test('mini-player wrapper exists in the DOM at all times', async ({ page }) => {
    await goToLessonPlayer(page)

    // THEN: The wrapper with data-testid="mini-player" should always be present
    await expect(page.getByTestId('mini-player')).toBeVisible()
  })

  test('mini-player wrapper has static position when video is in viewport', async ({ page }) => {
    await goToLessonPlayer(page)

    const wrapper = page.getByTestId('mini-player')
    const position = await wrapper.evaluate((el) => window.getComputedStyle(el).position)

    // THEN: Should NOT be fixed when the player is in view
    expect(position).not.toBe('fixed')
  })

  test('mini-player becomes fixed when playing video scrolls out of viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Activate play state via VideoPlayer's click handler
    await activatePlayState(page)

    // Scroll the lesson content container past the video
    await scrollLessonContent(page, 1000)

    // THEN: wrapper should become position: fixed (waits up to 5s for IntersectionObserver)
    await expect(page.getByTestId('mini-player')).toHaveCSS('position', 'fixed', { timeout: 5000 })
  })

  test('layout anchor preserves space when mini-player is active', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Before scrolling: anchor is in normal flow (not fixed)
    const anchor = page.getByTestId('video-anchor')
    await expect(anchor).toBeVisible()

    // Activate play state and scroll
    await activatePlayState(page)
    await scrollLessonContent(page, 1000)

    // THEN: anchor div stays visible (preserving layout space) while mini-player is fixed
    await expect(page.getByTestId('mini-player')).toHaveCSS('position', 'fixed', { timeout: 5000 })
    await expect(anchor).toBeVisible()
  })

  test('clicking mini-player scrolls back to main player', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Activate play state and scroll to activate mini-player
    await activatePlayState(page)
    await scrollLessonContent(page, 1000)

    // Wait for mini-player to become active
    const wrapper = page.getByTestId('mini-player')
    await expect(wrapper).toHaveCSS('position', 'fixed', { timeout: 5000 })

    // WHEN: Click the mini-player to scroll back
    await wrapper.click({ force: true })
    await page.waitForTimeout(500)

    // THEN: Should scroll back — mini-player position returns to absolute (in-flow)
    await expect(wrapper).not.toHaveCSS('position', 'fixed', { timeout: 5000 })
  })

  test('mini-player does NOT appear when video is paused and scrolled past', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Ensure video is paused (default state), then scroll
    await scrollLessonContent(page, 1000)
    await page.waitForTimeout(300)

    // THEN: wrapper should remain static (mini-player inactive)
    const wrapper = page.getByTestId('mini-player')
    const position = await wrapper.evaluate((el) => window.getComputedStyle(el).position)
    expect(position).not.toBe('fixed')
  })
})

// ===========================================================================
// AC2: Theater Mode
// ===========================================================================

test.describe('AC2: Theater mode', () => {
  test('theater mode button is visible on desktop (≥1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToLessonPlayer(page)

    // Make video controls visible
    await page.locator('video').hover({ force: true })

    // THEN: Theater button should be visible
    const theaterButton = page.getByRole('button', { name: /toggle theater mode/i })
    await expect(theaterButton).toBeVisible()
  })

  test('clicking theater mode button hides the desktop sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToLessonPlayer(page)

    // Make controls visible and click theater button
    await page.locator('video').hover({ force: true })
    await page.getByRole('button', { name: /toggle theater mode/i }).click()

    // THEN: Desktop sidebar should be hidden
    await expect(page.getByTestId('desktop-sidebar')).not.toBeVisible()
  })

  test('pressing T key toggles theater mode on', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToLessonPlayer(page)

    // Focus the video player area first
    await page.locator('video').hover({ force: true })
    await page.locator('[data-testid="mini-player"]').focus()

    // WHEN: Press T
    await page.keyboard.press('t')

    // THEN: Desktop sidebar should be hidden (theater mode active)
    await page.waitForTimeout(200)
    await expect(page.getByTestId('desktop-sidebar')).not.toBeVisible()
  })

  test('pressing T again toggles theater mode off', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToLessonPlayer(page)

    // Activate theater mode
    await page.locator('video').hover({ force: true })
    await page.locator('[data-testid="mini-player"]').focus()
    await page.keyboard.press('t')
    await page.waitForTimeout(200)

    // WHEN: Press T again
    await page.keyboard.press('t')
    await page.waitForTimeout(200)

    // THEN: Desktop sidebar should be visible again
    await expect(page.getByTestId('desktop-sidebar')).toBeVisible()
  })
})

// ===========================================================================
// AC3: Theater Button Hidden on Mobile
// ===========================================================================

test.describe('AC3: Theater button hidden on mobile', () => {
  test('theater mode button is NOT visible on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await goToLessonPlayer(page)

    // Make controls visible
    await page.locator('video').hover({ force: true })

    // THEN: Theater button should not be visible at mobile width
    const theaterButton = page.getByRole('button', { name: /toggle theater mode/i })
    await expect(theaterButton).not.toBeVisible()
  })
})

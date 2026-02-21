/**
 * Story 2.9: Mini-Player & Theater Mode — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
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

    // Start playing the video
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement
      if (video) video.play().catch(() => {})
    })

    // Scroll past the video
    await page.evaluate(() => window.scrollBy(0, 1000))
    await page.waitForTimeout(300) // Allow IntersectionObserver to fire

    // THEN: wrapper should now be position: fixed
    const wrapper = page.getByTestId('mini-player')
    const position = await wrapper.evaluate((el) => window.getComputedStyle(el).position)
    expect(position).toBe('fixed')
  })

  test('spacer div appears when mini-player is active', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Before scrolling: spacer should NOT be present
    await expect(page.getByTestId('mini-player-spacer')).not.toBeVisible()

    // Start playing and scroll
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement
      if (video) video.play().catch(() => {})
    })
    await page.evaluate(() => window.scrollBy(0, 1000))
    await page.waitForTimeout(300)

    // THEN: spacer should appear
    await expect(page.getByTestId('mini-player-spacer')).toBeVisible()
  })

  test('clicking mini-player scrolls back to main player', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Start playing and scroll to activate mini-player
    await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement
      if (video) video.play().catch(() => {})
    })
    await page.evaluate(() => window.scrollBy(0, 1000))
    await page.waitForTimeout(300)

    // Confirm mini-player is active
    const wrapper = page.getByTestId('mini-player')
    const positionBefore = await wrapper.evaluate((el) => window.getComputedStyle(el).position)
    expect(positionBefore).toBe('fixed')

    // WHEN: Click the mini-player
    await wrapper.click()
    await page.waitForTimeout(500)

    // THEN: Should scroll back — mini-player position returns to static
    const positionAfter = await wrapper.evaluate((el) => window.getComputedStyle(el).position)
    expect(positionAfter).not.toBe('fixed')
  })

  test('mini-player does NOT appear when video is paused and scrolled past', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 })
    await goToLessonPlayer(page)

    // Ensure video is paused (default state), then scroll
    await page.evaluate(() => window.scrollBy(0, 1000))
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

    // Confirm sidebar is initially visible on desktop
    const sidebar = page.locator('[data-testid="desktop-sidebar"]').or(
      page.locator('.hidden.xl\\:block').first()
    )

    // Make controls visible and click theater button
    await page.locator('video').hover({ force: true })
    await page.getByRole('button', { name: /toggle theater mode/i }).click()

    // THEN: Sidebar should be hidden
    const sidebarVisible = await page.locator('text=Course Content').isVisible()
    expect(sidebarVisible).toBe(false)
  })

  test('pressing T key toggles theater mode on', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToLessonPlayer(page)

    // Focus the video player area first
    await page.locator('video').hover({ force: true })
    await page.locator('[data-testid="mini-player"]').focus()

    // WHEN: Press T
    await page.keyboard.press('t')

    // THEN: Sidebar should be hidden (theater mode active)
    await page.waitForTimeout(200)
    const sidebarVisible = await page.locator('text=Course Content').isVisible()
    expect(sidebarVisible).toBe(false)
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

    // THEN: Sidebar should be visible again
    const sidebarVisible = await page.locator('text=Course Content').isVisible()
    expect(sidebarVisible).toBe(true)
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

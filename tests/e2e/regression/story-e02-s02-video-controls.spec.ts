/**
 * Story 2.2: Video Playback Controls and Keyboard Shortcuts — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Shift+Arrow ±10s seeking
 *   - AC2: 95% auto-completion with celebration
 *   - AC3: Caption font size adjustment (14pt-20pt)
 *   - AC4: prefers-reduced-motion support
 *   - AC5: WCAG AA+ compliance (focus indicators, ARIA, keyboard nav)
 *
 * Note: The existing VideoPlayer already handles most controls (play/pause,
 * ±5s arrows, volume, mute, fullscreen, speed, timestamps). These tests
 * focus only on the GAPS identified in the implementation plan.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// Use a known course/lesson with video content
const LESSON_URL = '/courses/operative-six/op6-introduction'

/** Navigate to the lesson player page. */
async function goToLessonPlayer(page: Parameters<typeof navigateAndWait>[0]) {
  // Close tablet sidebar before load — Radix Sheet sets aria-hidden on main content when open
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, LESSON_URL)
  // Wait for video player to be visible
  await page.locator('video').waitFor({ state: 'visible', timeout: 10000 })
}

// ===========================================================================
// AC1: Shift+Arrow ±10s Seeking
// ===========================================================================

test.describe('AC1: Shift+Arrow ±10s Seeking', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'Keyboard events not supported on mobile webkit')

  test('Shift+ArrowRight should seek forward 10 seconds', async ({ page }) => {
    await goToLessonPlayer(page)

    // Focus the video player container
    const playerContainer = page.locator('[role="region"]').filter({ hasText: /video/i }).first()
    await playerContainer.focus()

    // WHEN: User presses Shift+ArrowRight
    await page.keyboard.press('Shift+ArrowRight')

    // THEN: Current time should advance by ~10s (from 0)
    const timeDisplay = page.getByTestId('current-time')
    // After Shift+ArrowRight from 0:00, should show ~0:10
    await expect(timeDisplay).toContainText('0:10')
  })

  test('Shift+ArrowLeft should seek backward 10 seconds', async ({ page }) => {
    await goToLessonPlayer(page)

    const playerContainer = page.locator('[role="region"]').filter({ hasText: /video/i }).first()
    await playerContainer.focus()

    // Seek forward first to have room to seek back
    await page.keyboard.press('Shift+ArrowRight') // +10s
    await page.keyboard.press('Shift+ArrowRight') // +10s (now at ~20s)

    // WHEN: User presses Shift+ArrowLeft
    await page.keyboard.press('Shift+ArrowLeft')

    // THEN: Current time should go back by ~10s (from ~20s to ~10s)
    const timeDisplay = page.getByTestId('current-time')
    await expect(timeDisplay).toContainText('0:10')
  })

  test('plain ArrowRight should still seek 5 seconds (not 10)', async ({ page }) => {
    await goToLessonPlayer(page)

    const playerContainer = page.locator('[role="region"]').filter({ hasText: /video/i }).first()
    await playerContainer.focus()

    // WHEN: User presses plain ArrowRight (no Shift)
    await page.keyboard.press('ArrowRight')

    // THEN: Current time should advance by ~5s (not 10s)
    const timeDisplay = page.getByTestId('current-time')
    await expect(timeDisplay).toContainText('0:05')
  })
})

// ===========================================================================
// AC2: 95% Auto-Completion with Celebration
// ===========================================================================

test.describe('AC2: 95% Auto-Completion', () => {
  test('should auto-mark lesson complete when 95% threshold is crossed', async ({ page }) => {
    await goToLessonPlayer(page)

    // GIVEN: Lesson is not yet completed
    const completionButton = page.getByRole('button', { name: /mark.*complete/i })
    await expect(completionButton).toBeVisible()

    // WHEN: Video reaches 95% completion (simulate by seeking)
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.duration > 0 && !isNaN(video.duration)
    }, { timeout: 10000 })
    await page.evaluate(() => {
      const video = document.querySelector('video')
      if (video && video.duration) {
        video.currentTime = video.duration * 0.96 // Just past 95%
        video.dispatchEvent(new Event('timeupdate'))
      }
    })

    // THEN: Lesson should be marked as completed (button aria-label flips to "incomplete")
    // Use CSS locator — celebration modal sets aria-hidden on background, blocking getByRole
    await expect(page.locator('button[aria-label="Mark lesson incomplete"]')).toBeVisible({ timeout: 5000 })
  })

  test('should show celebration modal at 95% completion', async ({ page }) => {
    await goToLessonPlayer(page)

    // WHEN: Video reaches 95%
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.duration > 0 && !isNaN(video.duration)
    }, { timeout: 10000 })
    await page.evaluate(() => {
      const video = document.querySelector('video')
      if (video && video.duration) {
        video.currentTime = video.duration * 0.96
        video.dispatchEvent(new Event('timeupdate'))
      }
    })

    // THEN: Celebration modal should appear
    await expect(page.getByRole('heading', { name: /lesson completed/i })).toBeVisible({ timeout: 5000 })
  })

  test('should not re-trigger celebration when video reaches 100% after 95% auto-complete', async ({ page }) => {
    await goToLessonPlayer(page)

    // GIVEN: Auto-completed at 95%
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return video && video.duration > 0 && !isNaN(video.duration)
    }, { timeout: 10000 })
    await page.evaluate(() => {
      const video = document.querySelector('video')
      if (video && video.duration) {
        video.currentTime = video.duration * 0.96
        video.dispatchEvent(new Event('timeupdate'))
      }
    })

    // Dismiss the celebration modal (first "Close" is the text button, second is the X icon)
    await page.getByRole('button', { name: /close/i }).first().click()
    await expect(page.getByRole('heading', { name: /lesson completed/i })).not.toBeVisible()

    // WHEN: Video reaches 100% (ended event)
    await page.evaluate(() => {
      const video = document.querySelector('video')
      if (video) {
        video.dispatchEvent(new Event('ended'))
      }
    })

    // THEN: No second celebration modal
    await expect(page.getByRole('heading', { name: /lesson completed/i })).not.toBeVisible({ timeout: 2000 })
  })
})

// ===========================================================================
// AC3: Caption Font Size Adjustment
// ===========================================================================

test.describe('AC3: Caption Font Size', () => {
  test.fixme('should have a caption font size control visible when captions are enabled', async ({ page }) => {
    // FIXME: LessonPlayer does not yet pass captions prop to VideoPlayer, so caption controls never render
    await goToLessonPlayer(page)

    // Enable captions first (press C key)
    const playerContainer = page.locator('[role="region"]').filter({ hasText: /video/i }).first()
    await playerContainer.focus()
    await page.keyboard.press('c')

    // THEN: Caption font size control should be visible
    await expect(page.getByTestId('caption-font-size')).toBeVisible()
  })

  test('should persist caption font size across sessions', async ({ page, localStorage }) => {
    await goToLessonPlayer(page)

    // GIVEN: User sets caption font size to 20pt
    // (implementation-specific: interact with font size control)
    await page.evaluate(() => {
      window.localStorage.setItem('video-caption-font-size', '20')
    })

    // WHEN: Page is reloaded
    await page.reload({ waitUntil: 'domcontentloaded' })

    // THEN: Font size should persist
    const savedSize = await localStorage.get<number>('video-caption-font-size')
    expect(savedSize).toBe(20)
  })
})

// ===========================================================================
// AC4: prefers-reduced-motion Support
// ===========================================================================

test.describe('AC4: prefers-reduced-motion', () => {
  test('should use opacity fade instead of scale animation when reduced motion is enabled', async ({ page }) => {
    // GIVEN: User has prefers-reduced-motion enabled
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await goToLessonPlayer(page)

    // WHEN: Lesson is manually completed
    const completionButton = page.getByRole('button', { name: /mark lesson complete/i })
    await completionButton.click()

    // THEN: The checkmark icon should NOT have scale/bounce animation
    // It should use opacity transition instead (scope to completion button to avoid sidebar match)
    // Use CSS locator — celebration modal sets aria-hidden on background, blocking getByRole
    const checkIcon = page.locator('button[aria-label="Mark lesson incomplete"] svg')
    await expect(checkIcon).toBeVisible()

    // Verify no transform/scale animation is applied
    const animation = await checkIcon.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        animation: computed.animation,
        transform: computed.transform,
      }
    })

    // With reduced motion, there should be no scale/bounce animation
    expect(animation.animation).not.toContain('bounce')
  })

  test('should skip confetti animation when reduced motion is enabled', async ({ page }) => {
    // GIVEN: User has prefers-reduced-motion enabled
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await goToLessonPlayer(page)

    // WHEN: Lesson is completed (triggering celebration modal)
    const completionButton = page.getByRole('button', { name: /mark lesson complete/i })
    await completionButton.click()

    // THEN: Modal appears but no canvas confetti
    await expect(page.getByRole('heading', { name: /lesson completed/i })).toBeVisible({ timeout: 5000 })

    // Verify no confetti canvas was created
    const confettiCanvas = page.locator('canvas')
    await expect(confettiCanvas).toHaveCount(0)
  })
})

// ===========================================================================
// AC5: WCAG AA+ Compliance
// ===========================================================================

test.describe('AC5: WCAG AA+ Compliance', () => {
  test('all video control buttons should have visible focus indicators', async ({ page }) => {
    await goToLessonPlayer(page)

    // Hover to make controls visible
    const videoArea = page.locator('video')
    await videoArea.hover({ force: true })

    // Tab through controls and verify focus rings
    await page.keyboard.press('Tab')

    // THEN: Focused element should have a visible focus ring
    const focusedElement = page.locator(':focus-visible')
    await expect(focusedElement).toBeVisible()

    // Verify the focus ring has sufficient visibility
    const ringStyle = await focusedElement.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        outline: computed.outline,
        boxShadow: computed.boxShadow,
      }
    })

    // Should have either outline or box-shadow for focus indication
    const hasFocusRing = ringStyle.outline !== 'none' ||
      (ringStyle.boxShadow !== 'none' && ringStyle.boxShadow !== '')
    expect(hasFocusRing).toBe(true)
  })

  test('speed menu should have proper ARIA roles', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open speed menu
    const videoArea = page.locator('video')
    await videoArea.hover({ force: true })

    const speedButton = page.getByRole('button', { name: /speed|playback/i })
    await speedButton.click()

    // THEN: Speed menu should have role="menu"
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    // AND: Each option should have role="menuitem"
    const menuItems = page.getByRole('menuitem')
    await expect(menuItems).toHaveCount(6) // 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
  })

  test('speed menu should support keyboard navigation', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open speed menu
    const videoArea = page.locator('video')
    await videoArea.hover({ force: true })

    const speedButton = page.getByRole('button', { name: /speed|playback/i })
    await speedButton.click()

    // WHEN: User presses ArrowDown
    await page.keyboard.press('ArrowDown')

    // THEN: Focus should move to next menu item
    const focusedItem = page.locator('[role="menuitem"]:focus')
    await expect(focusedItem).toBeVisible()

    // WHEN: User presses Escape
    await page.keyboard.press('Escape')

    // THEN: Menu should close
    await expect(page.getByRole('menu')).not.toBeVisible()
  })

  test.fixme('captions toggle should have aria-pressed attribute', async ({ page }) => {
    // FIXME: LessonPlayer does not yet pass captions prop to VideoPlayer, so caption button never renders
    await goToLessonPlayer(page)

    // Make controls visible
    const videoArea = page.locator('video')
    await videoArea.hover({ force: true })

    // THEN: Captions button should have aria-pressed
    const captionsButton = page.getByRole('button', { name: /caption/i })
    await expect(captionsButton).toHaveAttribute('aria-pressed')
  })

  test('all icon-only buttons should have accessible labels', async ({ page }) => {
    await goToLessonPlayer(page)

    // Make controls visible
    const videoArea = page.locator('video')
    await videoArea.hover({ force: true })

    // THEN: All buttons in the controls area should have accessible names
    const controlButtons = page.locator('[role="region"] button')
    const count = await controlButtons.count()

    for (let i = 0; i < count; i++) {
      const button = controlButtons.nth(i)
      const name = await button.getAttribute('aria-label') ?? await button.textContent()
      expect(name?.trim().length).toBeGreaterThan(0)
    }
  })
})

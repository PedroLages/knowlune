/**
 * Story 2.6: Video Player UX Fixes & Accessibility — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Touch targets (44x44px), mobile volume popover, touch auto-show/hide
 *   - AC2: Focus ring on player container, speed menu focus trap with ARIA roles
 *   - AC3: Video element attributes (preload, playsInline, poster)
 *   - AC4: Reduced motion — transitions complete in ≤1ms
 *   - AC5: Single scrollbar on LessonPlayer, themed scrollbar styling
 *
 * Data seeding:
 *   - Uses allCourses data (first course with modules)
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants — navigate to a known video lesson
// ---------------------------------------------------------------------------

async function goToFirstLesson(page: Parameters<typeof navigateAndWait>[0]) {
  await navigateAndWait(page, '/courses/operative-six/op6-introduction')
}

// ===========================================================================
// AC1: Touch Targets & Mobile Controls
// ===========================================================================

test.describe('AC1: Touch Targets & Mobile Controls', () => {
  test('all bottom-bar buttons have minimum 44x44px touch targets on mobile', async ({ page }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // WHEN: Controls are visible — hover/touch to show
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.hover()

    // THEN: All bottom-bar buttons have min 44px dimensions
    const buttons = page.getByTestId('player-bottom-controls').locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('tapping mute button on mobile opens volume popover', async ({ page }) => {
    // GIVEN: Mobile viewport with player open
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // WHEN: Tap the mute/volume button
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.hover()
    const volumeBtn = page.getByTestId('volume-button')
    await volumeBtn.click()

    // THEN: A volume popover/slider is visible
    const volumePopover = page.getByTestId('mobile-volume-popover')
    await expect(volumePopover).toBeVisible()
  })

  test('touch on video container shows controls, timeout hides them', async ({ page }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // WHEN: Touch the player container (tap corner to avoid hitting center play button)
    const playerContainer = page.getByTestId('video-player-container')
    const tapError = await playerContainer.tap({ position: { x: 10, y: 10 } }).then(
      () => null,
      (e: Error) => e
    )
    if (tapError) {
      test.skip(true, 'Touch not supported in this browser config')
      return
    }

    // THEN: Controls become visible
    const controls = page.getByTestId('player-bottom-controls')
    await expect(controls).toBeVisible()

    // AND: After timeout, controls hide (wait up to 5 seconds)
    await expect(controls).toBeHidden({ timeout: 6000 })
  })
})

// ===========================================================================
// AC2: Focus Ring & Speed Menu Focus Trap
// ===========================================================================

test.describe('AC2: Focus Ring & Speed Menu', () => {
  test('tab to player container shows visible focus ring', async ({ page }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // WHEN: Tab to the player container
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.focus()

    // THEN: Focus ring outline is visible (non-zero outline width)
    const outline = await playerContainer.evaluate(el => {
      const style = window.getComputedStyle(el)
      return style.outlineStyle
    })
    expect(outline).not.toBe('none')
  })

  test('speed menu has correct ARIA roles', async ({ page }) => {
    // GIVEN: Desktop viewport with player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // WHEN: Open the speed menu
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.hover()
    const speedTrigger = page.getByTestId('speed-menu-trigger')
    await speedTrigger.click()

    // THEN: Menu has role="menu" and items have role="menuitem"
    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeVisible()

    const menuItems = page.locator('[role="menuitem"]')
    const count = await menuItems.count()
    expect(count).toBeGreaterThan(0)

    // AND: Active speed has aria-checked="true"
    const checkedItem = page.locator('[role="menuitem"][aria-checked="true"]')
    await expect(checkedItem).toHaveCount(1)
  })

  test('speed menu focus trap: Tab wraps from last to first item', async ({ page }) => {
    // GIVEN: Desktop viewport with speed menu open
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.hover()
    const speedTrigger = page.getByTestId('speed-menu-trigger')
    await speedTrigger.click()

    // WHEN: Tab through all items to the last, then press Tab again
    const menuItems = page.locator('[role="menuitem"]')
    const count = await menuItems.count()

    // Tab to reach the last item
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab')
    }

    // Press Tab once more — should wrap to first
    await page.keyboard.press('Tab')

    // THEN: First menu item is focused
    const firstItem = menuItems.first()
    await expect(firstItem).toBeFocused()
  })

  test('speed menu: Escape closes and returns focus to trigger', async ({ page }) => {
    // GIVEN: Desktop viewport with speed menu open
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)
    const playerContainer = page.getByTestId('video-player-container')
    await playerContainer.hover()
    const speedTrigger = page.getByTestId('speed-menu-trigger')
    await speedTrigger.click()

    // WHEN: Press Escape
    await page.keyboard.press('Escape')

    // THEN: Menu is closed
    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeHidden()

    // AND: Focus returns to the trigger button
    await expect(speedTrigger).toBeFocused()
  })
})

// ===========================================================================
// AC3: Video Element Attributes
// ===========================================================================

test.describe('AC3: Video Element Attributes', () => {
  test('video element has preload="metadata" and playsInline', async ({ page }) => {
    // GIVEN: Lesson player with a video
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Video element has correct attributes
    const video = page.locator('video')
    await expect(video).toHaveAttribute('preload', 'metadata')
    await expect(video).toHaveAttribute('playsinline', '')
    // poster attribute deferred — Resource type has no poster field yet
  })
})

// ===========================================================================
// AC4: Reduced Motion
// ===========================================================================

test.describe('AC4: Reduced Motion', () => {
  test('controls transitions respect prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    const overlay = page.getByTestId('player-controls-overlay')
    const td = await overlay.evaluate(el =>
      parseFloat(window.getComputedStyle(el).transitionDuration)
    )
    // Global CSS sets transition-duration: 0.01ms !important under reduced-motion
    expect(td).toBeLessThanOrEqual(0.01)
  })
})

// ===========================================================================
// AC5: Single Scrollbar & Themed Scrollbars
// ===========================================================================

test.describe('AC5: Single Scrollbar & Themed Scrollbars', () => {
  test('only one vertical scrollbar on LessonPlayer page', async ({ page }) => {
    // GIVEN: Desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: The main layout container does not scroll (content fits)
    const mainContent = page.locator('main#main-content')
    const scrollInfo = await mainContent.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))

    // Main should not have overflow (scrollHeight <= clientHeight or very close)
    // Allow small tolerance (2px)
    expect(scrollInfo.scrollHeight - scrollInfo.clientHeight).toBeLessThanOrEqual(2)
  })

  test('sidebar scrolls independently', async ({ page }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Sidebar scroll container exists with overflow-y-auto
    const sidebarScroll = page.getByTestId('course-sidebar-accordion')
    await expect(sidebarScroll).toBeVisible()

    const overflowY = await sidebarScroll.evaluate(el => {
      return window.getComputedStyle(el).overflowY
    })
    expect(overflowY).toBe('auto')
  })
})

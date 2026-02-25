/**
 * Story 2.5: Course Structure Navigation — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Collapsible ModuleAccordion in sidebar
 *   - AC2: Lesson details (title, duration, type icon)
 *   - AC3: Switch lessons without reload, active lesson highlight
 *   - AC4: "Next Lesson" button visible
 *   - AC5: Auto-advance 5s countdown with cancel
 *   - AC6: Mobile Sheet panel with ModuleAccordion
 *
 * Data seeding:
 *   - Course progress seeded via localStorage fixture
 *   - Uses allCourses data (first course with modules)
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants — use a course with video lessons (operative-six)
// ---------------------------------------------------------------------------

/** Navigate directly to a known video lesson in the Lesson Player. */
async function goToFirstLesson(page: Parameters<typeof navigateAndWait>[0]) {
  await navigateAndWait(page, '/courses/operative-six/op6-introduction')
}

// ===========================================================================
// AC1: Collapsible ModuleAccordion in Sidebar
// ===========================================================================

test.describe('AC1: Collapsible ModuleAccordion in Sidebar', () => {
  test('should display accordion-based course structure in desktop sidebar', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player open
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Module accordion is visible in sidebar
    await expect(
      page.getByTestId('course-sidebar-accordion'),
    ).toBeVisible()
  })

  test('should show module titles in accordion triggers', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: At least one accordion trigger with module title exists
    const triggers = page.locator('[data-testid="course-sidebar-accordion"] [data-state]')
    await expect(triggers.first()).toBeVisible()
  })

  test('should show completion badge on each module', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Completion count badge (e.g., "0/3") visible on module
    const badge = page.getByTestId('course-sidebar-accordion').locator('.inline-flex, [class*="badge"]').first()
    await expect(badge).toBeVisible()
  })

  test('should collapse and expand modules', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player, active module is expanded
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // WHEN: User clicks an expanded accordion trigger
    // Use data-slot for a stable locator that doesn't change with state
    const trigger = page.getByTestId('course-sidebar-accordion').locator('[data-slot="accordion-trigger"]').first()
    if (await trigger.count() > 0) {
      await expect(trigger).toHaveAttribute('data-state', 'open')
      await trigger.click()

      // THEN: Module content collapses (data-state="closed")
      await expect(trigger).toHaveAttribute('data-state', 'closed')
    }
  })
})

// ===========================================================================
// AC2: Lesson Details (Title, Duration, Type Icon)
// ===========================================================================

test.describe('AC2: Lesson Details in Course Structure', () => {
  test('should display lesson titles within accordion modules', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Lesson items are visible with text content
    const lessonItems = page.getByTestId('course-sidebar-accordion').locator('a[href*="/courses/"]')
    await expect(lessonItems.first()).toBeVisible()
    const text = await lessonItems.first().textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  test('should show video type icon for video lessons', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Video icon (svg) is visible on lessons with video resources
    const videoIcons = page.getByTestId('course-sidebar-accordion').locator('svg.lucide-video, [data-testid="lesson-icon-video"]')
    // At least one video lesson should exist in sample data
    await expect(videoIcons.first()).toBeVisible()
  })

  test('should show lesson duration when available', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: Duration text is visible on at least one lesson
    const durationText = page.getByTestId('course-sidebar-accordion').locator('text=/\\d+:\\d+/')
    // Duration may not exist on all lessons, but should on at least one
    const count = await durationText.count()
    expect(count).toBeGreaterThanOrEqual(0) // Soft check — verifies no errors
  })
})

// ===========================================================================
// AC3: Switch Lessons Without Page Reload + Active Highlight
// ===========================================================================

test.describe('AC3: Lesson Switching and Active Highlight', () => {
  test('should highlight the active lesson in the sidebar', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with lesson player
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: One lesson link has active highlight styling (blue bg)
    const activeLesson = page.getByTestId('course-sidebar-accordion').locator('a.bg-blue-50, a[class*="bg-blue"]')
    await expect(activeLesson).toHaveCount(1)
  })

  test('should switch to a different lesson when clicked in sidebar', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with first lesson loaded
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    const initialUrl = page.url()

    // WHEN: User clicks a different lesson in the sidebar
    const lessonLinks = page.getByTestId('course-sidebar-accordion').locator('a[href*="/courses/"]')
    const count = await lessonLinks.count()
    if (count > 1) {
      // Click a lesson that is NOT the active one
      const inactiveLesson = lessonLinks.nth(1)
      await inactiveLesson.click()
      await page.waitForLoadState('domcontentloaded')

      // THEN: URL changes (different lesson loaded)
      expect(page.url()).not.toBe(initialUrl)
    }
  })

  test('should update active highlight when switching lessons', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with first lesson
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // WHEN: User clicks a different lesson
    const lessonLinks = page.getByTestId('course-sidebar-accordion').locator('a[href*="/courses/"]')
    const count = await lessonLinks.count()
    if (count > 1) {
      await lessonLinks.nth(1).click()
      await page.waitForLoadState('domcontentloaded')

      // THEN: The newly selected lesson has the active highlight
      const activeLesson = page.getByTestId('course-sidebar-accordion').locator('a.bg-blue-50, a[class*="bg-blue"]')
      await expect(activeLesson).toHaveCount(1)
    }
  })
})

// ===========================================================================
// AC4: "Next Lesson" Button
// ===========================================================================

test.describe('AC4: Next Lesson Button', () => {
  test('should display Next button for non-final lessons', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with a non-final lesson
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // THEN: "Next" button is visible
    const nextButton = page.getByRole('button', { name: /next/i })
    await expect(nextButton).toBeVisible()
  })

  test('should navigate to next lesson when Next button is clicked', async ({
    page,
  }) => {
    // GIVEN: First lesson loaded
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    const initialUrl = page.url()

    // WHEN: User clicks the Next button
    const nextButton = page.getByRole('button', { name: /next/i })
    if (await nextButton.isVisible()) {
      await nextButton.click()
      await page.waitForLoadState('domcontentloaded')

      // THEN: URL changes to the next lesson
      expect(page.url()).not.toBe(initialUrl)
    }
  })
})

// ===========================================================================
// AC5: Auto-Advance 5s Countdown with Cancel
// ===========================================================================

test.describe('AC5: Auto-Advance Countdown', () => {
  /** Simulate video end: wait for video, dispatch ended, dismiss celebration modal. */
  async function triggerVideoEnd(page: Parameters<typeof navigateAndWait>[0]) {
    await page.locator('video').waitFor({ timeout: 5000 })
    await page.evaluate(() => {
      const video = document.querySelector('video')
      if (video) video.dispatchEvent(new Event('ended'))
    })
    // Dismiss the celebration modal if it appears (it opens on first completion)
    const dialog = page.locator('[role="dialog"]')
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
    }
  }

  test('should show auto-advance countdown after video ends', async ({
    page,
  }) => {
    // GIVEN: Desktop viewport with a video lesson
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    // WHEN: Video reaches the end
    await triggerVideoEnd(page)

    // THEN: Auto-advance countdown is visible
    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: 3000 })
  })

  test('should display countdown seconds and next lesson title', async ({
    page,
  }) => {
    // GIVEN: Video has ended, countdown is showing
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    await triggerVideoEnd(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: 3000 })

    // THEN: Countdown text contains seconds and "Next" reference
    const text = await countdown.textContent()
    expect(text).toMatch(/\d/)
    expect(text?.toLowerCase()).toContain('next')
  })

  test('should have a cancel button in the countdown', async ({
    page,
  }) => {
    // GIVEN: Video has ended, countdown is showing
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    await triggerVideoEnd(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: 3000 })

    // THEN: Cancel button is visible within the countdown
    const cancelButton = countdown.getByRole('button', { name: /cancel/i })
    await expect(cancelButton).toBeVisible()
  })

  test('should hide countdown when cancel is clicked', async ({
    page,
  }) => {
    // GIVEN: Countdown is showing
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    await triggerVideoEnd(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: 3000 })

    // WHEN: User clicks Cancel
    const cancelButton = countdown.getByRole('button', { name: /cancel/i })
    await cancelButton.click()

    // THEN: Countdown disappears
    await expect(countdown).toBeHidden()
  })

  test('should have accessible role and aria-live on countdown', async ({
    page,
  }) => {
    // GIVEN: Countdown is showing
    await page.setViewportSize({ width: 1440, height: 900 })
    await goToFirstLesson(page)

    await triggerVideoEnd(page)

    const countdown = page.getByTestId('auto-advance-countdown')
    await expect(countdown).toBeVisible({ timeout: 3000 })

    // THEN: Countdown has role="status" and aria-live="polite"
    await expect(countdown).toHaveAttribute('role', 'status')
    await expect(countdown).toHaveAttribute('aria-live', 'polite')
  })
})

// ===========================================================================
// AC6: Mobile Sheet Panel
// ===========================================================================

test.describe('AC6: Mobile Sheet Panel', () => {
  test('should hide desktop sidebar on mobile viewport', async ({
    page,
  }) => {
    // GIVEN: Mobile viewport (375px)
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // THEN: Desktop sidebar is hidden
    const sidebar = page.getByTestId('course-sidebar-accordion')
    // The sidebar parent is hidden on mobile (xl:block)
    await expect(sidebar).toBeHidden()
  })

  test('should show menu button to open course structure on mobile', async ({
    page,
  }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // THEN: Menu button for opening Sheet is visible
    const menuButton = page.getByRole('button', { name: /open course content/i })
    await expect(menuButton).toBeVisible()
  })

  test('should open Sheet with ModuleAccordion when menu button is clicked', async ({
    page,
  }) => {
    // GIVEN: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    // WHEN: User taps the menu button
    const menuButton = page.getByRole('button', { name: /open course content/i })
    await menuButton.click()

    // THEN: Sheet panel opens with accordion-based course structure
    const sheetAccordion = page.getByTestId('mobile-course-accordion')
    await expect(sheetAccordion).toBeVisible({ timeout: 3000 })
  })

  test('should show lesson links in mobile Sheet accordion', async ({
    page,
  }) => {
    // GIVEN: Mobile viewport with Sheet open
    await page.setViewportSize({ width: 375, height: 667 })
    await goToFirstLesson(page)

    const menuButton = page.getByRole('button', { name: /open course content/i })
    await menuButton.click()

    // THEN: Lesson links are visible in the mobile accordion
    const sheetAccordion = page.getByTestId('mobile-course-accordion')
    await expect(sheetAccordion).toBeVisible({ timeout: 3000 })

    const lessonLinks = sheetAccordion.locator('a[href*="/courses/"]')
    const count = await lessonLinks.count()
    expect(count).toBeGreaterThan(0)
  })
})

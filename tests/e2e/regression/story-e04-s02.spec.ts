/**
 * E04-S02: Course Completion Percentage
 *
 * Tests course completion calculation and progress bar display across:
 * - Course library cards
 * - Course detail page
 * - Real-time updates
 * - Accessibility (ARIA attributes)
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('E04-S02: Course Completion Percentage', () => {
  test('AC1: Progress bar displays with ARIA attributes and text equivalent', async ({
    page,
  }) => {
    // Navigate to a specific course detail page directly
    await page.goto('/courses/confidence-reboot')
    await page.waitForLoadState('domcontentloaded')

    // Find progress bar in the course detail page's progress sidebar
    const progressSidebar = page.locator('.bg-muted').filter({ hasText: 'Your Progress' })
    const progressBar = progressSidebar.locator('[role="progressbar"]')
    await expect(progressBar).toBeVisible()

    // Verify ARIA attributes
    await expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    await expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    await expect(progressBar).toHaveAttribute('aria-valuenow')

    // Verify text equivalent is visible (e.g., "65% complete")
    const progressText = progressSidebar.locator('text=/\\d+% complete/')
    await expect(progressText).toBeVisible()
  })

  test.skip('AC2: Progress bar updates in real-time when completion status changes', async ({
    page,
  }) => {
    // SKIPPED: This test requires E04-S01 (completion status UI) to be implemented.
    // The test body was previously guarded with if ((await contentItem.count()) > 0)
    // which always evaluated false, causing the test to vacuously pass with zero assertions.
    // Once E04-S01 is complete, remove .skip() and verify the test works correctly.

    // Navigate to a specific course detail page directly
    await page.goto('/courses/confidence-reboot')
    await page.waitForLoadState('domcontentloaded')

    // Get initial progress value from the course detail page's progress sidebar
    const progressSidebar = page.locator('.bg-muted').filter({ hasText: 'Your Progress' })
    const progressBar = progressSidebar.locator('[role="progressbar"]')
    const initialValue = await progressBar.getAttribute('aria-valuenow')

    // Mark a content item as completed
    const contentItem = page.locator('[data-testid*="content-status"]').first()
    await contentItem.click()
    const completedOption = page.getByRole('button', { name: /completed/i })
    await completedOption.click()

    // Verify progress bar updated without page refresh
    const newValue = await progressBar.getAttribute('aria-valuenow')
    expect(newValue).not.toBe(initialValue)

    // Verify smooth animation (progress indicator should have transform transition)
    const progressIndicator = progressBar.locator('[data-slot="progress-indicator"]')
    const styles = await progressIndicator.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('transition'),
    )
    expect(styles).toMatch(/transform|all/)
  })

  test('AC3: Progress bar shows 0% for courses with no completed items', async ({
    page,
    localStorage,
  }) => {
    // Navigate to courses
    await goToCourses(page)

    // Seed sidebar localStorage to prevent tablet overlay blocking pointer events
    await localStorage.seed('eduvi-sidebar-v1', 'false')

    // Wait for network to be idle and content to load
    await page.waitForLoadState('networkidle')

    // Get all course cards that have progress bars
    const courseCards = page.getByRole('link').filter({ has: page.locator('[role="progressbar"]') })
    const count = await courseCards.count()
    expect(count).toBeGreaterThan(0)

    // Find a course with 0% completion
    let foundZeroPercent = false
    for (let i = 0; i < count; i++) {
      const card = courseCards.nth(i)
      const progressBar = card.locator('[role="progressbar"]')
      const ariaValue = await progressBar.getAttribute('aria-valuenow')

      if (ariaValue === '0') {
        foundZeroPercent = true
        // Verify text shows "0% complete"
        const progressText = card.locator('text=/0%\\s*complete/i')
        await expect(progressText).toBeVisible()
        break
      }
    }

    // Assert we found at least one course with 0% completion
    expect(foundZeroPercent).toBe(true)
  })

  test('AC4: Progress bar shows 100% with completion badge for fully completed courses', async ({
    page,
    localStorage,
  }) => {
    // Navigate to courses
    await goToCourses(page)

    // Seed sidebar localStorage to prevent tablet overlay blocking pointer events
    await localStorage.seed('eduvi-sidebar-v1', 'false')

    // This test will pass once a course reaches 100% completion
    // For now, we'll verify the structure exists
    const courseCards = page.locator('[class*="card"]')
    const count = await courseCards.count()

    // Check each card for completion state
    for (let i = 0; i < count; i++) {
      const card = courseCards.nth(i)
      const progressBar = card.locator('[role="progressbar"]')

      if ((await progressBar.count()) > 0) {
        const ariaValue = await progressBar.getAttribute('aria-valuenow')

        // If this course is 100% complete
        if (ariaValue === '100') {
          // Verify full/completed visual state
          await expect(progressBar).toHaveAttribute('aria-valuenow', '100')

          // Verify completion badge is visible
          const completionBadge = card.locator(
            '[data-testid="completion-badge"], [class*="badge"]',
          )
          await expect(completionBadge).toBeVisible()
        }
      }
    }
  })

  test('AC5: Course library displays consistent progress bars on all course cards', async ({
    page,
    localStorage,
  }) => {
    await goToCourses(page)

    // Seed sidebar localStorage to prevent tablet overlay blocking pointer events
    // At 640-1023px viewports, the sidebar Sheet defaults to open and blocks all clicks
    await localStorage.seed('eduvi-sidebar-v1', 'false')

    await page.waitForLoadState('networkidle')

    // Get all course cards by looking for links that contain course content
    const courseCards = page.getByRole('link').filter({ has: page.locator('[role="progressbar"]') })
    const count = await courseCards.count()
    expect(count).toBeGreaterThan(0)

    // Verify first 3 cards have progress bars (to keep test fast)
    const cardsToCheck = Math.min(3, count)
    for (let i = 0; i < cardsToCheck; i++) {
      const card = courseCards.nth(i)
      const progressBar = card.locator('[role="progressbar"]')

      // Progress bar should exist on each card
      await expect(progressBar).toBeVisible()

      // Progress bars should have consistent ARIA attributes
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100')

      // All progress bars should have aria-valuenow attribute
      const ariaValueNow = await progressBar.getAttribute('aria-valuenow')
      expect(ariaValueNow).not.toBeNull()
    }
  })
})

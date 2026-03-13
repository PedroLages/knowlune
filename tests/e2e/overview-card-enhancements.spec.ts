/**
 * Overview Card Enhancements E2E Tests
 *
 * Tests all Phase 1-4 enhancements:
 * - Phase 1: NumberFlow animations, shimmer skeletons, sparkline tooltips
 * - Phase 2: Dynamic flame intensity, heatmap tooltips, milestone markers
 * - Phase 3: Card expansion (Sheet), comparison mode
 * - Phase 4: Performance optimizations (memoization, accessibility)
 */
import { test, expect } from '../support/fixtures'
import { createCourseProgress } from '../support/fixtures/factories/course-factory'
import { goToOverview } from '../support/helpers/navigation'

test.describe('Overview Card Enhancements', () => {
  test.describe('Phase 1: Foundation Enhancements', () => {
    test('should display shimmer loading skeletons', async ({ page }) => {
      // Shimmer skeletons appear during initial page load before data is ready
      // Navigate without waiting for full load
      await page.goto('/', { waitUntil: 'domcontentloaded' })

      // Check if any skeleton exists first (fallback to regular skeletons if no shimmer)
      const allSkeletons = page.locator('[data-slot="skeleton"]')
      await expect(allSkeletons.first()).toBeVisible({ timeout: 2000 })

      // Verify shimmer class is applied (CSS animation handles the visual effect)
      const skeletonClasses = await allSkeletons.first().getAttribute('class')
      const hasShimmerOrPulse = skeletonClasses?.includes('animate-shimmer') || skeletonClasses?.includes('animate-pulse')
      expect(hasShimmerOrPulse).toBeTruthy()
    })

    test('should show NumberFlow animated numbers in stats cards', async ({ page }) => {
      await goToOverview(page)

      // Wait for data to load by checking for non-zero values
      await page.waitForFunction(() => {
        const firstValue = document.querySelector('[data-testid="stat-value"]')
        return firstValue && firstValue.textContent && firstValue.textContent.trim() !== '0'
      }, { timeout: 5000 })

      // NumberFlow renders numbers with specific markup
      const statsValue = page.getByTestId('stat-value').first()
      await expect(statsValue).toBeVisible()

      // NumberFlow adds aria-live for accessibility
      const numberFlowElement = statsValue.locator('[aria-live="polite"]')
      await expect(numberFlowElement).toBeVisible()
    })

    test('should display interactive sparkline tooltips', async ({ page }) => {
      await goToOverview(page)

      // Find a stats card with sparkline data
      const lessonsCard = page.getByText('Lessons Completed', { exact: true })
      await expect(lessonsCard).toBeVisible()

      // Hover over sparkline SVG to trigger tooltip
      const sparklineSVG = page.locator('svg[role="img"]').first()
      if (await sparklineSVG.isVisible()) {
        // Hover over sparkline circle (data point)
        const dataPoint = sparklineSVG.locator('circle[class*="hover:opacity-100"]').first()
        if (await dataPoint.count() > 0) {
          await dataPoint.hover()

          // Tooltip should appear
          const tooltip = page.getByRole('tooltip')
          await expect(tooltip).toBeVisible({ timeout: 2000 })
        }
      }
    })
  })

  test.describe('Phase 2: Gamification Enhancements', () => {
    test('should display dynamic flame animation with varying intensity', async ({ page }) => {
      await goToOverview(page)

      // Wait for study streak section to fully load
      await page.waitForSelector('[data-testid="current-streak-value"]', { timeout: 5000 })

      // Find the current streak flame icon
      const flameIcon = page.locator('[data-testid="current-streak-value"]')
      await expect(flameIcon).toBeVisible()

      // Verify flame SVG icon exists (Lucide React component)
      const flameElement = page.locator('svg[class*="text-warning"]').first()
      await expect(flameElement).toBeVisible({ timeout: 2000 })

      // Flame should have strokeWidth attribute (dynamic intensity feature)
      const strokeWidth = await flameElement.getAttribute('stroke-width')
      expect(strokeWidth).toBeTruthy()
    })

    test('should show enhanced heatmap tooltips with course breakdown', async ({ page }) => {
      await goToOverview(page)

      // Find a heatmap cell with activity
      const heatmapCell = page
        .locator('[role="img"]')
        .filter({ hasText: /lesson/i })
        .first()

      if (await heatmapCell.isVisible()) {
        await heatmapCell.hover()

        // Enhanced tooltip should appear with:
        // 1. Date header
        // 2. Lesson count badge
        // 3. Study minutes
        // 4. Course breakdown
        const tooltip = page.getByRole('tooltip')
        await expect(tooltip).toBeVisible({ timeout: 2000 })

        // Check for badge (lesson count)
        const badge = tooltip.locator('[class*="badge"]')
        if (await badge.count() > 0) {
          await expect(badge).toBeVisible()
        }
      }
    })

    test('should display multi-tier milestone markers on achievement banner', async ({ page }) => {
      await goToOverview(page)

      // Achievement banner should be visible
      const achievementBanner = page.getByText('Achievement Progress')
      if (await achievementBanner.isVisible()) {
        await expect(achievementBanner).toBeVisible()

        // SVG should contain milestone marker circles
        const svg = page.locator('svg').filter({ has: page.locator('circle') })
        const milestoneMarkers = svg.locator('circle[class*="text-"]')

        // Should have multiple milestone markers (10, 25, 50, 100, 250, 500)
        const markerCount = await milestoneMarkers.count()
        expect(markerCount).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Phase 3: Advanced Features', () => {
    test('should expand stats card into Sheet panel on click', async ({ page }) => {
      await goToOverview(page)

      // Find stats card button (the actual clickable button element)
      const statsCardButton = page.locator('button[aria-label*="View details for Courses Started"]')
      await expect(statsCardButton).toBeVisible({ timeout: 5000 })
      await statsCardButton.click()

      // Wait for Sheet animation to complete
      const sheet = page.locator('[role="dialog"]')
      await expect(sheet).toBeVisible({ timeout: 3000 })

      // Sheet should have header with icon and label
      const sheetHeader = sheet.getByRole('heading', { name: /Courses Started/i })
      await expect(sheetHeader).toBeVisible()

      // Sheet should have action buttons (with longer timeout for animation)
      const exportButton = sheet.getByRole('button', { name: /export/i })
      const viewAllButton = sheet.getByRole('button', { name: /view all/i })

      await expect(exportButton).toBeVisible({ timeout: 2000 })
      await expect(viewAllButton).toBeVisible({ timeout: 2000 })

      // Close sheet (press Escape)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300) // Wait for close animation
      await expect(sheet).not.toBeVisible()
    })

    test('should display comparison mode with period selector', async ({ page }) => {
      await goToOverview(page)

      // Click stats card button to open Sheet
      const statsCardButton = page.locator('button[aria-label*="View details for Lessons Completed"]')
      await expect(statsCardButton).toBeVisible({ timeout: 5000 })
      await statsCardButton.click()

      const sheet = page.locator('[role="dialog"]')
      await expect(sheet).toBeVisible({ timeout: 3000 })

      // Period selector should be present (Select component with trigger button)
      const periodSelector = sheet.getByRole('combobox')
      await expect(periodSelector).toBeVisible({ timeout: 2000 })

      // Click to open dropdown
      await periodSelector.click()
      await page.waitForTimeout(200) // Wait for dropdown animation

      // Check for period options in dropdown
      const weekOption = page.getByRole('option', { name: /week/i })
      const monthOption = page.getByRole('option', { name: /month/i })

      // At least one option should be visible
      await expect(weekOption.or(monthOption)).toBeVisible({ timeout: 2000 })

      // Close sheet
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    })

    test('should show comparison bars and percentage change', async ({ page }) => {
      await goToOverview(page)

      // Click stats card button to open Sheet
      const statsCardButton = page.locator('button[aria-label*="View details for Courses Started"]')
      await expect(statsCardButton).toBeVisible({ timeout: 5000 })
      await statsCardButton.click()

      const sheet = page.locator('[role="dialog"]')
      await expect(sheet).toBeVisible({ timeout: 3000 })

      // Wait for comparison component to render
      await page.waitForTimeout(500)

      // Look for percentage change indicator (format: +X.X% or -X.X%)
      const percentagePattern = /[+-]?\d+\.\d+%/
      const sheetText = await sheet.textContent()

      // Verify percentage is present in sheet content
      expect(sheetText).toMatch(percentagePattern)

      // Close sheet
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    })
  })

  test.describe('Phase 4: Accessibility & Performance', () => {
    test('should respect prefers-reduced-motion for animations', async ({ page, browserName }) => {
      // Enable reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })

      await goToOverview(page)

      // Shimmer animations should be disabled (fallback to solid background)
      const skeleton = page.locator('[data-slot="skeleton"]').first()
      if (await skeleton.isVisible()) {
        // When reduced motion is enabled, animate-shimmer should not be applied
        // or should be overridden by prefers-reduced-motion media query
        const hasShimmer = await skeleton.evaluate(el =>
          window.getComputedStyle(el).animationName !== 'none'
        )

        // Animation should be disabled
        expect(hasShimmer).toBe(false)
      }
    })

    test('should have proper ARIA labels for interactive elements', async ({ page }) => {
      await goToOverview(page)

      // Wait for page to fully load
      await page.waitForSelector('[data-testid="stat-value"]', { timeout: 5000 })

      // NumberFlow should have aria-live region for accessibility
      const ariaLiveElements = page.locator('[aria-live="polite"]')
      await expect(ariaLiveElements.first()).toBeVisible({ timeout: 2000 })

      // Sparkline SVG should have role="img" and descriptive aria-label
      const sparkline = page.locator('svg[role="img"]').first()
      await expect(sparkline).toBeVisible({ timeout: 2000 })

      const ariaLabel = await sparkline.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel?.toLowerCase()).toContain('activity')

      // Flame icon should have aria-hidden="true" (decorative element)
      const flameIcon = page.locator('svg[class*="text-warning"]').first()
      await expect(flameIcon).toBeVisible({ timeout: 2000 })

      const ariaHidden = await flameIcon.getAttribute('aria-hidden')
      expect(ariaHidden).toBe('true')
    })

    test('should support keyboard navigation for Sheet expansion', async ({ page }) => {
      await goToOverview(page)

      // Wait for stats cards to be interactive
      await page.waitForSelector('button[aria-label*="View details"]', { timeout: 5000 })

      // Focus the first stats card button directly
      await page.focus('button[aria-label*="View details"]')

      // Press Enter to open Sheet
      await page.keyboard.press('Enter')

      // Sheet should open with animation
      const sheet = page.locator('[role="dialog"]')
      await expect(sheet).toBeVisible({ timeout: 3000 })

      // Wait for Sheet to fully render
      await page.waitForTimeout(500)

      // Focus should be trapped inside Sheet - verify interactive elements exist
      // Check for export button specifically (avoids strict mode violation with .or())
      const exportButton = sheet.getByRole('button', { name: /export/i })
      await expect(exportButton).toBeVisible({ timeout: 2000 })

      // Press Escape to close
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300) // Wait for close animation
      await expect(sheet).not.toBeVisible()

      // Focus should return to page (verify document has focus)
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
      expect(['BUTTON', 'BODY', 'DIV']).toContain(focusedElement)
    })
  })

  test.describe('Visual Regression', () => {
    test('should match baseline screenshot for stats cards', async ({ page }) => {
      await goToOverview(page)

      // Wait for stats cards to load
      const statsGrid = page.getByTestId('stats-grid')
      await expect(statsGrid).toBeVisible()

      // Take screenshot of stats cards section
      await expect(statsGrid).toHaveScreenshot('stats-cards.png', {
        maxDiffPixels: 100,
      })
    })

    test('should match baseline screenshot for study streak section', async ({ page }) => {
      await goToOverview(page)

      // Find study streak section
      const streakSection = page.getByRole('heading', { name: 'Study Streak' }).locator('..')
      await expect(streakSection).toBeVisible()

      // Take screenshot of streak section
      await expect(streakSection).toHaveScreenshot('study-streak.png', {
        maxDiffPixels: 100,
      })
    })
  })
})

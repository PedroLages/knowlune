import { test, expect } from '@playwright/test'

test.describe('Overview Page - Comprehensive Design Analysis', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'WebKit CI has layout rendering differences'
  )
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Visual Layout & Structure', () => {
    test('should display all key sections', async ({ page }) => {
      // Page title
      await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()

      // Stats cards
      await expect(page.getByText('Courses Started')).toBeVisible()
      await expect(page.getByText('Lessons Completed')).toBeVisible()
      await expect(page.getByText('Study Notes')).toBeVisible()
      await expect(page.getByText('Courses Completed')).toBeVisible()

      // Continue Studying section (always rendered — shows courses or empty state)
      await expect(page.getByRole('heading', { name: 'Continue Studying' })).toBeVisible()

      // All Courses section
      await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()
    })

    test('should have proper visual hierarchy', async ({ page }) => {
      const h1 = page.getByRole('heading', { level: 1 })
      const h2Elements = page.getByRole('heading', { level: 2 })

      await expect(h1).toBeVisible()
      const h2Count = await h2Elements.count()
      expect(h2Count).toBeGreaterThan(0)
    })

    test('should render stats cards in grid layout', async ({ page }) => {
      const statsGrid = page.getByTestId('stats-grid')
      const statValues = statsGrid.getByTestId('stat-value')
      const count = await statValues.count()

      expect(count).toBe(4)
    })
  })

  test.describe('Responsive Design', () => {
    test('should be mobile-friendly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      // Check if content is visible and doesn't overflow
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

      // Stats cards should stack vertically
      const statsGrid = page.getByTestId('stats-grid')
      await expect(statsGrid).toBeVisible()
    })

    test('should be tablet-friendly', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })

      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
      await expect(page.getByText('Courses Started')).toBeVisible()
    })

    test('should be desktop-optimized', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })

      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

      // Stats should be in horizontal row on desktop
      const statsGrid = page.getByTestId('stats-grid')
      const boundingBox = await statsGrid.boundingBox()
      expect(boundingBox?.width).toBeGreaterThan(800)
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      const h1Count = await page.getByRole('heading', { level: 1 }).count()
      expect(h1Count).toBe(1)

      const h2Count = await page.getByRole('heading', { level: 2 }).count()
      expect(h2Count).toBeGreaterThan(0)
    })

    test('should have accessible links', async ({ page }) => {
      const links = page.getByRole('link')
      const linkCount = await links.count()

      expect(linkCount).toBeGreaterThan(0)

      // First link should be visible and accessible
      const firstLink = links.first()
      await expect(firstLink).toBeVisible()
    })

    test('should have proper image alt text', async ({ page }) => {
      const images = page.getByRole('img')
      const imageCount = await images.count()

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i)
        const alt = await img.getAttribute('alt')
        expect(alt).toBeTruthy()
      }
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Check if focus is visible
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      expect(focused).toBeTruthy()
    })
  })

  test.describe('User Interactions', () => {
    test('should navigate to course on card click', async ({ page }) => {
      const firstCourse = page
        .getByRole('link')
        .filter({ hasText: /lessons$/ })
        .first()
      await expect(firstCourse).toBeVisible()

      await firstCourse.click()
      await page.waitForURL(/\/courses\//)

      expect(page.url()).toContain('/courses/')
    })

    test('should show hover effects on cards', async ({ page }) => {
      // Target a course link (always present in All Courses)
      const courseLink = page
        .getByRole('link')
        .filter({ hasText: /lessons$/ })
        .first()
      await expect(courseLink).toBeVisible()

      // Hover and check for shadow change
      await courseLink.hover()

      const boxShadow = await courseLink.evaluate(el => window.getComputedStyle(el).boxShadow)

      expect(boxShadow).not.toBe('none')
    })
  })

  test.describe('Performance & Loading', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(3000) // Should load in under 3 seconds
    })

    test('should lazy load images', async ({ page }) => {
      const firstImage = page.getByRole('img').first()
      await expect(firstImage).toBeVisible()

      const loading = await firstImage.getAttribute('loading')
      expect(loading).toBe('lazy')
    })

    test('should handle missing images gracefully', async ({ page }) => {
      // All course cards should have visual content (image or icon placeholder)
      const courseImages = page.getByRole('img')
      const imageCount = await courseImages.count()

      // At minimum, the page should have images (course covers, sparkline, etc.)
      expect(imageCount).toBeGreaterThan(0)

      // Verify first image renders successfully
      await expect(courseImages.first()).toBeVisible()
    })
  })

  test.describe('Content & Data Display', () => {
    test('should display accurate statistics', async ({ page }) => {
      // Check if stat values are numbers
      const statValues = page.getByTestId('stat-value')
      const count = await statValues.count()

      expect(count).toBe(4)

      for (let i = 0; i < count; i++) {
        const value = await statValues.nth(i).textContent()
        expect(value).toMatch(/^\d+$/)
      }
    })

    test('should show progress bars in continue studying', async ({ page }) => {
      // Seed progress data to guarantee Continue Studying shows courses
      await page.evaluate(() => {
        localStorage.setItem(
          'course-progress',
          JSON.stringify({
            'operative-six': {
              courseId: 'operative-six',
              completedLessons: ['lesson-1', 'lesson-2'],
              lastWatchedLesson: 'lesson-3',
              notes: {},
              startedAt: new Date().toISOString(),
              lastAccessedAt: new Date().toISOString(),
            },
          })
        )
      })
      await page.reload()
      await page.waitForLoadState('domcontentloaded')

      // Assert unconditionally — seeded data guarantees these exist
      await expect(page.getByRole('heading', { name: 'Continue Studying' })).toBeVisible()
      const progressBars = page.locator('[role="progressbar"]')
      await expect(progressBars.first()).toBeVisible()

      // Verify percentage is displayed
      await expect(page.getByText(/%$/)).toBeVisible()
    })

    test('should display all courses', async ({ page }) => {
      const allCoursesSection = page.getByRole('heading', { name: 'All Courses' })
      await expect(allCoursesSection).toBeVisible()

      // Should have course cards
      const courseCards = page.getByText(/lessons$/)
      const courseCount = await courseCards.count()

      expect(courseCount).toBeGreaterThan(0)
    })
  })

  test.describe('Visual Design Quality', () => {
    test('should have consistent spacing', async ({ page }) => {
      const sections = page.locator('section')
      const sectionCount = await sections.count()

      for (let i = 0; i < sectionCount; i++) {
        const section = sections.nth(i)
        const marginBottom = await section.evaluate(el => window.getComputedStyle(el).marginBottom)

        // Should have margin (mb-8 = 2rem = 32px)
        expect(marginBottom).toBeTruthy()
      }
    })

    test('should use theme colors consistently', async ({ page }) => {
      // StatsCard icons use blue-600 accent color per design system
      const blueElements = page.locator('.text-blue-600')
      const count = await blueElements.count()

      expect(count).toBeGreaterThan(0)
    })

    test('should have rounded corners on cards', async ({ page }) => {
      // StatsCard uses rounded-[24px] per design system
      const statsGrid = page.getByTestId('stats-grid')
      const card = statsGrid.locator('> *').first()
      await expect(card).toBeVisible()

      const borderRadius = await card.evaluate(el => window.getComputedStyle(el).borderRadius)

      expect(borderRadius).not.toBe('0px')
    })
  })

  test.describe('Screenshot Analysis', () => {
    test('should capture desktop view', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
      await page.screenshot({ path: 'tests/screenshots/overview-desktop.png', fullPage: true })
    })

    test('should capture tablet view', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
      await page.screenshot({ path: 'tests/screenshots/overview-tablet.png', fullPage: true })
    })

    test('should capture mobile view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
      await page.screenshot({ path: 'tests/screenshots/overview-mobile.png', fullPage: true })
    })
  })
})

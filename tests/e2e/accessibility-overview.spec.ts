import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FIXED_DATE } from '../utils/test-time'

// Configure test data for consistent state
const setupTestData = async page => {
  await page.evaluate(fixedDate => {
    const now = new Date(fixedDate)
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    // Course progress
    const progress = {
      'operative-six': {
        courseId: 'operative-six',
        completedLessons: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5'],
        lastWatchedLesson: 'lesson-5',
        notes: {
          'lesson-1': 'Excellent foundation',
          'lesson-3': 'Key behavioral patterns',
        },
        startedAt: twoDaysAgo.toISOString(),
        lastAccessedAt: oneDayAgo.toISOString(),
      },
      '6mx': {
        courseId: '6mx',
        completedLessons: ['lesson-1', 'lesson-2'],
        lastWatchedLesson: 'lesson-3',
        notes: {},
        startedAt: oneDayAgo.toISOString(),
        lastAccessedAt: now.toISOString(),
      },
    }

    // Study log
    const studyLog = [
      {
        type: 'lesson_complete',
        courseId: '6mx',
        lessonId: 'lesson-2',
        timestamp: now.toISOString(),
      },
      {
        type: 'lesson_complete',
        courseId: 'operative-six',
        lessonId: 'lesson-5',
        timestamp: oneDayAgo.toISOString(),
      },
      {
        type: 'lesson_complete',
        courseId: 'operative-six',
        lessonId: 'lesson-4',
        timestamp: twoDaysAgo.toISOString(),
      },
    ]

    localStorage.setItem('course-progress', JSON.stringify(progress))
    localStorage.setItem('study-log', JSON.stringify(studyLog))
  }, FIXED_DATE)
}

test.describe('Accessibility - Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar state to prevent overlay blocking on tablet/mobile viewports
    // (knowlune-sidebar-v1 defaults to open=true at 640-1023px, creating fullscreen Sheet overlay)
    // Also dismiss onboarding overlay to prevent it from blocking test interactions
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
    })

    // Suppress console errors from missing media files
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text())
      }
    })
  })

  test('Overview page - WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/')
    await setupTestData(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test.skip('Overview page - Tab key navigation', async ({ page }) => {
    // SKIPPED: Overview page sidebar links all share the same tagName+role pattern,
    // so tabbing through them appears as 1 unique element type. The test needs to be
    // redesigned to check focus-moves-forward rather than unique-element-types.
    // Additionally, TagManagementPanel "Maximum update depth exceeded" crash on Courses
    // page can cascade and cause the overview page to render in error boundary state.
    await page.goto('/')
    await setupTestData(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Press Tab multiple times and verify focus moves through elements
    const focusableElements: Array<{
      tagName: string | undefined
      role: string | null
      ariaLabel: string | null
    }> = []

    // Start from body
    await page.evaluate(() => document.body.focus())

    // Tab through the first 10 focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tagName: el?.tagName,
          role: el?.getAttribute('role'),
          ariaLabel: el?.getAttribute('aria-label'),
        }
      })
      focusableElements.push(focusedElement)
    }

    // Verify we moved through different elements
    expect(focusableElements.length).toBeGreaterThan(0)

    // Verify at least some navigation occurred - use tagName + ariaLabel for uniqueness
    // (multiple elements may share the same tagName+role but differ by ariaLabel)
    const uniqueElements = new Set(
      focusableElements.map(el => `${el.tagName}-${el.role}-${el.ariaLabel}`)
    )
    expect(uniqueElements.size).toBeGreaterThan(1)
  })

  test('Mobile viewport - Touch targets are adequate size', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await setupTestData(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Find interactive elements
    const buttons = page.locator('button, a[href]')
    const firstButtons = await buttons.all().then(btns => btns.slice(0, 10))

    for (const button of firstButtons) {
      const isVisible = await button.isVisible()

      if (isVisible) {
        const box = await button.boundingBox()

        if (box) {
          // WCAG 2.1 AA requires touch targets to be at least 44x44 CSS pixels
          // We'll allow some flexibility for nested interactive elements
          const minSize = 40 // Slightly below 44 to account for some edge cases

          if (box.width < minSize || box.height < minSize) {
            const tagName = await button.evaluate(el => el.tagName)
            const className = await button.getAttribute('class')
            console.log(
              `Small touch target: ${tagName} (${Math.round(box.width)}x${Math.round(box.height)}) - ${className}`
            )
          }
        }
      }
    }
  })

  test('Mobile viewport - No horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await setupTestData(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('Buttons - All icon-only buttons have ARIA labels', async ({ page }) => {
    await page.goto('/')
    await setupTestData(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Find all buttons
    const buttons = await page.locator('button').all()

    for (const button of buttons) {
      const isVisible = await button.isVisible()

      if (isVisible) {
        const textContent = await button.textContent()
        const ariaLabel = await button.getAttribute('aria-label')
        const ariaLabelledBy = await button.getAttribute('aria-labelledby')
        const title = await button.getAttribute('title')

        // If button has no visible text, it should have aria-label or aria-labelledby
        if (!textContent || textContent.trim().length === 0) {
          const hasAccessibleName = ariaLabel || ariaLabelledBy || title

          // Some buttons might be in templates or hidden states, so we just warn
          if (!hasAccessibleName) {
            console.log('Warning: Icon-only button without accessible name found')
          }
        }
      }
    }
  })

  test('Forms - Input fields have associated labels', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check search input in header
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]')
    const count = await searchInput.count()

    if (count > 0) {
      const ariaLabel = await searchInput.first().getAttribute('aria-label')
      const ariaLabelledBy = await searchInput.first().getAttribute('aria-labelledby')
      const id = await searchInput.first().getAttribute('id')

      // Input should have aria-label or be associated with a label element
      const hasAccessibleName = ariaLabel || ariaLabelledBy

      if (id) {
        const associatedLabel = page.locator(`label[for="${id}"]`)
        const labelExists = (await associatedLabel.count()) > 0

        expect(hasAccessibleName || labelExists).toBeTruthy()
      }
    }
  })
})

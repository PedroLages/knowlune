import { test, expect } from '@playwright/test'

/**
 * Design Review Automated Testing
 *
 * This test suite runs comprehensive design review checks across
 * multiple viewports, testing responsive behavior, accessibility,
 * and visual consistency.
 *
 * Usage:
 *   npx playwright test tests/design-review.spec.ts
 *   TEST_ROUTE=/ npx playwright test tests/design-review.spec.ts
 */

const TEST_ROUTE = process.env.TEST_ROUTE || '/'
const VIEWPORTS = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 },
]

function addFinding(severity: string, category: string, issue: string) {
  test.info().annotations.push({ type: `${severity}:${category}`, description: issue })
}

test.describe('Design Review - Responsive Testing', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) - Layout validation`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      // Listen for console errors
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      await page.goto(TEST_ROUTE)
      await page.waitForLoadState('domcontentloaded')

      // Check for horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      )

      if (hasHorizontalScroll) {
        addFinding('high', 'Responsive Design', `Horizontal scroll detected on ${viewport.name}`)
      }
      expect(hasHorizontalScroll).toBe(false)

      // Capture full page screenshot
      await page.screenshot({
        path: `test-results/design-review-${viewport.name.toLowerCase()}.png`,
        fullPage: true
      })

      // Check for console errors
      if (consoleErrors.length > 0) {
        addFinding('high', 'JavaScript Errors', `${consoleErrors.length} console errors detected`)
      }
      expect(consoleErrors.length).toBe(0)

      // Check touch targets on mobile
      if (viewport.name === 'Mobile') {
        const interactiveElements = page.locator('button, a[href], input, select, textarea, [role="button"]')
        const count = await interactiveElements.count()
        let smallTargetCount = 0

        for (let i = 0; i < Math.min(count, 50); i++) {
          const element = interactiveElements.nth(i)
          const box = await element.boundingBox()

          if (box && (box.width < 44 || box.height < 44)) {
            smallTargetCount++
          }
        }

        if (smallTargetCount > 0) {
          addFinding('medium', 'Touch Targets', `${smallTargetCount} elements smaller than 44x44px on mobile`)
        }
      }
    })
  }
})

test.describe('Design Review - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_ROUTE)
    await page.waitForLoadState('domcontentloaded')
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1Count = await page.locator('h1').count()

    if (h1Count === 0) {
      addFinding('blocker', 'Accessibility', 'No H1 heading found on page')
    }
    expect(h1Count).toBeGreaterThan(0)

    if (h1Count > 1) {
      addFinding('high', 'Accessibility', `Multiple H1 headings found (${h1Count})`)
    }
    expect(h1Count).toBeLessThanOrEqual(1)
  })

  test('should have ARIA labels on icon-only buttons', async ({ page }) => {
    const buttons = page.locator('button')
    const count = await buttons.count()
    const missingLabels: string[] = []

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      const ariaLabelledBy = await button.getAttribute('aria-labelledby')
      const title = await button.getAttribute('title')

      if (!text?.trim() && !ariaLabel && !ariaLabelledBy && !title) {
        const outerHTML = await button.evaluate(el => el.outerHTML.slice(0, 100))
        missingLabels.push(outerHTML)
      }
    }

    if (missingLabels.length > 0) {
      addFinding('high', 'Accessibility', `${missingLabels.length} icon buttons missing ARIA labels`)
    }
  })

  test('should have alt text on images', async ({ page }) => {
    const images = page.locator('img')
    const count = await images.count()
    const missingAlt: string[] = []

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      if (alt === null && role !== 'presentation') {
        const src = await img.getAttribute('src')
        missingAlt.push(src || 'unknown')
      }
    }

    if (missingAlt.length > 0) {
      addFinding('high', 'Accessibility', `${missingAlt.length} images missing alt attribute`)
    }
  })

  test('should have proper form labels', async ({ page }) => {
    const inputs = page.locator('input:not([type="hidden"]), textarea, select')
    const count = await inputs.count()
    const unlabeledInputs: string[] = []

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')

      let hasLabel = false
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        hasLabel = await label.count() > 0
      }

      if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
        const type = await input.getAttribute('type')
        unlabeledInputs.push(type || 'unknown')
      }
    }

    if (unlabeledInputs.length > 0) {
      addFinding('high', 'Accessibility', `${unlabeledInputs.length} form inputs missing proper labels`)
    }
  })

  test('should use semantic HTML', async ({ page }) => {
    const divButtons = await page.locator('div[onclick], div[role="button"]:not([tabindex])').count()

    if (divButtons > 0) {
      addFinding('medium', 'Accessibility', `${divButtons} div elements used as buttons`)
    }

    const mainCount = await page.locator('main').count()
    if (mainCount === 0) {
      addFinding('medium', 'Accessibility', 'No <main> landmark found')
    }

    const navCount = await page.locator('nav').count()
    if (navCount === 0) {
      addFinding('low', 'Accessibility', 'No <nav> landmark found')
    }
  })
})

test.describe('Design Review - Interaction States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_ROUTE)
    await page.waitForLoadState('domcontentloaded')
  })

  test('should have visible focus indicators', async ({ page }) => {
    const focusable = page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const count = await focusable.count()

    if (count > 0) {
      const firstElement = focusable.first()
      await firstElement.focus()

      const hasOutline = await firstElement.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return styles.outline !== 'none' &&
               styles.outline !== '0px' &&
               styles.outlineWidth !== '0px'
      })

      const hasRing = await firstElement.evaluate((el) => {
        const styles = window.getComputedStyle(el)
        return styles.boxShadow !== 'none' && styles.boxShadow !== ''
      })

      if (!hasOutline && !hasRing) {
        addFinding('medium', 'Interaction States', 'Focus indicators may not be visible')
      }
    }
  })

  test('should have hover states on interactive elements', async ({ page }) => {
    const buttons = page.locator('button, a[href]')
    const count = Math.min(await buttons.count(), 10)

    let missingHover = 0
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const className = await button.getAttribute('class') || ''

      if (!className.includes('hover:')) {
        missingHover++
      }
    }

    if (missingHover > count * 0.5) {
      addFinding('low', 'Interaction States', 'Many interactive elements may lack hover states')
    }
  })
})

test.describe('Design Review - Visual Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_ROUTE)
    await page.waitForLoadState('domcontentloaded')
  })

  test('should use consistent background color', async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor
    })

    // Expected background: #FAF5EE (warm off-white)
    const expectedColors = ['rgb(250, 245, 238)', 'rgba(250, 245, 238, 1)']

    if (!expectedColors.includes(bgColor)) {
      addFinding('medium', 'Visual Consistency', 'Background color does not match design system')
    }
  })

  test('should have consistent border radius on cards', async ({ page }) => {
    const card = page.locator('[class*="card"], [class*="rounded-"]').first()
    const count = await card.count()

    if (count > 0) {
      const borderRadius = await card.evaluate((el) => {
        return window.getComputedStyle(el).borderRadius
      })

      if (borderRadius && borderRadius !== '24px' && borderRadius !== '1.5rem') {
        addFinding('low', 'Visual Consistency', 'Card border radius may not match design system')
      }
    }
  })
})

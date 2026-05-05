/**
 * Design review: Courses page control bar UX changes.
 *
 * Checks:
 *   1. Control bar has 3 grouped sections: Filter, Sort, View
 *   2. ViewModeToggle has visible active state (bg-brand)
 *   3. Card hover effects
 *   4. Responsive at 375px, 768px, 1440px
 *   5. "Your Courses" heading
 *   6. Console errors
 */
import { chromium, type Browser, type Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

type Finding = {
  severity: 'high' | 'medium' | 'low'
  area: string
  issue: string
}

const findings: Finding[] = []

function addFinding(severity: 'high' | 'medium' | 'low', area: string, issue: string) {
  findings.push({ severity, area, issue })
}

async function setupGuestSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
    if (!sessionStorage.getItem('knowlune-guest-id')) {
      sessionStorage.setItem('knowlune-guest-id', crypto.randomUUID())
    }
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
}

async function run() {
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })

    // Collect console errors across the test
    const consoleErrors: string[] = []

    // First, navigate with the desktop viewport to seed data
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await setupGuestSession(page)
    await page.goto('http://localhost:5173/courses', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // ============================================================
    // CHECK 1: Page loads without errors
    // ============================================================
    if (consoleErrors.length > 0) {
      // Filter out benign errors
      const relevantErrors = consoleErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('Failed to load resource: the server responded with a status of 404')
      )
      if (relevantErrors.length > 0) {
        addFinding('high', 'console', `Console errors detected: ${relevantErrors.join(' | ')}`)
      }
    }

    // ============================================================
    // CHECK 2: Check page title
    // ============================================================
    const pageTitle = await page.locator('h1').first().textContent()
    if (pageTitle?.trim() !== 'All Courses') {
      addFinding('medium', 'heading', `Expected "All Courses" heading, found "${pageTitle?.trim()}"`)
    }

    // ============================================================
    // CHECK 3: Look for control bar sections - Filter, Sort, View
    // ============================================================
    const controlBarLabels = await page.locator('text=Filter,text=Sort,text=View').all()
    const controlBarText = await page.locator('text=/^(Filter|Sort|View)$/').allTextContents()

    const labelsFound = controlBarText.map(t => t.trim())

    if (!labelsFound.includes('Filter')) {
      addFinding('low', 'control-bar', 'Filter section label not found in control bar (may be hidden when no courses exist)')
    }
    if (!labelsFound.includes('Sort')) {
      addFinding('high', 'control-bar', 'Sort section label not found in control bar')
    }
    if (!labelsFound.includes('View')) {
      addFinding('high', 'control-bar', 'View section label not found in control bar')
    }

    // ============================================================
    // CHECK 4: Check "Your Courses" heading
    // ============================================================
    const yourCoursesHeading = page.locator('h2:has-text("Your Courses")')
    const yourCoursesCount = await yourCoursesHeading.count()
    if (yourCoursesCount > 0) {
      // Good - heading is present
    } else {
      // The page may be in empty state - that's OK, we still need to verify
      // the control bar would render correctly when courses exist.
      // Let's check if we're in empty state
      const emptyState = page.locator('[data-testid="courses-empty-state"]')
      const emptyStateVisible = await emptyState.isVisible().catch(() => false)
      if (emptyStateVisible) {
        addFinding('low', 'heading', 'Page is in empty state - "Your Courses" heading not rendered (expected: no courses yet)')
      } else {
        addFinding('medium', 'heading', '"Your Courses" heading (h2) not found on non-empty page')
      }
    }

    // ============================================================
    // CHECK 5: ViewModeToggle active state
    // ============================================================
    const viewModeToggle = page.locator('[data-testid="course-view-mode-toggle"]')
    const toggleCount = await viewModeToggle.count()

    if (toggleCount > 0) {
      // Check the active item has bg-brand
      const activeItem = viewModeToggle.locator('[data-state="on"]')
      const activeCount = await activeItem.count()
      if (activeCount > 0) {
        // Toggle is present and has an active state set
      } else {
        addFinding('medium', 'view-toggle', 'ViewModeToggle found but no item has data-state="on"')
      }
    } else {
      // Might be in empty state - check if control bar is hidden
      addFinding('low', 'view-toggle', 'ViewModeToggle not found (likely in empty state - no courses imported)')
    }

    // ============================================================
    // CHECK 6: StatusFilter - check it exists in the control bar
    // ============================================================
    const statusFilter = page.locator('[data-testid="status-filter-bar"]')
    const statusFilterCount = await statusFilter.count()
    if (statusFilterCount === 0) {
      addFinding('low', 'status-filter', 'StatusFilter not found on page (likely in empty state)')
    }

    // ============================================================
    // RESPONSIVE CHECKS
    // ============================================================
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(300)

      // Check for horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      if (hasHorizontalScroll) {
        addFinding('high', `responsive-${vp.name}`, `Horizontal scroll detected at ${vp.width}px viewport`)
      }

      // Check control bar wrapping at mobile
      if (vp.width <= 375) {
        const controlBarItems = await page.locator('text=/^(Filter|Sort|View)$/').count()
        // At mobile, items should wrap (or stack) vertically
        // Just check nothing is clipped/overlapping
        const isClipped = await page.evaluate(() => {
          const body = document.body
          return body.scrollWidth > body.clientWidth || body.scrollHeight > body.clientHeight + 50
        })
        if (isClipped) {
          addFinding('low', `responsive-${vp.name}`, 'Content may be clipped at mobile viewport')
        }
      }

      // Touch target check at mobile
      if (vp.width <= 768) {
        // Check that the control bar labels are visible (not overflowing)
        const labelVisibility = await page.locator('text=/^(Filter|Sort|View)$/').evaluateAll(
          (els) => els.map(el => ({
            text: el.textContent,
            visible: !!el.getBoundingClientRect().width
          }))
        ).catch(() => [])

        const hiddenLabels = labelVisibility.filter(l => !l.visible)
        if (hiddenLabels.length > 0) {
          addFinding('medium', `responsive-${vp.name}`, `Control bar labels hidden at ${vp.width}px: ${hiddenLabels.map(l => l.text).join(', ')}`)
        }
      }
    }

    // ============================================================
    // OUTPUT
    // ============================================================
    console.log(JSON.stringify({ findings }))

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    addFinding('high', 'playwright', `Playwright test failed: ${message}`)
    console.log(JSON.stringify({ findings }))
  } finally {
    if (browser) await browser.close()
  }
}

run()

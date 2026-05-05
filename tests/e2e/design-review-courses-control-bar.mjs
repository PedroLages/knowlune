/**
 * Design review: Courses page control bar UX changes.
 *
 * Seeds course data in IndexedDB so the page shows the non-empty layout,
 * then checks:
 *   1. Control bar has 3 grouped sections: Filter, Sort, View
 *   2. ViewModeToggle has visible active state (bg-brand)
 *   3. Card hover effects
 *   4. Responsive at 375px, 768px, 1440px (no horizontal scroll)
 *   5. "Your Courses" heading
 *   6. Console errors
 *
 * Usage: node tests/e2e/design-review-courses-control-bar.mjs
 */
import { chromium } from 'playwright'

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const findings = []

function addFinding(severity, area, issue) {
  findings.push({ severity, area, issue })
}

async function setupGuestSession(page) {
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

async function seedCourseData(page) {
  await page.evaluate(async () => {
    const dbName = 'ElearningDB'

    // Helper to wait for store
    function openDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }

    const db = await openDB()

    // Seed imported courses
    if (db.objectStoreNames.contains('importedCourses')) {
      const tx = db.transaction('importedCourses', 'readwrite')
      const store = tx.objectStore('importedCourses')

      const now = new Date()
      const courses = [
        {
          id: 'course-1',
          name: 'Introduction to Machine Learning',
          videoCount: 24,
          pdfCount: 5,
          totalDuration: 86400, // 24h
          maxResolutionHeight: 1080,
          totalFileSize: 2_400_000_000,
          status: 'active',
          tags: ['AI', 'Python'],
          category: '',
          description: 'A comprehensive introduction to ML concepts',
          importedAt: now.toISOString(),
          authorId: null,
          youtubeThumbnailUrl: null,
          source: 'folder'
        },
        {
          id: 'course-2',
          name: 'Advanced React Patterns',
          videoCount: 12,
          pdfCount: 3,
          totalDuration: 43200, // 12h
          maxResolutionHeight: 2160,
          totalFileSize: 1_200_000_000,
          status: 'not-started',
          tags: ['React', 'Frontend'],
          category: '',
          description: '',
          importedAt: new Date(now.getTime() - 86400000).toISOString(),
          authorId: null,
          youtubeThumbnailUrl: null,
          source: 'folder'
        },
        {
          id: 'course-3',
          name: 'Database Design Fundamentals',
          videoCount: 18,
          pdfCount: 7,
          totalDuration: 64800, // 18h
          maxResolutionHeight: 720,
          totalFileSize: 1_800_000_000,
          status: 'completed',
          tags: ['SQL', 'Backend'],
          category: '',
          description: '',
          importedAt: new Date(now.getTime() - 172800000).toISOString(),
          authorId: null,
          youtubeThumbnailUrl: null,
          source: 'folder'
        }
      ]

      for (const course of courses) {
        store.put(course)
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      })
    } else {
      db.close()
      throw new Error('importedCourses store not found')
    }
  })
}

async function run() {
  let browser = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })

    const consoleErrors = []
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[error] ${msg.text()}`)
      }
    })

    await setupGuestSession(page)

    // Navigate to '/' first (need real URL before IndexedDB access)
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(500)

    // Redirect should go to /courses when guest session is active
    // Let's seed data and navigate directly to /courses
    await seedCourseData(page)

    await page.goto('http://localhost:5173/courses', { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1500) // Let lazy loading complete

    // Take a screenshot for visual reference
    await page.screenshot({ path: '/tmp/design-review-courses.png', fullPage: true })

    // ============================================================
    // CHECK 1: Console errors (filter out known pre-existing sync engine issues)
    // ============================================================
    if (consoleErrors.length > 0) {
      const preExistingErrors = consoleErrors.filter(
        (e) =>
          e.includes('syncEngine') ||
          e.includes('quiz_attempts') ||
          e.includes('ai_usage_events')
      )
      const newErrors = consoleErrors.filter(
        (e) =>
          !e.includes('syncEngine') &&
          !e.includes('quiz_attempts') &&
          !e.includes('ai_usage_events') &&
          !e.includes('favicon') &&
          !e.includes('404')
      )
      if (newErrors.length > 0) {
        addFinding('high', 'console', `Console errors detected (${newErrors.length}): ${newErrors.slice(0, 3).join(' | ')}`)
      }
      if (preExistingErrors.length > 0) {
        addFinding('low', 'console', `Pre-existing sync engine errors (not from this PR): ${preExistingErrors.slice(0, 2).join(' | ')}`)
      }
    }

    // ============================================================
    // CHECK 2: Page title
    // ============================================================
    const pageTitle = await page.locator('h1').first().textContent()
    if (pageTitle?.trim() !== 'All Courses') {
      addFinding('medium', 'heading', `Expected "All Courses" heading, found "${pageTitle?.trim()}"`)
    }

    // ============================================================
    // CHECK 3: "Your Courses" heading
    // ============================================================
    const yourCoursesHeading = page.locator('h2:has-text("Your Courses")')
    const yourCoursesCount = await yourCoursesHeading.count()
    if (yourCoursesCount === 0) {
      addFinding('high', 'heading', '"Your Courses" heading (h2) not found. Expected "Your Courses" section heading.')
    }

    // ============================================================
    // CHECK 4: Control bar sections - Filter, Sort, View
    // ============================================================
    // The ControlBarSection renders <span> with uppercase label
    const controlBarLabels = page.locator('span:has-text("Filter"),span:has-text("Sort"),span:has-text("View")')
    const labelTexts = await controlBarLabels.allTextContents()
    const labelsFound = labelTexts.map(t => t.trim())

    if (!labelsFound.some(l => l.toLowerCase() === 'filter')) {
      addFinding('high', 'control-bar', 'Filter section label not found in control bar')
    }
    if (!labelsFound.some(l => l.toLowerCase() === 'sort')) {
      addFinding('high', 'control-bar', 'Sort section label not found in control bar')
    }
    if (!labelsFound.some(l => l.toLowerCase() === 'view')) {
      addFinding('high', 'control-bar', 'View section label not found in control bar')
    }

    // Check the "ShowDivider" logic: first section has no divider, others do
    const separators = await page.locator('[role="separator"]').count()
    if (labelsFound.length >= 2 && separators === 0) {
      addFinding('low', 'control-bar', 'No vertical separators found between control bar sections')
    }

    // ============================================================
    // CHECK 5: ViewModeToggle
    // ============================================================
    const viewModeToggle = page.locator('[data-testid="course-view-mode-toggle"]')
    const toggleCount = await viewModeToggle.count()

    if (toggleCount > 0) {
      // Check items count
      const items = viewModeToggle.locator('[role="radio"]')
      const itemCount = await items.count()
      if (itemCount !== 3) {
        addFinding('medium', 'view-toggle', `Expected 3 view mode options, found ${itemCount}`)
      }

      // Check active item has data-state="on"
      const activeItem = viewModeToggle.locator('[data-state="on"]')
      const activeCount = await activeItem.count()
      if (activeCount === 0) {
        addFinding('medium', 'view-toggle', 'ViewModeToggle found but no item has data-state="on" (expected grid to be default)')
      }

      // Check aria-label on the toggle group
      const toggleAria = await viewModeToggle.getAttribute('aria-label')
      if (!toggleAria) {
        addFinding('medium', 'accessibility', 'ViewModeToggle missing aria-label')
      }
    } else {
      addFinding('high', 'view-toggle', 'ViewModeToggle (data-testid="course-view-mode-toggle") not found')
    }

    // ============================================================
    // CHECK 6: StatusFilter
    // ============================================================
    const statusFilter = page.locator('[data-testid="status-filter-bar"]')
    const statusFilterCount = await statusFilter.count()
    if (statusFilterCount > 0) {
      const filterButtons = statusFilter.locator('[data-testid="status-filter-button"]')
      const filterButtonCount = await filterButtons.count()
      if (filterButtonCount !== 4) {
        addFinding('medium', 'status-filter', `Expected 4 status filter buttons, found ${filterButtonCount}`)
      }

      // Verify filter buttons have adequate touch targets (min-h-[44px])
      const firstButton = filterButtons.first()
      const box = await firstButton.boundingBox()
      if (box && box.height < 40) {
        addFinding('medium', 'status-filter', `Status filter buttons have height ${box.height}px — may not meet 44px touch target`)
      }
    } else {
      addFinding('medium', 'status-filter', 'StatusFilter (data-testid="status-filter-bar") not found')
    }

    // ============================================================
    // CHECK 7: Sort select accessibility
    // ============================================================
    const sortSelect = page.locator('[data-testid="sort-select"]')
    if (await sortSelect.isVisible().catch(() => false)) {
      const sortAria = await sortSelect.getAttribute('aria-label')
      if (!sortAria) {
        addFinding('medium', 'accessibility', 'Sort select missing aria-label')
      }
    }

    // ============================================================
    // RESPONSIVE CHECKS
    // ============================================================
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(400)

      // Check for horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      })
      if (hasHorizontalScroll) {
        addFinding('high', `responsive-${vp.name}`, `Horizontal scroll detected at ${vp.width}px viewport`)
      }

      // Check control bar section labels are visible
      const labelElements = page.locator('span:has-text("Filter"),span:has-text("Sort"),span:has-text("View")')
      for (let i = 0; i < await labelElements.count(); i++) {
        const el = labelElements.nth(i)
        const isVisible = await el.isVisible().catch(() => false)
        if (!isVisible) {
          addFinding('medium', `responsive-${vp.name}`, `Control bar label hidden at ${vp.width}px viewport`)
          break
        }
      }

      // Touch target check: sort select should be ≥44px tall at all viewports
      const sortBox = await sortSelect.boundingBox()
      if (sortBox && sortBox.height > 0 && sortBox.height < 40) {
        addFinding('medium', `responsive-${vp.name}`, `Sort Select height ${sortBox.height}px — may not meet 44px touch target at ${vp.width}px`)
      }

      // Take screenshot at each viewport
      await page.screenshot({ path: `/tmp/design-review-courses-${vp.name}.png`, fullPage: true })
    }

    // ============================================================
    // CHECK 8: ViewModeToggle active state styling
    // ============================================================
    const activeToggleItem = viewModeToggle.locator('[data-state="on"]')
    if (await activeToggleItem.count() > 0) {
      // Check that the active state has bg-brand
      const bgBrand = await activeToggleItem.evaluate((el) => {
        const style = window.getComputedStyle(el)
        return {
          bgColor: style.backgroundColor,
          textColor: style.color,
          hasRing: style.boxShadow !== 'none' || style.outlineStyle !== 'none'
        }
      })

      // Check if the button has the data-[state=on]:bg-brand class
      const hasBrandClass = await activeToggleItem.evaluate((el) => {
        const cls = el.className
        return cls.includes('bg-brand') || cls.includes('bg-[var(--color-brand)]')
      })

      if (!hasBrandClass && bgBrand.bgColor === 'rgba(0, 0, 0, 0)') {
        addFinding('medium', 'view-toggle', 'Active view mode item does not appear to use bg-brand')
      }
    }

    // ============================================================
    // CHECK 9: Card hover effects
    // ============================================================
    const cards = page.locator('[data-testid="imported-course-card"]')
    const cardCount = await cards.count()
    if (cardCount > 0) {
      const firstCard = cards.first()

      // Check for hover classes
      const hasHoverClasses = await firstCard.evaluate((el) => {
        const cls = el.className
        return {
          hasHoverShadow: cls.includes('hover:shadow-md'),
          hasHoverScale: cls.includes('hover:scale'),
          hasTransition: cls.includes('motion-safe:transition-all')
        }
      })

      if (!hasHoverClasses.hasHoverShadow) {
        addFinding('medium', 'card-hover', 'ImportedCourseCard missing hover:shadow-md class')
      }
      if (!hasHoverClasses.hasHoverScale) {
        addFinding('low', 'card-hover', 'ImportedCourseCard missing hover:scale class')
      }

      // Check title hover color
      const titleHoverColor = await page.locator('[data-testid="course-card-title"]').first().evaluate((el) => {
        const cls = el.className
        return cls.includes('group-hover:text-brand')
      })
      if (!titleHoverColor) {
        addFinding('low', 'card-hover', 'Course card title missing group-hover:text-brand transition')
      }
    } else {
      addFinding('low', 'card-hover', 'No imported course cards found to check hover effects')
    }

    // ============================================================
    // CHECK 10: List row hover effects
    // ============================================================
    const listRows = page.locator('[data-testid="imported-course-list-row"]')
    if (await listRows.count() > 0) {
      const hasHoverBg = await listRows.first().evaluate((el) => {
        const cls = el.className
        return cls.includes('hover:bg-muted')
      })
      if (!hasHoverBg) {
        addFinding('low', 'card-hover', 'ImportedCourseListRow missing hover:bg-muted/50 transition')
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

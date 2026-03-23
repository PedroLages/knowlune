/**
 * ATDD E2E tests for E23-S05: De-Emphasize Pre-Seeded Courses
 *
 * AC1: Pre-seeded section has "Sample Courses (N)" heading, muted styling, collapsible (collapsed when imports exist)
 * AC2: Imported courses section appears first with full visual prominence
 * AC3: Overview "Your Library" de-emphasizes pre-seeded courses when imports exist
 * AC4: Overview shows pre-seeded courses at full prominence when no imports exist
 * AC5: Collapse state persists across navigations
 * AC6: Responsive layout remains correct
 */
import { test, expect } from '../support/fixtures'
import { goToCourses, goToOverview } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/seed-helpers'

const SAMPLE_IMPORTED_COURSE = {
  id: 'test-imported-course',
  name: 'My Imported Course',
  importedAt: '2026-03-20T10:00:00.000Z',
  category: 'general',
  tags: ['test'],
  status: 'active' as const,
  videoCount: 5,
  pdfCount: 0,
}

// ---------------------------------------------------------------------------
// AC1: Pre-seeded section visual de-emphasis
// ---------------------------------------------------------------------------

test.describe('AC1: Pre-seeded section de-emphasis', () => {
  test('pre-seeded section has "Sample Courses" heading', async ({ page }) => {
    await goToCourses(page)
    const heading = page.getByRole('heading', { name: /sample courses/i })
    await expect(heading).toBeVisible()
  })

  test('pre-seeded section is collapsible and collapsed by default when imports exist', async ({
    page,
  }) => {
    // Navigate first to establish origin, then seed, then navigate to target
    await goToCourses(page)
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const sampleSection = page.locator('[data-testid="sample-courses-section"]')
    await expect(sampleSection).toBeVisible()

    // Section should be collapsed — course grid should not be visible
    const courseGrid = sampleSection.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeHidden()
  })

  test('pre-seeded section is expanded by default when no imports exist', async ({ page }) => {
    await goToCourses(page)

    const courseGrid = page.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Imported courses section appears first
// ---------------------------------------------------------------------------

test.describe('AC2: Imported courses first', () => {
  test('imported courses section appears above sample courses section', async ({ page }) => {
    await goToCourses(page)
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const importedSection = page.locator('[data-testid="imported-courses-grid"]')
    const sampleSection = page.locator('[data-testid="sample-courses-section"]')

    // Both sections should exist
    await expect(importedSection).toBeVisible()
    await expect(sampleSection).toBeVisible()

    // Imported section should come before sample section in DOM
    const importedBox = await importedSection.boundingBox()
    const sampleBox = await sampleSection.boundingBox()
    expect(importedBox!.y).toBeLessThan(sampleBox!.y)
  })
})

// ---------------------------------------------------------------------------
// AC3: Overview de-emphasizes pre-seeded when imports exist
// ---------------------------------------------------------------------------

test.describe('AC3: Overview de-emphasis with imports', () => {
  test('pre-seeded courses in overview have reduced opacity when imports exist', async ({
    page,
  }) => {
    await goToOverview(page)
    await seedImportedCourses(page, [SAMPLE_IMPORTED_COURSE])
    await page.reload({ waitUntil: 'domcontentloaded' })

    const sampleCards = page.locator('[data-testid="sample-course-card"]')
    // At least one pre-seeded course card should exist
    await expect(sampleCards.first()).toBeVisible()

    // Check that sample cards have the de-emphasis class
    const firstCard = sampleCards.first()
    await expect(firstCard).toHaveCSS('opacity', '0.6')
  })
})

// ---------------------------------------------------------------------------
// AC4: Overview full prominence when no imports
// ---------------------------------------------------------------------------

test.describe('AC4: Overview full prominence without imports', () => {
  test('pre-seeded courses in overview have full opacity when no imports', async ({ page }) => {
    await goToOverview(page)

    // Pre-seeded course cards should be at full opacity
    const librarySection = page.locator('section:has(h2:text("Your Library"))')
    const courseCards = librarySection.locator('[data-testid^="course-card-"]').first()
    await expect(courseCards).toBeVisible()
    await expect(courseCards).toHaveCSS('opacity', '1')
  })
})

// ---------------------------------------------------------------------------
// AC5: Collapse state persists
// ---------------------------------------------------------------------------

test.describe('AC5: Collapse state persistence', () => {
  test('collapse state persists across page navigations', async ({ page }) => {
    await goToCourses(page)

    // Section should start expanded (no imports)
    const courseGrid = page.locator('[data-testid="sample-courses-grid"]')
    await expect(courseGrid).toBeVisible()

    // Click collapse toggle
    const toggle = page.locator('[data-testid="sample-courses-toggle"]')
    await toggle.click()

    // Grid should be hidden
    await expect(courseGrid).toBeHidden()

    // Navigate away and back
    await goToOverview(page)
    await goToCourses(page)

    // Grid should still be hidden (persisted)
    await expect(courseGrid).toBeHidden()
  })
})

// ---------------------------------------------------------------------------
// AC6: Responsive layout
// ---------------------------------------------------------------------------

test.describe('AC6: Responsive layout', () => {
  for (const viewport of [
    { width: 375, height: 812, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1440, height: 900, name: 'desktop' },
  ]) {
    test(`layout is correct at ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await goToCourses(page)

      // No horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

      // Sample courses section is visible
      const sampleSection = page.locator('[data-testid="sample-courses-section"]')
      await expect(sampleSection).toBeVisible()
    })
  }
})

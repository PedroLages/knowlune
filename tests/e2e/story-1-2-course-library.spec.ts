/**
 * Story 1.2: Display Course Library — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Responsive card grid with styling and hover states
 *   - AC2: Empty state with CTA when no imported courses
 *   - AC3: Sorting by most recently imported (newest first)
 *
 * Data seeding:
 *   - Imported courses seeded via IndexedDB fixture (Dexie 'ElearningDB')
 *   - Page reloaded after seeding to trigger Zustand store load
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../support/fixtures'
import {
  createImportedCourse,
  createImportedCourses,
} from '../support/fixtures/factories/imported-course-factory'
import { goToCourses } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to Courses, seed IndexedDB, reload to pick up data. */
async function seedAndReload(
  page: Parameters<typeof goToCourses>[0],
  indexedDB: { seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void> },
  courses: ReturnType<typeof createImportedCourse>[],
) {
  // GIVEN: Navigate first so Dexie creates the database
  await goToCourses(page)
  // Seed imported courses into IndexedDB
  await indexedDB.seedImportedCourses(courses)
  // Reload so Zustand store picks up seeded data
  await page.reload({ waitUntil: 'domcontentloaded' })
}

// ===========================================================================
// AC1: Course Cards in Responsive Grid
// ===========================================================================

test.describe('AC1: Course Card Grid Display', () => {
  const course = createImportedCourse({
    name: 'React Fundamentals',
    videoCount: 12,
    pdfCount: 3,
  })

  test('should display imported courses grid section', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: One imported course exists
    await seedAndReload(page, indexedDB, [course])

    // THEN: Imported courses grid section is visible
    await expect(
      page.getByTestId('imported-courses-grid'),
    ).toBeVisible()
  })

  test('should render imported course card with data-testid', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: One imported course exists
    await seedAndReload(page, indexedDB, [course])

    // THEN: An imported course card is rendered
    await expect(
      page.getByTestId('imported-course-card').first(),
    ).toBeVisible()
  })

  test('should display course title on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course with known title
    await seedAndReload(page, indexedDB, [course])

    // THEN: Course title is visible on the card
    await expect(
      page.getByTestId('imported-course-card').first().getByTestId('course-card-title'),
    ).toHaveText('React Fundamentals')
  })

  test('should display video count on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with 12 videos
    await seedAndReload(page, indexedDB, [course])

    // THEN: Video count is visible
    await expect(
      page.getByTestId('imported-course-card').first().getByTestId('course-card-video-count'),
    ).toContainText('12')
  })

  test('should display PDF count on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with 3 PDFs
    await seedAndReload(page, indexedDB, [course])

    // THEN: PDF count is visible
    await expect(
      page.getByTestId('imported-course-card').first().getByTestId('course-card-pdf-count'),
    ).toContainText('3')
  })

  test('should display gradient placeholder image on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course (no cover image — uses gradient placeholder)
    await seedAndReload(page, indexedDB, [course])

    // THEN: Gradient placeholder with FolderOpen icon is visible
    await expect(
      page.getByTestId('imported-course-card').first().getByTestId('course-card-placeholder'),
    ).toBeVisible()
  })

  test('should use 4-column grid layout on desktop', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Multiple imported courses on desktop viewport (1440px)
    await page.setViewportSize({ width: 1440, height: 900 })
    const courses = createImportedCourses(5)
    await seedAndReload(page, indexedDB, courses)

    // THEN: Grid has lg:grid-cols-4 applied (4 columns at desktop)
    const grid = page.getByTestId('imported-courses-grid')
    const gridClass = await grid.getAttribute('class')
    expect(gridClass).toContain('lg:grid-cols-4')
  })

  test('should use 2-column grid layout on tablet', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Multiple imported courses on tablet viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 })
    const courses = createImportedCourses(4)
    await seedAndReload(page, indexedDB, courses)

    // THEN: Grid has sm:grid-cols-2 applied (2 columns at tablet)
    const grid = page.getByTestId('imported-courses-grid')
    const gridClass = await grid.getAttribute('class')
    expect(gridClass).toContain('sm:grid-cols-2')
  })

  test('should use 1-column grid layout on mobile', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Multiple imported courses on mobile viewport (375px)
    await page.setViewportSize({ width: 375, height: 667 })
    const courses = createImportedCourses(3)
    await seedAndReload(page, indexedDB, courses)

    // THEN: Grid defaults to grid-cols-1 (single column on mobile)
    const grid = page.getByTestId('imported-courses-grid')
    const gridClass = await grid.getAttribute('class')
    expect(gridClass).toContain('grid-cols-1')
  })

  test('should apply rounded-[24px] border radius on imported course cards', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course card rendered
    await seedAndReload(page, indexedDB, [course])

    // THEN: Card has rounded-[24px] class (not rounded-3xl)
    const card = page.getByTestId('imported-course-card').first()
    const cardClass = await card.getAttribute('class')
    expect(cardClass).toContain('rounded-[24px]')
  })

  test('should use design system background color', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses page rendered with imported courses
    await seedAndReload(page, indexedDB, [course])

    // THEN: Page background matches design system (#FAF5EE)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    // #FAF5EE in RGB is approximately rgb(250, 245, 238)
    expect(bgColor).toMatch(/rgb\(250,\s*245,\s*238\)/)
  })

  test('should apply hover scale effect on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course card rendered
    await seedAndReload(page, indexedDB, [course])

    // WHEN: User hovers over the card
    const card = page.getByTestId('imported-course-card').first()
    await card.hover()

    // THEN: Card has scale transform applied (scale-[1.02])
    const transform = await card.evaluate((el) =>
      getComputedStyle(el).transform,
    )
    // scale(1.02) produces a matrix like "matrix(1.02, 0, 0, 1.02, 0, 0)"
    expect(transform).toContain('1.02')
  })

  test('should apply blue-600 title color on hover', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course card rendered
    await seedAndReload(page, indexedDB, [course])

    // WHEN: User hovers over the card
    const card = page.getByTestId('imported-course-card').first()
    await card.hover()

    // THEN: Title text color changes to blue-600
    const title = card.getByTestId('course-card-title')
    const color = await title.evaluate((el) =>
      getComputedStyle(el).color,
    )
    // blue-600 is approximately rgb(37, 99, 235) in Tailwind default palette
    expect(color).toMatch(/rgb\(37,\s*99,\s*235\)/)
  })

  test('should wrap imported course card in article element', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course card rendered
    await seedAndReload(page, indexedDB, [course])

    // THEN: Card uses semantic <article> element
    const card = page.getByTestId('imported-course-card').first()
    const tagName = await card.evaluate((el) => el.tagName.toLowerCase())
    expect(tagName).toBe('article')
  })

  test('should have aria-label on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course with known title
    await seedAndReload(page, indexedDB, [course])

    // THEN: Card has accessible aria-label containing course name
    const card = page.getByTestId('imported-course-card').first()
    const ariaLabel = await card.getAttribute('aria-label')
    expect(ariaLabel).toContain('React Fundamentals')
  })

  test('should have keyboard-focusable cards with visible focus ring', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Imported course card rendered
    await seedAndReload(page, indexedDB, [course])

    // WHEN: User tabs to the card
    const card = page.getByTestId('imported-course-card').first()
    await card.focus()

    // THEN: Focus ring is visible (focus-visible:ring-2)
    const outlineStyle = await card.evaluate((el) =>
      getComputedStyle(el).outlineStyle,
    )
    // Tailwind ring utility uses box-shadow, not outline — check either
    const boxShadow = await card.evaluate((el) =>
      getComputedStyle(el).boxShadow,
    )
    const hasFocusIndicator =
      outlineStyle !== 'none' || boxShadow !== 'none'
    expect(hasFocusIndicator).toBe(true)
  })
})

// ===========================================================================
// AC2: Empty State
// ===========================================================================

test.describe('AC2: Empty State When No Imported Courses', () => {
  test('should display empty state section when no imported courses exist', async ({
    page,
  }) => {
    // GIVEN: No imported courses in IndexedDB
    await goToCourses(page)

    // THEN: Empty state container is visible
    await expect(
      page.getByTestId('imported-courses-empty-state'),
    ).toBeVisible()
  })

  test('should show Import Your First Course CTA text', async ({
    page,
  }) => {
    // GIVEN: No imported courses
    await goToCourses(page)

    // THEN: CTA text is visible in empty state
    await expect(
      page.getByTestId('imported-courses-empty-state'),
    ).toContainText('Import Your First Course')
  })

  test('should have CTA button with proper focus indicators', async ({
    page,
  }) => {
    // GIVEN: No imported courses
    await goToCourses(page)

    // WHEN: CTA button exists and is focusable
    const cta = page.getByTestId('import-first-course-cta')
    await expect(cta).toBeVisible()

    // THEN: CTA is a button element
    const tagName = await cta.evaluate((el) => el.tagName.toLowerCase())
    expect(tagName).toBe('button')
  })

  test('should have aria-label on empty state section', async ({
    page,
  }) => {
    // GIVEN: No imported courses
    await goToCourses(page)

    // THEN: Empty state section has accessible label
    const emptyState = page.getByTestId('imported-courses-empty-state')
    const ariaLabel = await emptyState.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
  })
})

// ===========================================================================
// AC3: Sorting by Most Recently Imported
// ===========================================================================

test.describe('AC3: Sorting and Performance', () => {
  test('should display newest imported course first', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Three courses imported at different times
    const oldest = createImportedCourse({
      name: 'Oldest Course',
      importedAt: '2025-01-01T00:00:00.000Z',
    })
    const middle = createImportedCourse({
      name: 'Middle Course',
      importedAt: '2025-06-15T00:00:00.000Z',
    })
    const newest = createImportedCourse({
      name: 'Newest Course',
      importedAt: '2026-02-15T00:00:00.000Z',
    })
    // Seed in non-chronological order to verify sorting
    await seedAndReload(page, indexedDB, [middle, oldest, newest])

    // THEN: First card shows the newest course
    const firstCardTitle = page
      .getByTestId('imported-course-card')
      .first()
      .getByTestId('course-card-title')
    await expect(firstCardTitle).toHaveText('Newest Course')
  })

  test('should display second-newest course in second position', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Three courses with distinct import dates
    const oldest = createImportedCourse({
      name: 'Oldest Course',
      importedAt: '2025-01-01T00:00:00.000Z',
    })
    const middle = createImportedCourse({
      name: 'Middle Course',
      importedAt: '2025-06-15T00:00:00.000Z',
    })
    const newest = createImportedCourse({
      name: 'Newest Course',
      importedAt: '2026-02-15T00:00:00.000Z',
    })
    await seedAndReload(page, indexedDB, [middle, oldest, newest])

    // THEN: Second card shows the middle course
    const secondCardTitle = page
      .getByTestId('imported-course-card')
      .nth(1)
      .getByTestId('course-card-title')
    await expect(secondCardTitle).toHaveText('Middle Course')
  })

  test('should render 10+ courses without layout shift', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: 12 imported courses
    const courses = createImportedCourses(12, (i) => ({
      name: `Course ${String(i + 1).padStart(2, '0')}`,
      importedAt: new Date(2025, 0, i + 1).toISOString(),
    }))
    await seedAndReload(page, indexedDB, courses)

    // THEN: All 12 cards are rendered
    const cards = page.getByTestId('imported-course-card')
    await expect(cards).toHaveCount(12)
  })

  test('should maintain grid gap spacing with many courses', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Multiple imported courses
    const courses = createImportedCourses(8)
    await seedAndReload(page, indexedDB, courses)

    // THEN: Grid has gap-6 (24px) spacing between cards
    const grid = page.getByTestId('imported-courses-grid')
    const gridClass = await grid.getAttribute('class')
    expect(gridClass).toContain('gap-6')
  })
})

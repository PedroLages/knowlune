/**
 * Story 1.3: Organize Courses by Topic — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Add topic tags, persist in IndexedDB, display as badges on cards
 *   - AC2: Topic filter on Courses page — filter and clear
 *   - AC3: Edit tags (add/remove), autocomplete from previously used tags
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
  await goToCourses(page)
  await indexedDB.seedImportedCourses(courses)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

// ===========================================================================
// AC1: Tag Badges Display and Persistence
// ===========================================================================

test.describe('AC1: Topic Tags on Course Cards', () => {
  const courseWithTags = createImportedCourse({
    name: 'React Patterns',
    tags: ['react', 'typescript', 'design-patterns'],
  })

  const courseNoTags = createImportedCourse({
    name: 'Empty Tags Course',
    tags: [],
  })

  test('should display tag badges on imported course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: An imported course with tags
    await seedAndReload(page, indexedDB, [courseWithTags])

    // THEN: Tag badges container is visible on the card
    const card = page.getByTestId('imported-course-card').first()
    await expect(
      card.getByTestId('course-card-tags'),
    ).toBeVisible()
  })

  test('should render each tag as a badge', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with 3 tags
    await seedAndReload(page, indexedDB, [courseWithTags])

    // THEN: All 3 tag badges are rendered
    const card = page.getByTestId('imported-course-card').first()
    const badges = card.getByTestId('tag-badge')
    await expect(badges).toHaveCount(3)
  })

  test('should display tag text in badges', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with known tags
    await seedAndReload(page, indexedDB, [courseWithTags])

    // THEN: Badge text matches tag names
    const card = page.getByTestId('imported-course-card').first()
    await expect(card.getByTestId('tag-badge').first()).toContainText('react')
  })

  test('should not display tag section when course has no tags', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: An imported course with empty tags array
    await seedAndReload(page, indexedDB, [courseNoTags])

    // THEN: Tag container is not visible (no empty badge row)
    const card = page.getByTestId('imported-course-card').first()
    await expect(
      card.getByTestId('course-card-tags'),
    ).not.toBeVisible()
  })

  test('should persist tags after page reload', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with tags seeded in IndexedDB
    await seedAndReload(page, indexedDB, [courseWithTags])

    // WHEN: Page is reloaded
    await page.reload({ waitUntil: 'domcontentloaded' })

    // THEN: Tags still display on the card
    const card = page.getByTestId('imported-course-card').first()
    const badges = card.getByTestId('tag-badge')
    await expect(badges).toHaveCount(3)
  })

  test('should truncate with +N badge when tags exceed maxVisible', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with 5 tags (exceeds maxVisible=3)
    const manyTags = createImportedCourse({
      name: 'Many Tags Course',
      tags: ['react', 'typescript', 'design', 'testing', 'performance'],
    })
    await seedAndReload(page, indexedDB, [manyTags])

    // THEN: Overflow badge shows "+2 more" (or similar)
    const card = page.getByTestId('imported-course-card').first()
    await expect(
      card.getByTestId('tag-overflow-badge'),
    ).toBeVisible()
  })
})

// ===========================================================================
// AC2: Topic Filter on Courses Page
// ===========================================================================

test.describe('AC2: Topic Filter', () => {
  const reactCourse = createImportedCourse({
    name: 'React Fundamentals',
    tags: ['react', 'frontend'],
  })
  const typescriptCourse = createImportedCourse({
    name: 'TypeScript Deep Dive',
    tags: ['typescript', 'frontend'],
  })
  const pythonCourse = createImportedCourse({
    name: 'Python Basics',
    tags: ['python', 'backend'],
  })

  test('should display topic filter bar when tagged courses exist', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses with tags
    await seedAndReload(page, indexedDB, [reactCourse, typescriptCourse])

    // THEN: Topic filter bar is visible
    await expect(
      page.getByTestId('topic-filter-bar'),
    ).toBeVisible()
  })

  test('should show all unique tags in filter bar', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses with overlapping tags
    await seedAndReload(page, indexedDB, [reactCourse, typescriptCourse, pythonCourse])

    // THEN: Filter bar contains all unique tags
    const filterBar = page.getByTestId('topic-filter-bar')
    await expect(filterBar.getByTestId('topic-filter-button')).toHaveCount(5) // react, frontend, typescript, python, backend
  })

  test('should filter courses when topic is selected', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Three courses with different tags
    await seedAndReload(page, indexedDB, [reactCourse, typescriptCourse, pythonCourse])

    // WHEN: User clicks "react" filter
    const filterBar = page.getByTestId('topic-filter-bar')
    await filterBar.getByRole('button', { name: /react/i }).click()

    // THEN: Only React course is visible
    const cards = page.getByTestId('imported-course-card')
    await expect(cards).toHaveCount(1)
    await expect(cards.first().getByTestId('course-card-title')).toHaveText('React Fundamentals')
  })

  test('should filter with AND logic when multiple topics selected', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses with overlapping tags
    await seedAndReload(page, indexedDB, [reactCourse, typescriptCourse, pythonCourse])

    // WHEN: User selects "frontend" + "react" (AND logic)
    const filterBar = page.getByTestId('topic-filter-bar')
    await filterBar.getByRole('button', { name: /frontend/i }).click()
    await filterBar.getByRole('button', { name: /react/i }).click()

    // THEN: Only React course matches both tags
    const cards = page.getByTestId('imported-course-card')
    await expect(cards).toHaveCount(1)
    await expect(cards.first().getByTestId('course-card-title')).toHaveText('React Fundamentals')
  })

  test('should clear filters and show all courses', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Filtered to show only react courses
    await seedAndReload(page, indexedDB, [reactCourse, typescriptCourse, pythonCourse])
    const filterBar = page.getByTestId('topic-filter-bar')
    await filterBar.getByRole('button', { name: /react/i }).click()
    await expect(page.getByTestId('imported-course-card')).toHaveCount(1)

    // WHEN: User clicks "Clear filters"
    await filterBar.getByTestId('clear-topic-filters').click()

    // THEN: All courses visible again
    await expect(page.getByTestId('imported-course-card')).toHaveCount(3)
  })

  test('should indicate selected filter state with aria-pressed', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses with tags
    await seedAndReload(page, indexedDB, [reactCourse])

    // WHEN: User selects a topic filter
    const filterButton = page.getByTestId('topic-filter-bar').getByRole('button', { name: /react/i })
    await filterButton.click()

    // THEN: Button has aria-pressed="true"
    await expect(filterButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('should not display filter bar when no courses have tags', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Courses with no tags
    const untagged = createImportedCourse({ name: 'No Tags', tags: [] })
    await seedAndReload(page, indexedDB, [untagged])

    // THEN: Topic filter bar is not rendered
    await expect(
      page.getByTestId('topic-filter-bar'),
    ).not.toBeVisible()
  })
})

// ===========================================================================
// AC3: Tag Editing and Autocomplete
// ===========================================================================

test.describe('AC3: Tag Management', () => {
  const courseWithTags = createImportedCourse({
    name: 'Editable Course',
    tags: ['react', 'typescript'],
  })

  test('should show add-tag button on course card', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: An imported course
    await seedAndReload(page, indexedDB, [courseWithTags])

    // THEN: "+" add tag button is visible on the card
    const card = page.getByTestId('imported-course-card').first()
    await expect(
      card.getByTestId('add-tag-button'),
    ).toBeVisible()
  })

  test('should open tag editor popover on add-tag click', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course card visible
    await seedAndReload(page, indexedDB, [courseWithTags])

    // WHEN: User clicks add-tag button
    const card = page.getByTestId('imported-course-card').first()
    await card.getByTestId('add-tag-button').click()

    // THEN: Tag editor popover is visible
    await expect(
      page.getByTestId('tag-editor-popover'),
    ).toBeVisible()
  })

  test('should show autocomplete suggestions from existing tags', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Two courses with different tags (pool of existing tags)
    const course2 = createImportedCourse({
      name: 'Other Course',
      tags: ['python', 'backend'],
    })
    await seedAndReload(page, indexedDB, [courseWithTags, course2])

    // WHEN: User opens tag editor and starts typing
    const card = page.getByTestId('imported-course-card').first()
    await card.getByTestId('add-tag-button').click()
    const input = page.getByTestId('tag-editor-popover').getByRole('combobox')
    await input.fill('py')

    // THEN: Autocomplete suggests "python" (from other course)
    await expect(
      page.getByTestId('tag-editor-popover').getByText('python'),
    ).toBeVisible()
  })

  test('should add a new tag via autocomplete', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with existing tags, open tag editor
    const course2 = createImportedCourse({
      name: 'Source Course',
      tags: ['python'],
    })
    await seedAndReload(page, indexedDB, [courseWithTags, course2])

    const card = page.getByTestId('imported-course-card').first()
    await card.getByTestId('add-tag-button').click()

    // WHEN: User selects "python" from autocomplete
    const popover = page.getByTestId('tag-editor-popover')
    const input = popover.getByRole('combobox')
    await input.fill('py')
    await popover.getByText('python').click()

    // THEN: "python" badge appears on the card
    await expect(card.getByTestId('tag-badge').filter({ hasText: 'python' })).toBeVisible()
  })

  test('should create a new tag not in autocomplete', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with tags, open tag editor
    await seedAndReload(page, indexedDB, [courseWithTags])
    const card = page.getByTestId('imported-course-card').first()
    await card.getByTestId('add-tag-button').click()

    // WHEN: User types a brand new tag and presses Enter
    const popover = page.getByTestId('tag-editor-popover')
    const input = popover.getByRole('combobox')
    await input.fill('graphql')
    await popover.getByText(/create.*graphql/i).click()

    // THEN: New "graphql" badge appears on the card
    await expect(card.getByTestId('tag-badge').filter({ hasText: 'graphql' })).toBeVisible()
  })

  test('should remove a tag via badge remove button', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course with tags displayed
    await seedAndReload(page, indexedDB, [courseWithTags])
    const card = page.getByTestId('imported-course-card').first()

    // Verify initial state: 2 tags
    await expect(card.getByTestId('tag-badge')).toHaveCount(2)

    // WHEN: User clicks remove on "react" tag
    await card.getByRole('button', { name: /remove tag.*react/i }).click()

    // THEN: Only "typescript" tag remains
    await expect(card.getByTestId('tag-badge')).toHaveCount(1)
    await expect(card.getByTestId('tag-badge').first()).toContainText('typescript')
  })

  test('should be keyboard accessible — open with Enter', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN: Course card with add-tag button
    await seedAndReload(page, indexedDB, [courseWithTags])
    const card = page.getByTestId('imported-course-card').first()

    // WHEN: User focuses add-tag button and presses Enter
    const addButton = card.getByTestId('add-tag-button')
    await addButton.focus()
    await page.keyboard.press('Enter')

    // THEN: Tag editor popover opens
    await expect(
      page.getByTestId('tag-editor-popover'),
    ).toBeVisible()
  })
})

/**
 * Learning Path Detail page E2E tests.
 *
 * Covers:
 * - Detail page renders with seeded path data
 * - Course list within the path renders
 * - Reordering courses via keyboard (move up/down buttons)
 * - Navigation back to paths listing
 * - Not-found state for invalid path ID
 * - Empty state when path has no courses
 * - Add Course dialog
 * - Remove course from path
 * - AI-generated badge and justification UI
 */
import { test, expect } from '../../support/fixtures'
import {
  seedIndexedDBStore,
  clearLearningPath,
  seedImportedCourses,
} from '../../support/helpers/indexeddb-seed'
import { navigateAndWait } from '../../support/helpers/navigation'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let counter = 0
function uid(): string {
  counter++
  return `lpd-${counter}`
}

function createPath(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = (overrides.id as string) ?? uid()
  return {
    id,
    name: `Test Path ${id}`,
    description: 'A test learning path description.',
    createdAt: getRelativeDate(-10),
    updatedAt: FIXED_DATE,
    isAIGenerated: false,
    ...overrides,
  }
}

function createEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = (overrides.id as string) ?? uid()
  return {
    id,
    pathId: 'path-detail-test',
    courseId: uid(),
    courseType: 'imported',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

function createImportedCourseData(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const id = (overrides.id as string) ?? uid()
  return {
    id,
    name: `Course ${id}`,
    importedAt: FIXED_DATE,
    category: 'Development',
    tags: ['test'],
    status: 'active',
    videoCount: 5,
    pdfCount: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PATH_ID = 'path-detail-test'

async function seedPathWithCourses(
  page: import('@playwright/test').Page,
  options: {
    pathOverrides?: Record<string, unknown>
    courseCount?: number
    isAIGenerated?: boolean
    withJustifications?: boolean
  } = {}
) {
  const {
    pathOverrides = {},
    courseCount = 3,
    isAIGenerated = false,
    withJustifications = false,
  } = options

  const path = createPath({
    id: PATH_ID,
    name: 'Web Development Fundamentals',
    description: 'Learn web dev from scratch.',
    isAIGenerated,
    ...pathOverrides,
  })

  const courseIds = Array.from({ length: courseCount }, (_, i) => `course-${i + 1}`)

  const entries = courseIds.map((courseId, i) =>
    createEntry({
      id: `entry-${i + 1}`,
      pathId: PATH_ID,
      courseId,
      courseType: 'imported',
      position: i + 1,
      justification: withJustifications
        ? `This course should come ${i === 0 ? 'first' : `at position ${i + 1}`} because it builds on prior concepts.`
        : undefined,
    })
  )

  const courses = courseIds.map((courseId, i) =>
    createImportedCourseData({
      id: courseId,
      name: `Course ${i + 1}: ${['HTML Basics', 'CSS Styling', 'JavaScript Intro', 'React Fundamentals', 'Node.js'][i] || `Topic ${i + 1}`}`,
    })
  )

  await clearLearningPath(page)
  await seedIndexedDBStore(page, DB_NAME, 'learningPaths', [path])
  await seedIndexedDBStore(page, DB_NAME, 'learningPathEntries', entries)
  await seedImportedCourses(page, courses)
}

async function goToPathDetail(page: import('@playwright/test').Page, pathId = PATH_ID) {
  await navigateAndWait(page, `/learning-paths/${pathId}`)
}

// ---------------------------------------------------------------------------
// Detail page rendering
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — rendering', () => {
  test('displays path name as heading', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page)
    await page.reload({ waitUntil: 'load' })

    await expect(
      page.getByRole('heading', { name: 'Web Development Fundamentals', level: 1 })
    ).toBeVisible()
  })

  test('displays path description', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Learn web dev from scratch.')).toBeVisible()
  })

  test('shows AI Generated badge for AI paths', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { isAIGenerated: true })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('AI Generated')).toBeVisible()
  })

  test('does not show AI Generated badge for manual paths', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { isAIGenerated: false })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('AI Generated')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Course list rendering
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — course list', () => {
  test('renders course list with correct number of courses', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 3 })
    await page.reload({ waitUntil: 'load' })

    const courseList = page.getByTestId('path-course-list')
    await expect(courseList).toBeVisible()

    // Each course has a row with data-testid
    await expect(page.getByTestId('path-course-row-0')).toBeVisible()
    await expect(page.getByTestId('path-course-row-1')).toBeVisible()
    await expect(page.getByTestId('path-course-row-2')).toBeVisible()
  })

  test('course rows show course names', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 2 })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Course 1: HTML Basics')).toBeVisible()
    await expect(page.getByText('Course 2: CSS Styling')).toBeVisible()
  })

  test('course rows show course type badges', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 1 })
    await page.reload({ waitUntil: 'load' })

    // Imported badge on the course row
    const courseRow = page.getByTestId('path-course-row-0')
    await expect(courseRow.getByText('Imported')).toBeVisible()
  })

  test('progress summary card shows overall progress', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 2 })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Overall Progress')).toBeVisible()
    // Progress bar is present
    await expect(page.getByRole('progressbar')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Empty state (no courses)
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — empty courses', () => {
  test('shows empty state when path has no courses', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 0 })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('No courses yet')).toBeVisible()
    await expect(
      page.getByText('Add courses to build your learning path')
    ).toBeVisible()
  })

  test('empty state has Add Course button', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 0 })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByRole('button', { name: 'Add Course' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Reordering courses via keyboard buttons
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — reorder courses', () => {
  test('move-down button reorders course to next position', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 3 })
    await page.reload({ waitUntil: 'load' })

    // Initially Course 1 is at position 0
    const firstRow = page.getByTestId('path-course-row-0')
    await expect(firstRow.getByText('Course 1: HTML Basics')).toBeVisible()

    // Click move-down on the first course
    await firstRow.getByRole('button', { name: /Move.*down/i }).click()

    // Now Course 2 should be in position 0
    const newFirstRow = page.getByTestId('path-course-row-0')
    await expect(newFirstRow.getByText('Course 2: CSS Styling')).toBeVisible()
  })

  test('move-up button reorders course to previous position', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 3 })
    await page.reload({ waitUntil: 'load' })

    // Course 2 is at position 1
    const secondRow = page.getByTestId('path-course-row-1')
    await expect(secondRow.getByText('Course 2: CSS Styling')).toBeVisible()

    // Click move-up on the second course
    await secondRow.getByRole('button', { name: /Move.*up/i }).click()

    // Now Course 2 should be in position 0
    const newFirstRow = page.getByTestId('path-course-row-0')
    await expect(newFirstRow.getByText('Course 2: CSS Styling')).toBeVisible()
  })

  test('move-up is disabled for the first course', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 2 })
    await page.reload({ waitUntil: 'load' })

    const firstRow = page.getByTestId('path-course-row-0')
    await expect(firstRow.getByRole('button', { name: /Move.*up/i })).toBeDisabled()
  })

  test('move-down is disabled for the last course', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 2 })
    await page.reload({ waitUntil: 'load' })

    const lastRow = page.getByTestId('path-course-row-1')
    await expect(lastRow.getByRole('button', { name: /Move.*down/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AI justification UI
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — AI justifications', () => {
  test('AI-generated path shows "Why this order?" toggle', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { isAIGenerated: true, withJustifications: true })
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByTestId('justification-toggle-0')).toBeVisible()
    await expect(page.getByText('Why this order?').first()).toBeVisible()
  })

  test('expanding justification shows the reasoning text', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, {
      isAIGenerated: true,
      withJustifications: true,
      courseCount: 1,
    })
    await page.reload({ waitUntil: 'load' })

    // Initially justification is collapsed
    await expect(page.getByTestId('course-justification-0')).not.toBeVisible()

    // Expand
    await page.getByTestId('justification-toggle-0').click()

    // Now visible
    await expect(page.getByTestId('course-justification-0')).toBeVisible()
    await expect(page.getByTestId('course-justification-0')).toContainText(
      'because it builds on prior concepts'
    )
  })
})

// ---------------------------------------------------------------------------
// Remove course from path
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — remove course', () => {
  test('remove button removes a course from the path', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 2 })
    await page.reload({ waitUntil: 'load' })

    // Verify both courses are present
    await expect(page.getByText('Course 1: HTML Basics')).toBeVisible()
    await expect(page.getByText('Course 2: CSS Styling')).toBeVisible()

    // Remove the first course
    await page.getByTestId('remove-course-0').click()

    // First course should be gone, second course remains
    await expect(page.getByText('Course 1: HTML Basics')).not.toBeVisible()
    await expect(page.getByText('Course 2: CSS Styling')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — navigation', () => {
  test('back link navigates to learning paths list', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page)
    await page.reload({ waitUntil: 'load' })

    await page.getByRole('link', { name: 'Back to Learning Paths' }).click()

    await expect(page).toHaveURL('/learning-paths')
  })

  test('Add Course button opens the course picker dialog', async ({ page }) => {
    await goToPathDetail(page)
    await seedPathWithCourses(page, { courseCount: 1 })
    await page.reload({ waitUntil: 'load' })

    await page.getByTestId('add-course-button').click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Add Course')).toBeVisible()
    await expect(page.getByPlaceholder('Search courses...')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Not-found state
// ---------------------------------------------------------------------------

test.describe('Learning Path Detail — not found', () => {
  test('shows not-found state for invalid path ID', async ({ page }) => {
    await navigateAndWait(page, '/learning-paths/nonexistent-path-id-99999')

    await expect(page.getByText('Path not found')).toBeVisible()
    await expect(
      page.getByText('This learning path does not exist or has been deleted')
    ).toBeVisible()
  })

  test('not-found state has back link to learning paths', async ({ page }) => {
    await navigateAndWait(page, '/learning-paths/nonexistent-path-id-99999')

    await expect(page.getByRole('link', { name: 'Back to Learning Paths' })).toBeVisible()
  })

  test('not-found state has "View All Paths" action button', async ({ page }) => {
    await navigateAndWait(page, '/learning-paths/nonexistent-path-id-99999')

    await expect(page.getByRole('button', { name: 'View All Paths' })).toBeVisible()
  })
})

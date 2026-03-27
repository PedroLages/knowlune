/**
 * Learning Paths listing page E2E tests.
 *
 * Covers:
 * - Empty state when no learning paths exist
 * - Creating a new learning path via dialog
 * - Listing existing paths with seeded data
 * - Searching/filtering paths
 * - Navigating to a path detail page
 * - Renaming a path
 * - Deleting a path
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore, clearLearningPath } from '../../support/helpers/indexeddb-seed'
import { navigateAndWait } from '../../support/helpers/navigation'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let pathCounter = 0
function createLearningPath(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  pathCounter++
  const id = overrides.id ?? `lp-test-${pathCounter}`
  return {
    id,
    name: `Test Learning Path ${pathCounter}`,
    description: `Description for path ${pathCounter}`,
    createdAt: getRelativeDate(-pathCounter),
    updatedAt: FIXED_DATE,
    isAIGenerated: false,
    ...overrides,
  }
}

function createLearningPathEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  pathCounter++
  return {
    id: `lpe-test-${pathCounter}`,
    pathId: 'lp-test-1',
    courseId: `course-test-${pathCounter}`,
    courseType: 'imported',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToLearningPaths(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/learning-paths')
}

async function seedPaths(
  page: import('@playwright/test').Page,
  paths: Record<string, unknown>[],
  entries: Record<string, unknown>[] = []
) {
  await seedIndexedDBStore(page, DB_NAME, 'learningPaths', paths)
  if (entries.length > 0) {
    await seedIndexedDBStore(page, DB_NAME, 'learningPathEntries', entries)
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test.describe('Learning Paths — empty state', () => {
  test('shows empty state when no paths exist', async ({ page }) => {
    await goToLearningPaths(page)
    // Clear any existing paths
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('No learning paths yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Path' })).toBeVisible()
  })

  test('empty state "Create Path" button opens dialog', async ({ page }) => {
    await goToLearningPaths(page)
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    // The EmptyState action button
    await page.getByText('No learning paths yet').waitFor()
    // Click the Create Path button in the empty state area
    const createButtons = page.getByRole('button', { name: 'Create Path' })
    // There may be two — header and empty state. Click whichever is visible first.
    await createButtons.first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create Learning Path')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Create path via dialog
// ---------------------------------------------------------------------------

test.describe('Learning Paths — create path', () => {
  test('creates a new learning path via the dialog', async ({ page }) => {
    await goToLearningPaths(page)

    // Open create dialog from header button
    await page.getByRole('button', { name: 'Create Path' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Fill in the form
    await page.getByLabel('Name').fill('My Test Learning Path')
    await page.getByLabel(/Description/).fill('A test description')

    // Submit
    await page.getByRole('button', { name: 'Create Path' }).click()

    // Dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // New path appears in the list
    await expect(page.getByText('My Test Learning Path')).toBeVisible()
  })

  test('create button is disabled when name is empty', async ({ page }) => {
    await goToLearningPaths(page)

    await page.getByRole('button', { name: 'Create Path' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Submit button should be disabled with empty name
    const submitButton = page.getByRole('dialog').getByRole('button', { name: 'Create Path' })
    await expect(submitButton).toBeDisabled()
  })

  test('cancel closes the create dialog without creating', async ({ page }) => {
    await goToLearningPaths(page)

    await page.getByRole('button', { name: 'Create Path' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel('Name').fill('Should Not Exist')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText('Should Not Exist')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Listing paths with seeded data
// ---------------------------------------------------------------------------

test.describe('Learning Paths — list with seeded data', () => {
  test('displays seeded learning paths', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-a', name: 'Web Development Fundamentals' }),
      createLearningPath({ id: 'lp-b', name: 'Data Science Bootcamp' }),
      createLearningPath({ id: 'lp-c', name: 'DevOps Essentials' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Web Development Fundamentals')).toBeVisible()
    await expect(page.getByText('Data Science Bootcamp')).toBeVisible()
    await expect(page.getByText('DevOps Essentials')).toBeVisible()
  })

  test('path card shows course count for paths with entries', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [createLearningPath({ id: 'lp-count', name: 'Counted Path' })]
    const entries = [
      createLearningPathEntry({ pathId: 'lp-count', courseId: 'c-1', position: 1 }),
      createLearningPathEntry({ pathId: 'lp-count', courseId: 'c-2', position: 2 }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths, entries)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('2 courses')).toBeVisible()
  })

  test('path with zero courses shows "No courses added yet"', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [createLearningPath({ id: 'lp-empty', name: 'Empty Path' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('No courses added yet')).toBeVisible()
  })

  test('AI-generated path shows AI Generated badge', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-ai', name: 'AI Path', isAIGenerated: true }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('AI Generated')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------

test.describe('Learning Paths — search', () => {
  test('search input filters paths by name', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-s1', name: 'React Mastery' }),
      createLearningPath({ id: 'lp-s2', name: 'Vue Basics' }),
      createLearningPath({ id: 'lp-s3', name: 'Angular Deep Dive' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    // Type in search
    await page.getByPlaceholder('Search paths...').fill('React')

    // Only matching path should be visible
    await expect(page.getByText('React Mastery')).toBeVisible()
    await expect(page.getByText('Vue Basics')).not.toBeVisible()
    await expect(page.getByText('Angular Deep Dive')).not.toBeVisible()
  })

  test('search with no results shows empty search state', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-sr1', name: 'Some Path' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search paths...').fill('zzz-nonexistent')

    await expect(page.getByText('No paths match your search')).toBeVisible()
  })

  test('search filters by description text too', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({
        id: 'lp-desc1',
        name: 'Path Alpha',
        description: 'Learn about Kubernetes',
      }),
      createLearningPath({
        id: 'lp-desc2',
        name: 'Path Beta',
        description: 'Learn about Docker',
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search paths...').fill('Kubernetes')

    await expect(page.getByText('Path Alpha')).toBeVisible()
    await expect(page.getByText('Path Beta')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation to detail page
// ---------------------------------------------------------------------------

test.describe('Learning Paths — navigation', () => {
  test('clicking a path card navigates to its detail page', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-nav', name: 'Navigate Me' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('Navigate Me').click()

    await expect(page).toHaveURL(/\/learning-paths\/lp-nav/)
  })

  test('page heading shows "Learning Paths"', async ({ page }) => {
    await goToLearningPaths(page)

    await expect(
      page.getByRole('heading', { name: 'Learning Paths', level: 1 })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Rename path (via dropdown menu)
// ---------------------------------------------------------------------------

test.describe('Learning Paths — rename', () => {
  test('renames a path via the dropdown menu', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-rename', name: 'Old Name' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    // Hover the card to reveal the actions button
    const card = page.getByText('Old Name').locator('..').locator('..')
    await card.hover()

    // Open dropdown menu
    await page.getByRole('button', { name: /Actions for Old Name/ }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()

    // Rename dialog opens
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Rename Learning Path')).toBeVisible()

    // Clear and type new name
    const nameInput = page.getByLabel('Name')
    await nameInput.clear()
    await nameInput.fill('New Name')
    await page.getByRole('button', { name: 'Save' }).click()

    // Dialog closes and new name appears
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByText('New Name')).toBeVisible()
    await expect(page.getByText('Old Name')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Delete path
// ---------------------------------------------------------------------------

test.describe('Learning Paths — delete', () => {
  test('deletes a path via the dropdown menu', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-del1', name: 'Keep This Path' }),
      createLearningPath({ id: 'lp-del2', name: 'Delete This Path' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    // Hover the card to reveal the actions button
    const targetCard = page.getByText('Delete This Path').locator('..').locator('..')
    await targetCard.hover()

    // Open dropdown menu and click Delete
    await page.getByRole('button', { name: /Actions for Delete This Path/ }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirm deletion in alert dialog
    await expect(page.getByText('Delete Learning Path')).toBeVisible()
    await page.getByRole('button', { name: 'Delete Path' }).click()

    // Alert dialog closes and path is removed
    await expect(page.getByText('Delete This Path')).not.toBeVisible()
    // The other path still exists
    await expect(page.getByText('Keep This Path')).toBeVisible()
  })

  test('cancel in delete confirmation keeps the path', async ({ page }) => {
    await goToLearningPaths(page)

    const paths = [
      createLearningPath({ id: 'lp-delc', name: 'Cancel Delete Path' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    const targetCard = page.getByText('Cancel Delete Path').locator('..').locator('..')
    await targetCard.hover()

    await page.getByRole('button', { name: /Actions for Cancel Delete Path/ }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    await expect(page.getByText('Delete Learning Path')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Path still exists
    await expect(page.getByText('Cancel Delete Path')).toBeVisible()
  })
})

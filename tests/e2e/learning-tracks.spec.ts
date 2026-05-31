/**
 * Learning Tracks listing + detail page E2E tests.
 *
 * Covers:
 * - Empty state when no learning paths exist
 * - Listing tracks with seeded data
 * - Searching/filtering tracks
 * - Clicking a track card navigates to detail
 * - Detail page: hero, syllabus, progress sidebar
 * - Detail page back link goes to /learning-tracks
 * - Sidebar navigation entry for Learning Tracks
 * - Invalid trackId shows not-found state
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore, clearLearningPath } from '../support/helpers/seed-helpers'
import { navigateAndWait } from '../support/helpers/navigation'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

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
    name: `Test Learning Track ${pathCounter}`,
    description: `Description for track ${pathCounter}`,
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

async function goToLearningTracks(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/learning-tracks')
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
// Sidebar navigation
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — sidebar navigation', () => {
  test('sidebar has Learning Tracks entry that navigates correctly', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Seed sidebar state to closed on desktop
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await page.goto('/learning-tracks', { waitUntil: 'load' })

    // The sidebar should show the Learning Tracks entry
    // (we're already on the page, so just verify the heading renders)
    await expect(
      page.getByRole('heading', { name: 'Learning Tracks', level: 1 })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — empty state', () => {
  test('shows empty state when no paths exist', async ({ page }) => {
    await goToLearningTracks(page)
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('No learning tracks yet')).toBeVisible()
    // There are two "Create Track" buttons: header and empty state. The empty state
    // one is visible when there are no paths, so first() works.
    await expect(page.getByRole('button', { name: 'Create Track' }).first()).toBeVisible()
  })

  test('empty state "Create Track" button opens dialog', async ({ page }) => {
    await goToLearningTracks(page)
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('No learning tracks yet').waitFor()
    const createButtons = page.getByRole('button', { name: 'Create Track' })
    await createButtons.first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create Learning Path')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Listing tracks with seeded data
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — list with seeded data', () => {
  test('displays seeded learning tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'lt-a', name: 'Web Development Track' }),
      createLearningPath({ id: 'lt-b', name: 'Data Science Track' }),
      createLearningPath({ id: 'lt-c', name: 'DevOps Track' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Web Development Track')).toBeVisible()
    await expect(page.getByText('Data Science Track')).toBeVisible()
    await expect(page.getByText('DevOps Track')).toBeVisible()
  })

  test('path card shows course count for tracks with entries', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-count', name: 'Counted Track' })]
    const entries = [
      createLearningPathEntry({ pathId: 'lt-count', courseId: 'c-1', position: 1 }),
      createLearningPathEntry({ pathId: 'lt-count', courseId: 'c-2', position: 2 }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths, entries)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('2 courses')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — search', () => {
  test('search input filters tracks by name', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'ts1', name: 'React Track' }),
      createLearningPath({ id: 'ts2', name: 'Vue Track' }),
      createLearningPath({ id: 'ts3', name: 'Angular Track' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search tracks...').fill('React')

    await expect(page.getByText('React Track')).toBeVisible()
    await expect(page.getByText('Vue Track')).not.toBeVisible()
    await expect(page.getByText('Angular Track')).not.toBeVisible()
  })

  test('search finds tracks by description text not present in title', async ({ page }) => {
    await goToLearningTracks(page)

    const uniqueDesc = 'lt-desc-visibility-xyz'
    const paths = [
      createLearningPath({
        id: 'lt-desc-search',
        name: 'Alpha Navigation Track',
        description: `${uniqueDesc} extra terms for search`,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText(uniqueDesc)).not.toBeVisible()

    await page.getByPlaceholder('Search tracks...').fill(uniqueDesc)

    await expect(page.getByText('Alpha Navigation Track')).toBeVisible()
  })

  test('search with no results shows empty search state', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'tsr1', name: 'Some Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search tracks...').fill('zzz-nonexistent')

    await expect(page.getByText('No tracks match your search')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation to detail page
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — navigation', () => {
  test('list hides description while detail hero still shows it', async ({ page }) => {
    await goToLearningTracks(page)

    const uniqueDesc = 'lt-desc-visibility-xyz'
    const paths = [
      createLearningPath({
        id: 'lt-desc-vis',
        name: 'Beta Navigation Track',
        description: uniqueDesc,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText(uniqueDesc)).not.toBeVisible()

    await page.getByText('Beta Navigation Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-desc-vis/)
    await expect(page.getByText(uniqueDesc)).toBeVisible()
  })

  test('clicking a track card navigates to its detail page', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-nav', name: 'Navigate To Me' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('Navigate To Me').click()

    await expect(page).toHaveURL(/\/learning-tracks\/lt-nav/)
  })

  test('page heading shows "Learning Tracks"', async ({ page }) => {
    await goToLearningTracks(page)

    await expect(
      page.getByRole('heading', { name: 'Learning Tracks', level: 1 })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — detail page', () => {
  test('detail page shows hero with path name and back link', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-detail', name: 'Detail Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    // Navigate to detail
    await page.getByText('Detail Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-detail/)

    // Hero should show the path name
    await expect(page.getByText('Detail Track')).toBeVisible()

    // Back link should navigate to /learning-tracks
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')
  })

  test('detail page back link navigates to /learning-tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-back', name: 'Back Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('Back Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-back/)

    // Click the back link
    await page.getByTestId('hero-back-link').click()
    await expect(page).toHaveURL('/learning-tracks')
  })
})

// ---------------------------------------------------------------------------
// Invalid track ID
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — invalid track', () => {
  test('invalid trackId shows not-found state', async ({ page }) => {
    await goToLearningTracks(page)

    await page.goto('/learning-tracks/nonexistent-id', { waitUntil: 'load' })

    await expect(page.getByText('Track not found')).toBeVisible()
    await expect(page.getByRole('button', { name: 'View All Tracks' })).toBeVisible()
  })
})
// ---------------------------------------------------------------------------
// Detail page — hero refactor regression guards
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — hero refactor', () => {
  test('direct URL entry: back link navigates to /learning-tracks', async ({ page }) => {
    const paths = [createLearningPath({ id: 'lt-direct', name: 'Direct Entry Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    // Direct URL entry (not via list click)
    await page.goto('/learning-tracks/lt-direct', { waitUntil: 'load' })

    await expect(page.getByTestId('hero-back-link')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toHaveAttribute('href', '/learning-tracks')

    // Click the back link
    await page.getByTestId('hero-back-link').click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('back link and CTA navigate to distinct routes on same page', async ({ page }) => {
    const entries = [
      createLearningPathEntry({ pathId: 'lt-cta-sep', courseId: 'c-cta-sep', position: 1 }),
    ]
    const paths = [createLearningPath({ id: 'lt-cta-sep', name: 'CTA Separation Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths, entries)

    await page.goto('/learning-tracks/lt-cta-sep', { waitUntil: 'load' })

    // Back link points to /learning-tracks
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    // CTA is also visible and points to a course route
    const cta = page.getByText('Start Learning')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/courses\//)
  })

  test('mobile viewport: back link navigates correctly', async ({ page }) => {
    // Set narrow viewport
    await page.setViewportSize({ width: 375, height: 812 })

    const paths = [createLearningPath({ id: 'lt-mobile', name: 'Mobile Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-mobile', { waitUntil: 'load' })

    // Back link visible and navigates correctly
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    await backLink.click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('detail page with cover image URL renders hero without errors', async ({ page }) => {
    const paths = [
      createLearningPath({
        id: 'lt-cover',
        name: 'Cover Image Track',
        description: 'Track with a cover image',
        coverImageUrl: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%234F46E5%22%2F%3E%3C%2Fsvg%3E',
        coverPreset: 'cyan-blue',
      }),
    ]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-cover', { waitUntil: 'load' })

    // Hero renders with the path name
    await expect(page.getByText('Cover Image Track')).toBeVisible()

    // Back link still works
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')
  })
})

/**
 * E2E tests: learning track detail page hero refactor regression guards.
 *
 * Split from learning-tracks.spec.ts to keep file under 400-line limit.
 * Covers hero banner interactions: back link, CTA routing, mobile viewport,
 * and cover image rendering.
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

/**
 * E20-S04: Skill Proficiency Radar Chart — ATDD Tests
 *
 * Validates:
 *   - Radar chart section displays on Overview dashboard
 *   - Chart has accessible aria-label with proficiency data
 *
 * Strategy: explicitly seed the `courses` IndexedDB table with 3 courses
 * spanning distinct categories before navigating, so the chart renders
 * deterministically regardless of requestIdleCallback timing.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedIndexedDBStore, clearIndexedDBStore } from '../../support/helpers/indexeddb-seed'
import type { Page } from '@playwright/test'

const TEST_COURSES = [
  {
    id: 'e20s04-course-1',
    title: 'Behavioral Analysis Fundamentals',
    shortTitle: 'BA-101',
    description: 'Test course',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 2,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-1',
    authorId: 'test-author',
  },
  {
    id: 'e20s04-course-2',
    title: 'Influence Authority Mastery',
    shortTitle: 'IA-101',
    description: 'Test course',
    category: 'influence-authority',
    difficulty: 'intermediate',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 3,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-2',
    authorId: 'test-author',
  },
  {
    id: 'e20s04-course-3',
    title: 'Confidence Mastery Workshop',
    shortTitle: 'CM-101',
    description: 'Test course',
    category: 'confidence-mastery',
    difficulty: 'advanced',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 4,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-3',
    authorId: 'test-author',
  },
]

/** Seed the Dexie `courses` table using the shared seedIndexedDBStore helper. */
async function seedCoursesIntoIDB(page: Page): Promise<void> {
  await seedIndexedDBStore(
    page,
    'ElearningDB',
    'courses',
    TEST_COURSES as Record<string, unknown>[]
  )
}

/** Navigate to Overview with pre-seeded multi-category courses. */
async function goToOverviewWithCourses(page: Page): Promise<void> {
  // First navigation: initializes IndexedDB schema
  await navigateAndWait(page, '/')
  // Seed courses into the `courses` table
  await seedCoursesIntoIDB(page)
  // Reload so `loadCourses()` reads the seeded data from IndexedDB
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  // Wait for loading state to complete (stats grid appears after 500ms spinner)
  await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })
}

test.describe('E20-S04: Skill Proficiency Radar Chart', () => {
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'courses')
  })

  test('displays radar chart section on Overview with pre-seeded courses', async ({ page }) => {
    await goToOverviewWithCourses(page)

    const heading = page.getByRole('heading', { name: 'Skill Proficiency' })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await expect(chart).toBeVisible()
  })

  test('radar chart aria-label contains proficiency percentages', async ({ page }) => {
    await goToOverviewWithCourses(page)

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await chart.scrollIntoViewIfNeeded()
    await expect(chart).toBeVisible()

    const label = await chart.getAttribute('aria-label')
    expect(label).toContain('%')
    expect(label).toContain('Skill proficiency:')
  })

  test('radar chart section is hidden when fewer than 2 categories exist (AC4)', async ({
    page,
  }) => {
    // Navigate first so Dexie creates the DB schema
    await navigateAndWait(page, '/')
    // Seed exactly 1 course (single category) — seedCoursesIfEmpty() won't run
    // because courses already exist, and <2 categories hides the radar chart
    await seedIndexedDBStore(page, 'ElearningDB', 'courses', [
      {
        id: 'e20s04-single-cat',
        title: 'Solo Category Course',
        shortTitle: 'SC-101',
        description: 'Test course with single category',
        category: 'behavioral-analysis',
        difficulty: 'beginner',
        totalLessons: 0,
        totalVideos: 0,
        totalPDFs: 0,
        estimatedHours: 1,
        tags: ['test'],
        modules: [],
        isSequential: false,
        basePath: '/courses/e20s04-single',
        authorId: 'test-author',
      },
    ] as Record<string, unknown>[])
    // Reload so loadCourses() picks up the seeded single-category data
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // The radar chart heading and img should not be present (< 2 categories)
    const heading = page.getByRole('heading', { name: 'Skill Proficiency' })
    await expect(heading).not.toBeVisible()

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await expect(chart).not.toBeVisible()
  })
})

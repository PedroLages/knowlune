/**
 * E2E tests: learning path detail page hero redesign.
 *
 * Verifies the new hero banner and progress sidebar render correctly
 * after the visual restructuring.
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

test.describe('Learning Path Detail — Hero Redesign', () => {
  const pathId = 'e2e-hero-path-1'
  const course1Id = 'e2e-hero-course-1'
  const course2Id = 'e2e-hero-course-2'

  test.beforeEach(async ({ page, indexedDB }) => {
    // Navigate first so Dexie creates the stores
    await page.goto('/')
    await page.waitForLoadState('load')

    // Seed imported courses referenced by the path entries
    await indexedDB.seedImportedCourses([
      {
        id: course1Id,
        name: 'React Fundamentals',
        authorName: 'Jane Doe',
        description: 'Learn the basics of React',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: course2Id,
        name: 'Advanced TypeScript',
        authorName: 'John Smith',
        description: 'Deep dive into TypeScript',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])

    // Seed learning path
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: pathId,
        name: 'Full-Stack Developer Path',
        description: 'A comprehensive path from frontend basics to full-stack mastery.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        difficultyLabel: 'Intermediate',
        estimatedHours: 40,
      },
    ])

    // Seed learning path entries
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPathEntries', [
      {
        id: 'e2e-hero-entry-1',
        pathId,
        courseId: course1Id,
        courseType: 'imported',
        position: 1,
        isManuallyOrdered: false,
      },
      {
        id: 'e2e-hero-entry-2',
        pathId,
        courseId: course2Id,
        courseType: 'imported',
        position: 2,
        isManuallyOrdered: false,
      },
    ])

    await page.reload()
    await page.waitForLoadState('load')
  })

  test('hero banner renders with title, description, and metadata', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    // Hero title
    await expect(page.getByRole('heading', { name: 'Full-Stack Developer Path' })).toBeVisible()

    // Hero description
    await expect(page.getByText('A comprehensive path from frontend basics to full-stack mastery.')).toBeVisible()

    // Difficulty badge
    await expect(page.getByText('Intermediate')).toBeVisible()

    // Course count in metadata
    await expect(page.getByText(/2 courses/)).toBeVisible()
  })

  test('hero back link navigates to learning paths listing', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    const backLink = page.getByText('Back to Learning Paths')
    await expect(backLink).toBeVisible()
    await backLink.click()

    await expect(page).toHaveURL(/\/learning-paths/)
  })

  test('hero CTA links to first course when not started', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    const cta = page.getByText('Start Learning')
    await expect(cta).toBeVisible()

    // Click the CTA and verify navigation to the course page
    await cta.click()
    await expect(page).toHaveURL(new RegExp(`/courses/${course1Id}`))
  })

  test('progress sidebar renders with ring and stats', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    // Progress ring
    const progressbar = page.getByRole('progressbar')
    await expect(progressbar).toBeVisible()
    await expect(progressbar).toHaveAttribute('aria-valuenow', '0')

    // Stats
    await expect(page.getByText('Modules Completed')).toBeVisible()
    await expect(page.getByText('Estimated Time Left')).toBeVisible()

    // Certificate card
    await expect(page.getByText('Earn a Certificate')).toBeVisible()
  })

  test('certificate card renders in sidebar', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    await expect(page.getByText('Earn a Certificate')).toBeVisible()
    await expect(page.getByText(/Complete all modules/)).toBeVisible()
  })

  test('template banner shows for forked paths', async ({ page }) => {
    // Seed a forked path
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: 'e2e-forked-path',
        name: 'Forked Path',
        description: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        forkedFrom: 'template-1',
      },
    ])
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPathEntries', [])
    await page.reload()

    await page.goto('/learning-paths/e2e-forked-path')
    await page.waitForLoadState('load')

    await expect(page.getByText('This path was created from a template')).toBeVisible()
  })

  test('dropdown menu appears in hero when path has actions', async ({ page }) => {
    await page.goto(`/learning-paths/${pathId}`)
    await page.waitForLoadState('load')

    const actionsBtn = page.getByLabel('Actions for Full-Stack Developer Path')
    await expect(actionsBtn).toBeVisible()
    await actionsBtn.click()

    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  })
})

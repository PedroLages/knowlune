/**
 * E2E tests: learning track detail page hero.
 *
 * Verifies the hero banner renders correctly after the visual restructuring.
 * Note: This file was migrated from `/learning-paths/` to `/learning-tracks/`
 * route namespace. Legacy tests now live in learning-tracks.spec.ts.
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

test.describe('Learning Track Detail — Hero Redesign', () => {
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

    // Seed learning track
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
    await page.goto(`/learning-tracks/${pathId}`)
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

  test('hero back link navigates to learning tracks listing', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    const backLink = page.getByText('Back to Learning Tracks')
    await expect(backLink).toBeVisible()
    await backLink.click()

    await expect(page).toHaveURL('/learning-tracks')
  })

  test('hero CTA links to first course when not started', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    const cta = page.getByText('Start Learning')
    await expect(cta).toBeVisible()

    // Click the CTA and verify navigation to the course page
    await cta.click()
    await expect(page).toHaveURL(new RegExp(`/courses/${course1Id}`))
  })

  test('progress sidebar renders with ring and stats', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
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
    await page.goto(`/learning-tracks/${pathId}`)
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

    await page.goto('/learning-tracks/e2e-forked-path')
    await page.waitForLoadState('load')

    await expect(page.getByText('This path was created from a template')).toBeVisible()
  })

  test('dropdown menu appears in hero when path has actions', async ({ page }) => {
    await page.goto(`/learning-tracks/${pathId}`)
    await page.waitForLoadState('load')

    const actionsBtn = page.getByLabel('Actions for Full-Stack Developer Path')
    await expect(actionsBtn).toBeVisible()
    await actionsBtn.click()

    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  })
})

test.describe('Learning Track Detail — Progression Mode', () => {
  const freePathId = 'e2e-free-path-1'
  const seqPathId = 'e2e-seq-path-1'
  const freeCourse1Id = 'e2e-prog-course-1'
  const freeCourse2Id = 'e2e-prog-course-2'

  test.beforeEach(async ({ page, indexedDB }) => {
    await page.goto('/')
    await page.waitForLoadState('load')

    // Seed courses
    await indexedDB.seedImportedCourses([
      {
        id: freeCourse1Id,
        name: 'Free Mode Course 1',
        authorName: 'Alice',
        description: 'First course in free mode test',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: freeCourse2Id,
        name: 'Free Mode Course 2',
        authorName: 'Bob',
        description: 'Second course in free mode test',
        type: 'imported',
        thumbnailUrl: '',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])

    // Seed entries (shared across paths)
    const entries = [
      {
        id: 'e2e-prog-entry-1',
        pathId: freePathId,
        courseId: freeCourse1Id,
        courseType: 'imported' as const,
        position: 1,
        isManuallyOrdered: false,
      },
      {
        id: 'e2e-prog-entry-2',
        pathId: freePathId,
        courseId: freeCourse2Id,
        courseType: 'imported' as const,
        position: 2,
        isManuallyOrdered: false,
      },
    ]

    await seedIndexedDBStore(page, 'ElearningDB', 'learningPathEntries', entries)
  })

  test('syllabus courses show Start Module when path is in free mode', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: freePathId,
        name: 'Free Access Path',
        description: 'A path with free access enabled by default.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        progressionMode: 'free',
      },
    ])

    await page.reload()
    await page.goto(`/learning-tracks/${freePathId}`)
    await page.waitForLoadState('load')

    // Both courses should show the "Start Module" CTA button (not locked)
    await expect(page.getByText('Start Module').first()).toBeVisible()
    // The "Locked" badge should not appear
    await expect(page.getByText('Locked')).toHaveCount(0)
    // "Available" badge should appear for courses in free mode
    await expect(page.getByText('Available')).toHaveCount(2)
  })

  test('toggling free access off locks non-completed courses', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: freePathId,
        name: 'Free Access Path',
        description: 'A path with free access enabled by default.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        progressionMode: 'free',
      },
    ])

    await page.reload()
    await page.goto(`/learning-tracks/${freePathId}`)
    await page.waitForLoadState('load')

    // Verify free mode state initially — Start Module buttons visible
    await expect(page.getByText('Start Module').first()).toBeVisible()

    // Toggle free access OFF in the syllabus header
    const syllabusToggle = page.locator('#progression-mode-toggle').first()
    await syllabusToggle.click()

    // Now "Locked" badges should appear for course 2 (not course 1, which is Up Next in sequential)
    // Course 2 should be locked since course 1 is not completed
    await expect(page.getByText('Locked')).toBeVisible()
    // Start Module may still appear for first course (it's "Up Next")
  })

  test('toggling free access back on unlocks all courses', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: freePathId,
        name: 'Free Access Path',
        description: 'A path with free access enabled by default.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        progressionMode: 'free',
      },
    ])

    await page.reload()
    await page.goto(`/learning-tracks/${freePathId}`)
    await page.waitForLoadState('load')

    const syllabusToggle = page.locator('#progression-mode-toggle').first()

    // Toggle off → locked
    await syllabusToggle.click()
    await expect(page.getByText('Locked')).toBeVisible()

    // Toggle back on → unlocked
    await syllabusToggle.click()
    await expect(page.getByText('Locked')).toHaveCount(0)
    await expect(page.getByText('Available')).toHaveCount(2)
  })

  test('sidebar and syllabus toggle reflect the same state', async ({ page }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: freePathId,
        name: 'Free Access Path',
        description: 'A path with free access enabled by default.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        progressionMode: 'free',
      },
    ])

    await page.reload()
    await page.goto(`/learning-tracks/${freePathId}`)
    await page.waitForLoadState('load')

    // Both toggles should exist (one in syllabus header, one in sidebar)
    const toggles = page.locator('#progression-mode-toggle')
    await expect(toggles).toHaveCount(2)

    // Both should start checked (free mode)
    await expect(toggles.first()).toBeChecked()
    await expect(toggles.last()).toBeChecked()

    // Toggle via the syllabus header
    await toggles.first().click()

    // Both should now be unchecked
    await expect(toggles.first()).not.toBeChecked()
    await expect(toggles.last()).not.toBeChecked()

    // Toggle back via the sidebar
    await toggles.last().click()

    // Both should be checked again
    await expect(toggles.first()).toBeChecked()
    await expect(toggles.last()).toBeChecked()
  })

  test('existing sequential path shows locked courses without migration', async ({ page }) => {
    // Simulate a path created before the default changed to 'free'
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', [
      {
        id: seqPathId,
        name: 'Legacy Sequential Path',
        description: 'Path created before free-by-default launch.',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        isAIGenerated: false,
        // No progressionMode — legacy path, defaults to sequential
      },
    ])

    // Create separate entries for the sequential path
    const seqEntries = [
      {
        id: 'e2e-seq-entry-1',
        pathId: seqPathId,
        courseId: freeCourse1Id,
        courseType: 'imported' as const,
        position: 1,
        isManuallyOrdered: false,
      },
      {
        id: 'e2e-seq-entry-2',
        pathId: seqPathId,
        courseId: freeCourse2Id,
        courseType: 'imported' as const,
        position: 2,
        isManuallyOrdered: false,
      },
    ]
    await seedIndexedDBStore(page, 'ElearningDB', 'learningPathEntries', seqEntries)

    await page.reload()
    await page.goto(`/learning-tracks/${seqPathId}`)
    await page.waitForLoadState('load')

    // Course 1 should be "Up Next" (first course, always available)
    // Course 2 should show "Locked"
    await expect(page.getByText('Locked')).toBeVisible()

    // The syllabus toggle should be unchecked (sequential mode)
    const syllabusToggle = page.locator('#progression-mode-toggle').first()
    await expect(syllabusToggle).not.toBeChecked()
  })
})

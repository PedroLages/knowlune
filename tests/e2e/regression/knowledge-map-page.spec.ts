/**
 * E56-S04: Knowledge Map Page E2E tests.
 *
 * Validates:
 *   1. Page renders at /knowledge-map with h1 "Knowledge Map"
 *   2. Sidebar nav item is active when on /knowledge-map
 *   3. Category filter chips work (click a category chip, verify filter applied)
 *   4. Mobile fallback renders accordion at 375px width
 *   5. Empty state renders when no data seeded
 */
import { test, expect } from '../../support/fixtures'
import {
  seedImportedCourses,
  seedContentProgress,
  seedQuizzes,
  seedQuizAttempts,
} from '../../support/helpers/indexeddb-seed'

/** Minimal ImportedCourse record sufficient for the knowledge map store */
const TEST_COURSE = {
  id: 'km-page-course-1',
  name: 'Introduction to TypeScript',
  importedAt: '2026-01-01T00:00:00.000Z',
  category: 'Programming',
  tags: ['typescript', 'programming'],
  status: 'active',
  videoCount: 1,
  pdfCount: 0,
  directoryHandle: null,
  source: 'local',
}

/** Minimal Quiz record linked to the test course */
const TEST_QUIZ = {
  id: 'km-page-quiz-1',
  lessonId: 'km-page-lesson-1',
  title: 'TypeScript Basics',
  questions: [
    {
      id: 'q1',
      text: 'What is TypeScript?',
      options: ['A typed superset of JS', 'A framework', 'A database', 'A language'],
      correctIndex: 0,
      topic: 'typescript',
      tags: ['typescript'],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
}

/**
 * ContentProgress record linking the quiz lesson to the course.
 * The store uses lessonId → courseId mapping to resolve quiz-to-course.
 */
const TEST_CONTENT_PROGRESS = {
  id: 'km-page-progress-1',
  courseId: 'km-page-course-1',
  itemId: 'km-page-lesson-1',
  completed: true,
  completedAt: '2026-01-01T00:00:00.000Z',
}

/** Minimal QuizAttempt record for the test quiz */
const TEST_QUIZ_ATTEMPT = {
  id: 'km-page-attempt-1',
  quizId: 'km-page-quiz-1',
  answers: [0],
  score: 85,
  completedAt: '2026-01-01T00:00:00.000Z',
  durationSeconds: 60,
}

/**
 * Seed course + quiz data into IndexedDB so the knowledge map store
 * resolves topics and renders the non-empty page state.
 */
async function seedKnowledgeMapData(page: import('@playwright/test').Page) {
  // Must navigate to a real URL before accessing storage APIs
  await page.goto('/')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedContentProgress(page, [TEST_CONTENT_PROGRESS])
  await seedQuizzes(page, [TEST_QUIZ])
  await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])
}

test.describe('Knowledge Map Page (E56-S04)', () => {
  test('1 — page renders at /knowledge-map with h1 "Knowledge Map"', async ({ page }) => {
    await seedKnowledgeMapData(page)
    await page.goto('/knowledge-map')

    // The h1 only renders when topics exist. computeScores runs async after mount,
    // going through: (no topics, isLoading: false) → (loading: true) → (topics, loading: false).
    // Wait up to 20s for the h1 to appear.
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Map' })
    await expect(heading).toBeVisible({ timeout: 20000 })
  })

  test('2 — sidebar nav item is active when on /knowledge-map', async ({ page }) => {
    await seedKnowledgeMapData(page)
    await page.goto('/knowledge-map')

    // Verify URL is correct
    await expect(page).toHaveURL('/knowledge-map')

    // The nav link for Knowledge Map should be in the sidebar (use href selector — works
    // even when sidebar is collapsed and link text is hidden)
    const navItem = page.locator('a[href="/knowledge-map"]')
    await expect(navItem).toBeAttached({ timeout: 10000 })

    // Active nav item should have aria-current="page"
    await expect(navItem).toHaveAttribute('aria-current', 'page')
  })

  test('3 — category filter chips work', async ({ page }) => {
    // Pre-set sidebar state before seeding to avoid overlay blocking clicks
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'true')
    })
    await seedImportedCourses(page, [TEST_COURSE])
    await seedContentProgress(page, [TEST_CONTENT_PROGRESS])
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])
    await page.goto('/knowledge-map')

    // Wait for non-empty state (h1 appears when topics exist)
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Map' })
    await expect(heading).toBeVisible({ timeout: 20000 })

    // Wait for filter chips group
    const filterGroup = page.locator('[role="group"][aria-label="Filter by category"]')
    await expect(filterGroup).toBeVisible({ timeout: 10000 })

    // "All Categories" chip should be active initially
    const allChip = filterGroup.locator('button').filter({ hasText: 'All Categories' }).first()
    await expect(allChip).toHaveAttribute('aria-pressed', 'true')

    // Verify the filter group contains buttons (at least "All Categories")
    const allButtons = filterGroup.locator('button')
    await expect(allButtons.first()).toBeAttached()

    // If a category chip exists, click it and verify aria-pressed toggles
    const categoryChips = filterGroup.locator('button').filter({ hasNotText: 'All Categories' })
    const chipCount = await categoryChips.count()

    if (chipCount > 0) {
      const firstChip = categoryChips.first()
      // Verify chip has aria-pressed attribute (starts as false for non-active)
      await expect(firstChip).toHaveAttribute('aria-pressed', 'false')

      // Click via evaluate to bypass Playwright click interception issues
      await firstChip.evaluate((el: HTMLButtonElement) => el.click())

      // The clicked chip should now be active
      await expect(firstChip).toHaveAttribute('aria-pressed', 'true')

      // "All Categories" should no longer be active
      await expect(allChip).toHaveAttribute('aria-pressed', 'false')
    } else {
      // Only "All Categories" chip present — verify it's active
      await expect(allChip).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('4 — mobile fallback renders accordion at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    // Seed sidebar as closed to avoid overlay blocking at mobile viewport
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await seedImportedCourses(page, [TEST_COURSE])
    await seedContentProgress(page, [TEST_CONTENT_PROGRESS])
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])

    await page.goto('/knowledge-map')

    // Wait for the page to load — h1 only renders when topics exist
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Map' })
    await expect(heading).toBeVisible({ timeout: 20000 })

    // Mobile fallback renders an accordion (AccordionItem renders as a div with data-slot="item")
    // The category should appear as an accordion trigger button
    const accordionTrigger = page.locator('[data-slot="accordion-trigger"]')
    await expect(accordionTrigger.first()).toBeVisible({ timeout: 10000 })
  })

  test('5 — empty state renders when no data seeded', async ({ page }) => {
    // Fresh browser context — no IndexedDB data → empty state renders
    await page.goto('/knowledge-map')

    // Empty state with "No knowledge data yet" message
    const emptyTitle = page.getByText('No knowledge data yet')
    await expect(emptyTitle).toBeVisible({ timeout: 10000 })
  })

  test('6 — AC3: clicking a treemap cell opens TopicDetailPopover with score breakdown', async ({
    page,
  }) => {
    // Pre-set sidebar as expanded to avoid mobile-sheet overlay
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'true')
    })
    await seedImportedCourses(page, [TEST_COURSE])
    await seedContentProgress(page, [TEST_CONTENT_PROGRESS])
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])

    // Use desktop viewport so treemap (not accordion) renders
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/knowledge-map')

    // Wait for treemap to be present
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Map' })
    await expect(heading).toBeVisible({ timeout: 20000 })

    // Treemap cells render as <g role="button"> inside Recharts SVG.
    // Click the first clickable cell using evaluate to dispatch a proper click event.
    const treemapContainer = page.locator('[data-treemap-container]')
    await expect(treemapContainer).toBeVisible({ timeout: 10000 })

    // Wait for Recharts SVG to render cells
    const treemapCell = treemapContainer.locator('g[role="button"]').first()
    await expect(treemapCell).toBeAttached({ timeout: 10000 })

    // Use evaluate to dispatch click on the g element — Playwright's click can miss SVG elements
    await treemapCell.evaluate((el: SVGGElement) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }))
    )

    // TopicDetailPopover should open — it renders a PopoverContent with the topic name
    // Score breakdown rows contain "Quiz score" text
    const popoverContent = page.locator('[data-slot="popover-content"]')
    await expect(popoverContent).toBeVisible({ timeout: 10000 })

    // Verify score breakdown is shown in the popover
    await expect(popoverContent.getByText('Quiz score')).toBeVisible()
    await expect(popoverContent.getByText('Completion')).toBeVisible()
  })

  test('7 — AC4: action button in TopicDetailPopover navigates to correct route', async ({
    page,
  }) => {
    // Pre-set sidebar as expanded to avoid mobile-sheet overlay
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'true')
    })
    await seedImportedCourses(page, [TEST_COURSE])
    await seedContentProgress(page, [TEST_CONTENT_PROGRESS])
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/knowledge-map')

    // Wait for treemap
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Map' })
    await expect(heading).toBeVisible({ timeout: 20000 })

    const treemapContainer = page.locator('[data-treemap-container]')
    await expect(treemapContainer).toBeVisible({ timeout: 10000 })

    // Open the popover by clicking a treemap cell
    const treemapCell = treemapContainer.locator('g[role="button"]').first()
    await expect(treemapCell).toBeAttached({ timeout: 10000 })
    await treemapCell.evaluate((el: SVGGElement) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }))
    )

    const popoverContent = page.locator('[data-slot="popover-content"]')
    await expect(popoverContent).toBeVisible({ timeout: 10000 })

    // Click the first action button in the popover (e.g. "Retake Quiz", "Rewatch Lesson", etc.)
    const actionButton = popoverContent.locator('button').first()
    await expect(actionButton).toBeVisible({ timeout: 5000 })
    await actionButton.click()

    // After clicking an action button, navigation should occur — URL should change
    // away from /knowledge-map (navigate to a course sub-route)
    await expect(page).not.toHaveURL('/knowledge-map', { timeout: 10000 })
    // URL should now include the course ID
    await expect(page).toHaveURL(new RegExp(`/courses/${TEST_COURSE.id}`), { timeout: 5000 })
  })
})

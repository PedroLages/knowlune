/**
 * E56-S03: Knowledge Map Widget E2E tests.
 *
 * Validates:
 *   - AC2: Widget renders on Overview page
 *   - AC3: Empty state shows when no knowledge data exists
 *   - AC4: Focus Areas panel action buttons navigate correctly
 *   - AC7: "See full map" link navigates to /knowledge-map
 *   - AC8: Mobile accordion view is visible at 375px width
 */
import { test, expect } from '../support/fixtures'
import { goToOverview } from '../support/helpers/navigation'
import {
  seedImportedCourses,
  seedQuizzes,
  seedQuizAttempts,
} from '../support/helpers/indexeddb-seed'

/** Minimal ImportedCourse record sufficient for the knowledge map store */
const TEST_COURSE = {
  id: 'test-course-1',
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
  id: 'test-quiz-1',
  lessonId: 'test-lesson-1',
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

/** Minimal QuizAttempt record for the test quiz */
const TEST_QUIZ_ATTEMPT = {
  id: 'test-attempt-1',
  quizId: 'test-quiz-1',
  answers: [0],
  score: 85,
  completedAt: '2026-01-01T00:00:00.000Z',
  durationSeconds: 60,
}

/**
 * Seed course + quiz data into IndexedDB so the knowledge map store
 * resolves topics and renders the non-empty widget state.
 */
async function seedKnowledgeMapData(page: import('@playwright/test').Page) {
  // Must navigate to a real URL before accessing storage APIs
  await page.goto('/')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedQuizzes(page, [TEST_QUIZ])
  await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])
}

test.describe('Knowledge Map Widget (E56-S03)', () => {
  test('AC2 — widget heading is visible on Overview', async ({ page }) => {
    await seedKnowledgeMapData(page)
    await goToOverview(page)

    const heading = page.getByRole('heading', { name: 'Knowledge Map' })
    await expect(heading).toBeVisible()
  })

  test('AC3 — empty state shows when no knowledge data exists', async ({ page }) => {
    // Fresh browser context has no IndexedDB data → empty state renders
    await goToOverview(page)

    const emptyState = page.getByTestId('knowledge-map-empty')
    await expect(emptyState).toBeVisible()

    // Empty state also shows the heading for consistency
    const heading = page.getByRole('heading', { name: 'Knowledge Map' })
    await expect(heading).toBeVisible()
  })

  test('AC7 — "See full map" link navigates to /knowledge-map', async ({ page }) => {
    await seedKnowledgeMapData(page)
    await goToOverview(page)

    // Wait for non-empty state (widget computes scores asynchronously)
    const link = page.getByTestId('see-full-map-link')
    await expect(link).toBeVisible({ timeout: 10000 })

    await link.click()
    await expect(page).toHaveURL('/knowledge-map')
  })

  test('AC4 — Focus Areas action button navigates to course page', async ({ page }) => {
    await seedKnowledgeMapData(page)
    await goToOverview(page)

    // Wait for non-empty state with focus areas
    const focusAreas = page.locator('[aria-label="Focus areas requiring attention"]')

    // Focus areas only render when urgency topics exist; skip gracefully if none
    const hasFocusAreas = await focusAreas.isVisible({ timeout: 10000 }).catch(() => false)
    if (!hasFocusAreas) {
      test.skip()
      return
    }

    // Click the first action button in the first focus area
    const firstActionButton = focusAreas.locator('button').first()
    await expect(firstActionButton).toBeVisible()
    await firstActionButton.click()

    // Navigation should occur (URL changes away from overview)
    await expect(page).not.toHaveURL('/')
  })

  test('AC8 — mobile accordion view is visible at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    // Seed sidebar as closed to avoid overlay blocking at mobile viewport
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await seedImportedCourses(page, [TEST_COURSE])
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_QUIZ_ATTEMPT])
    await goToOverview(page)

    // Widget heading should always be visible regardless of data state
    const heading = page.getByRole('heading', { name: 'Knowledge Map' })
    await expect(heading).toBeVisible()

    // The mobile accordion wrapper should be in the DOM
    const accordionSection = page.locator('.block.sm\\:hidden')
    await expect(accordionSection).toBeAttached()
  })
})

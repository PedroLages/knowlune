/**
 * ATDD tests for E10-S02: Empty State Guidance
 *
 * Tests run with NO seeded data to trigger empty states.
 * Each test maps to a specific AC from the story file.
 * 16 tests covering all 7 ACs.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'

test.describe('E10-S02: Empty State Guidance', () => {
  // ── AC1: Dashboard overview — no courses ──────────────────────
  test.describe('Dashboard — no courses imported', () => {
    test('displays empty state with import message', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-courses')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Import your first course to get started')
    })

    test('shows supportive illustration or icon', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-courses')
      await expect(emptyState.getByTestId('empty-state-icon')).toBeVisible()
    })

    test('CTA links to course import workflow', async ({ page }) => {
      await navigateAndWait(page, '/')

      const cta = page.getByTestId('empty-state-courses').getByRole('button', { name: /import/i })
      await expect(cta).toBeVisible()
      await cta.click()
      // importCourseFromFolder triggers file picker — verify button responds (no crash/error)
    })
  })

  // ── AC2: Notes section — no notes ─────────────────────────────
  test.describe('Notes — no notes recorded', () => {
    test('displays empty state with note-taking message', async ({ page }) => {
      await navigateAndWait(page, '/notes')

      const emptyState = page.getByTestId('empty-state-notes')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Start a video and take your first note')
    })

    test('shows description of what notes are for', async ({ page }) => {
      await navigateAndWait(page, '/notes')

      const emptyState = page.getByTestId('empty-state-notes')
      await expect(emptyState).toContainText(/capture|key moments|study/i)
    })

    test('CTA links to course library', async ({ page }) => {
      await navigateAndWait(page, '/notes')

      const cta = page.getByTestId('empty-state-notes').getByRole('link')
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute('href', '/courses')
    })
  })

  // ── AC3: Challenges section — no challenges ───────────────────
  test.describe('Challenges — no challenges created', () => {
    test('displays empty state with challenge creation message', async ({ page }) => {
      await navigateAndWait(page, '/challenges')

      const emptyState = page.getByTestId('empty-state-challenges')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Create your first learning challenge')
    })

    test('describes the value of challenges', async ({ page }) => {
      await navigateAndWait(page, '/challenges')

      const emptyState = page.getByTestId('empty-state-challenges')
      await expect(emptyState).toContainText(/goals|progress|challenges/i)
    })

    test('CTA opens challenge creation flow', async ({ page }) => {
      await navigateAndWait(page, '/challenges')

      const cta = page
        .getByTestId('empty-state-challenges')
        .getByRole('button', { name: /create|challenge/i })
      await expect(cta).toBeVisible()
      await cta.click()
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  // ── AC4: Reports/Activity — no study sessions ────────────────
  test.describe('Reports — no study sessions', () => {
    test('displays empty state guiding user to start studying', async ({ page }) => {
      await navigateAndWait(page, '/reports')

      const emptyState = page.getByTestId('empty-state-sessions')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Start studying to see your analytics')
    })

    test('CTA links to courses', async ({ page }) => {
      await navigateAndWait(page, '/reports')

      const cta = page.getByTestId('empty-state-sessions').getByRole('link')
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute('href', '/courses')
    })
  })

  // ── AC5: CTA navigation ──────────────────────────────────────
  test.describe('CTA navigation', () => {
    test('Notes CTA navigates to courses page', async ({ page }) => {
      await navigateAndWait(page, '/notes')

      const cta = page.getByTestId('empty-state-notes').getByRole('link')
      await cta.click()

      await expect(page).toHaveURL(/courses/, { timeout: 500 })
    })

    test('Challenges CTA opens challenge creation dialog', async ({ page }) => {
      await navigateAndWait(page, '/challenges')

      const cta = page
        .getByTestId('empty-state-challenges')
        .getByRole('button', { name: /create|challenge/i })
      await cta.click()

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 500 })
    })

    test('Reports CTA navigates to courses page', async ({ page }) => {
      await navigateAndWait(page, '/reports')

      const cta = page.getByTestId('empty-state-sessions').getByRole('link')
      await cta.click()

      await expect(page).toHaveURL(/courses/, { timeout: 500 })
    })
  })

  // ── AC6: Content replaces empty state ─────────────────────────
  test.describe('Content replacement', () => {
    test('empty state disappears when content exists', async ({ page, indexedDB }) => {
      // Start with no data — empty state should show
      await navigateAndWait(page, '/')
      await expect(page.getByTestId('empty-state-courses')).toBeVisible()

      // Seed an imported course and reload
      await indexedDB.seedImportedCourses([createImportedCourse({ id: 'test-course-1' })])
      await page.reload()
      await page.waitForLoadState('load')

      // Empty state should be gone
      await expect(page.getByTestId('empty-state-courses')).not.toBeVisible()
    })
  })

  // ── AC7: 2-minute completion flow ─────────────────────────────
  test.describe('Completion flow', () => {
    test('empty state prompts guide user through import → study → challenge sequence', async ({
      page,
    }) => {
      // Step 1: Dashboard shows courses empty state with import CTA
      await navigateAndWait(page, '/')
      const coursesCta = page
        .getByTestId('empty-state-courses')
        .getByRole('button', { name: /import/i })
      await expect(coursesCta).toBeVisible()

      // Step 2: Notes shows empty state pointing to courses
      await navigateAndWait(page, '/notes')
      const notesCta = page.getByTestId('empty-state-notes').getByRole('link')
      await expect(notesCta).toHaveAttribute('href', '/courses')
      await notesCta.click()
      await expect(page).toHaveURL(/courses/, { timeout: 500 })

      // Step 3: Challenges shows empty state with create CTA
      await navigateAndWait(page, '/challenges')
      const challengesCta = page
        .getByTestId('empty-state-challenges')
        .getByRole('button', { name: /create|challenge/i })
      await expect(challengesCta).toBeVisible()
      await challengesCta.click()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 500 })
    })
  })
})

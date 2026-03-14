/**
 * ATDD tests for E10-S02: Empty State Guidance
 *
 * RED phase — these tests define the acceptance criteria as failing E2E tests.
 * Each test maps to a specific AC from the story file.
 *
 * Tests run with NO seeded data to trigger empty states.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

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
      const illustration = emptyState.locator('svg, img, [data-testid="empty-state-icon"]')
      await expect(illustration).toBeVisible()
    })

    test('CTA links to course import workflow', async ({ page }) => {
      await navigateAndWait(page, '/')

      const cta = page.getByTestId('empty-state-courses').getByRole('button', { name: /import/i })
      await expect(cta).toBeVisible()
    })
  })

  // ── AC2: Notes section — no notes ─────────────────────────────
  test.describe('Notes — no notes recorded', () => {
    test('displays empty state with note-taking message', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-notes')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Start a video and take your first note')
    })

    test('shows description of what notes are for', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-notes')
      await expect(emptyState).toContainText(/capture|key moments|study/i)
    })

    test('CTA links to course library', async ({ page }) => {
      await navigateAndWait(page, '/')

      const cta = page.getByTestId('empty-state-notes').getByRole('link')
      await expect(cta).toBeVisible()
    })
  })

  // ── AC3: Challenges section — no challenges ───────────────────
  test.describe('Challenges — no challenges created', () => {
    test('displays empty state with challenge creation message', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-challenges')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText('Create your first learning challenge')
    })

    test('describes the value of challenges', async ({ page }) => {
      await navigateAndWait(page, '/')

      const emptyState = page.getByTestId('empty-state-challenges')
      // Should have descriptive text beyond just the title
      const description = emptyState.locator('p')
      await expect(description).toBeVisible()
    })

    test('CTA opens challenge creation flow', async ({ page }) => {
      await navigateAndWait(page, '/')

      const cta = page.getByTestId('empty-state-challenges').getByRole('button', { name: /create|challenge/i })
      await expect(cta).toBeVisible()
    })
  })

  // ── AC4: Reports/Activity — no study sessions ────────────────
  test.describe('Reports — no study sessions', () => {
    test('displays empty state guiding user to start studying', async ({ page }) => {
      await navigateAndWait(page, '/reports')

      const emptyState = page.getByTestId('empty-state-sessions')
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText(/start studying|begin learning|study session/i)
    })

    test('CTA links to courses or import flow', async ({ page }) => {
      await navigateAndWait(page, '/reports')

      const cta = page.getByTestId('empty-state-sessions').getByRole('link')
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute('href', /courses|import/i)
    })
  })

  // ── AC5: CTA navigation ──────────────────────────────────────
  test.describe('CTA navigation', () => {
    test('navigates to correct destination without intermediate steps', async ({ page }) => {
      await navigateAndWait(page, '/')

      // Click the courses empty state CTA
      const cta = page.getByTestId('empty-state-courses').getByRole('button', { name: /import/i })
      await cta.click()

      // Should navigate directly — verify URL changed or import dialog opened
      await expect(page).toHaveURL(/courses|import/, { timeout: 3000 })
    })
  })

  // ── AC6: Content replaces empty state ─────────────────────────
  test.describe('Content replacement', () => {
    test('empty state disappears when content exists', async ({ page, indexedDB }) => {
      // Start with no data — empty state should show
      await navigateAndWait(page, '/')
      await expect(page.getByTestId('empty-state-courses')).toBeVisible()

      // Seed course data and reload
      await indexedDB.seed('courses', [
        {
          id: 'test-course-1',
          title: 'Test Course',
          status: 'Active',
          topic: 'Testing',
          modules: [],
          addedAt: new Date().toISOString(),
        },
      ])
      await page.reload()
      await page.waitForLoadState('load')

      // Empty state should be gone, real content should show
      await expect(page.getByTestId('empty-state-courses')).not.toBeVisible()
    })
  })
})

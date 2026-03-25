/**
 * E27-S01: Add Analytics Tabs To Reports Page
 *
 * Tests URL-aware tab switching via useSearchParams, Quiz Analytics tab
 * content and empty state, and fallback behavior for invalid tab params.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

/**
 * Seed minimal study data so the Reports `hasActivity` guard passes
 * and tabs are visible. Without this, Reports shows the empty state.
 */
const SEED_COURSE_PROGRESS = JSON.stringify({
  'test-course': {
    courseId: 'test-course',
    completedLessons: ['lesson-1'],
    notes: {},
    startedAt: '2026-01-01T00:00:00.000Z',
    lastAccessedAt: '2026-01-01T00:00:00.000Z',
  },
})

test.describe('E27-S01: URL-aware Reports tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(progressData => {
      localStorage.setItem('course-progress', progressData)
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    }, SEED_COURSE_PROGRESS)
  })

  test('defaults to Study tab when no ?tab param', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'inactive'
    )
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'inactive'
    )
  })

  test('?tab=study activates Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=quizzes activates Quiz tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=ai activates AI tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=invalid falls back to Study tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=invalid')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('clicking tab updates URL', async ({ page }) => {
    await navigateAndWait(page, '/reports')

    await page.getByRole('tab', { name: 'Quiz Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )

    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )

    await page.getByRole('tab', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('Quiz Analytics shows empty state when no quiz data', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=quizzes')
    await expect(page.getByText('No quizzes taken yet')).toBeVisible()
  })

  test('all three tab triggers are visible', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toBeVisible()
  })
})

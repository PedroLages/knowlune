/**
 * E27-S02: Route Redirects For Legacy Paths
 *
 * Tests that:
 * - Path-based URLs (/reports/study, /reports/quizzes, /reports/ai) redirect
 *   to their query-param equivalents (/reports?tab=...)
 * - Reports tabs are controlled by the URL ?tab= parameter
 * - Tab clicks update the URL
 * - Unknown tab values fall back to the study default
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

test.describe('E27-S02: Route redirects for legacy paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(progressData => {
      localStorage.setItem('course-progress', progressData)
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    }, SEED_COURSE_PROGRESS)
  })

  // -- AC3: Path-based redirects --

  test('/reports/study redirects to /reports?tab=study', async ({ page }) => {
    await navigateAndWait(page, '/reports/study')
    await expect(page).toHaveURL(/\/reports\?tab=study/)
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('/reports/ai redirects to /reports?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/reports/ai')
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('/reports/quizzes redirects to /reports?tab=quizzes', async ({ page }) => {
    await navigateAndWait(page, '/reports/quizzes')
    await expect(page).toHaveURL(/\/reports\?tab=quizzes/)
    await expect(page.getByRole('tab', { name: 'Quiz Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  // -- AC1: URL-controlled tabs --

  test('?tab=study activates Study Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('?tab=ai activates AI Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  // -- AC4: Default tab fallback --

  test('bare /reports defaults to Study Analytics tab', async ({ page }) => {
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('unknown ?tab=garbage falls back to Study Analytics', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=garbage')
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  // -- AC2: Tab click updates URL --

  test('clicking AI Analytics tab updates URL to ?tab=ai', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=study')
    await page.getByRole('tab', { name: 'AI Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=ai/)
    await expect(page.getByRole('tab', { name: 'AI Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  test('clicking Study Analytics tab updates URL to ?tab=study', async ({ page }) => {
    await navigateAndWait(page, '/reports?tab=ai')
    await page.getByRole('tab', { name: 'Study Analytics' }).click()
    await expect(page).toHaveURL(/\/reports\?tab=study/)
    await expect(page.getByRole('tab', { name: 'Study Analytics' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })
})

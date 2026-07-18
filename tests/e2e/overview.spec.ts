import { test, expect } from '../support/fixtures'
import {
  clearOverviewData,
  freezeOverviewClock,
  openSeededOverview,
} from '../support/helpers/overview-seed'

test.describe('Overview dashboard', () => {
  test.afterEach(async ({ page }) => {
    await clearOverviewData(page)
  })

  test('new learner gets one activation experience and can open the import flow', async ({
    page,
  }) => {
    await freezeOverviewClock(page)
    await page.goto('/overview', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('overview-new-learner')).toBeVisible()
    await expect(page.getByTestId('overview-import-course')).toBeVisible()
    await expect(page.getByTestId('overview-learning-focus')).toHaveCount(0)
    await expect(page.getByTestId('section-progress')).toHaveCount(0)

    await page.getByTestId('overview-import-course').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('early learner sees a truthful action without analytics clutter', async ({ page }) => {
    await openSeededOverview(page, 'early')

    await expect(page.getByTestId('overview-learning-focus')).toBeVisible()
    await expect(page.getByTestId('overview-today')).toBeVisible()
    await expect(page.getByTestId('overview-primary-action')).toBeVisible()
    await expect(page.getByTestId('section-progress')).toHaveCount(0)
    await expect(page.getByTestId('section-consistency')).toHaveCount(0)
    await expect(page.getByTestId('section-library')).toBeVisible()
  })

  test('active learner sees real analytics, changes range, and resumes the newest lesson', async ({
    page,
  }) => {
    await openSeededOverview(page, 'active')

    await expect(page.getByTestId('section-progress')).toBeVisible()
    await expect(page.getByTestId('section-consistency')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Focused minutes' })).toBeVisible()
    await expect(page.getByRole('button', { name: '7D' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: '30D' }).click()
    await expect(page.getByRole('button', { name: '30D' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Feedback loops check')).toBeVisible()

    await page.getByTestId('overview-primary-action').click()
    await expect(page).toHaveURL(/\/courses\/overview-course\/lessons\/overview-lesson-2$/)
  })

  test('returning learner receives a restart-focused experience', async ({ page }) => {
    await openSeededOverview(page, 'returning')

    await expect(page.getByRole('heading', { name: 'Pick up the thread' })).toBeVisible()
    await expect(page.getByTestId('overview-primary-action')).toHaveText(
      /Resume where you left off/
    )
    await expect(page.getByRole('button', { name: '30D' })).toHaveAttribute('aria-pressed', 'true')
  })

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1920, height: 1080 },
  ]) {
    test(`${viewport.name} viewport has no page-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openSeededOverview(page, 'active')

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

      if (viewport.width === 390) {
        await expect(page.getByTestId('overview-primary-action')).toBeInViewport()
      }
      if (viewport.width === 1440) {
        await expect(page.getByTestId('overview-today')).toBeInViewport()
        await expect(page.getByTestId('section-pulse')).toBeInViewport()
      }
    })
  }
})

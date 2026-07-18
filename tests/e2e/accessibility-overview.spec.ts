import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '../support/fixtures'
import {
  clearOverviewData,
  freezeOverviewClock,
  openSeededOverview,
} from '../support/helpers/overview-seed'

async function expectNoSeriousAxeViolations(page: import('@playwright/test').Page) {
  await page
    .locator('[data-sonner-toast]')
    .last()
    .waitFor({ state: 'hidden', timeout: 7000 })
    .catch(() => {})
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-agentation]')
    .exclude('[data-feedback-toolbar]')
    .analyze()

  const serious = results.violations.filter(
    violation => violation.impact === 'serious' || violation.impact === 'critical'
  )
  expect(serious).toEqual([])
}

test.describe('Overview accessibility', () => {
  test.afterEach(async ({ page }) => {
    await clearOverviewData(page)
  })

  test('new learner state has no serious or critical axe violations', async ({ page }) => {
    await freezeOverviewClock(page)
    await page.goto('/overview', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('overview-new-learner')).toBeVisible()

    await expectNoSeriousAxeViolations(page)
  })

  test('active learner state has no serious or critical axe violations', async ({ page }) => {
    await openSeededOverview(page, 'active')
    await expect(page.getByTestId('section-consistency')).toBeVisible()

    await expectNoSeriousAxeViolations(page)
  })

  test('heatmap exposes one roving tab stop and keyboard day details', async ({ page }) => {
    await openSeededOverview(page, 'active')

    const grid = page.getByRole('grid', { name: 'Study minutes by day for the last 12 weeks' })
    await expect(grid).toBeVisible()
    const cells = grid.getByRole('gridcell')
    const tabbableCell = grid.locator('[role="gridcell"][tabindex="0"]')
    await expect(cells).toHaveCount(84)
    await expect(tabbableCell).toHaveCount(1)

    await tabbableCell.focus()
    await page.keyboard.press('Home')
    const firstLabel = await page.locator(':focus').getAttribute('aria-label')
    await page.keyboard.press('ArrowRight')
    const nextLabel = await page.locator(':focus').getAttribute('aria-label')

    expect(nextLabel).not.toBe(firstLabel)
    await expect(grid.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1)
    await expect(page.locator('#heatmap-detail')).toContainText('Selected day')
  })

  test('mobile primary action is visible and meets the 44px target size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSeededOverview(page, 'early')

    const action = page.getByTestId('overview-primary-action')
    await expect(action).toBeInViewport()
    const box = await action.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

import { test, expect } from '../support/fixtures'
import {
  clearOverviewData,
  freezeOverviewClock,
  openSeededOverview,
  seedOverviewLearner,
} from '../support/helpers/overview-seed'

const PREFERENCES_KEY = 'knowlune-dashboard-preferences-v2'

test.describe('Overview presets and customization', () => {
  test.afterEach(async ({ page }) => {
    await clearOverviewData(page)
  })

  test('Focus preset hides deep analytics and survives reload', async ({ page, localStorage }) => {
    await openSeededOverview(page, 'active')
    await page.getByTestId('customize-dashboard-toggle').click()
    await page.getByTestId('dashboard-preset-focus').click()

    await expect(page.getByTestId('dashboard-preset-focus')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('[data-dashboard-section="consistency"]')).toHaveCount(0)
    await expect(page.locator('[data-dashboard-section="insights"]')).toHaveCount(0)

    expect(await localStorage.get(PREFERENCES_KEY)).toEqual({
      version: 2,
      preset: 'focus',
      order: ['focus', 'pulse', 'progress', 'library', 'consistency', 'insights'],
      hidden: ['consistency', 'insights'],
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-dashboard-section="library"]')).toBeVisible()
    await expect(page.locator('[data-dashboard-section="consistency"]')).toHaveCount(0)
    await expect(page.locator('[data-dashboard-section="insights"]')).toHaveCount(0)
  })

  test('manual order and visibility become custom, while reset restores Balanced', async ({
    page,
    localStorage,
  }) => {
    await openSeededOverview(page, 'active')
    await page.getByTestId('customize-dashboard-toggle').click()

    await page.getByTestId('section-row-focus-move-down').click()
    await page.getByRole('checkbox', { name: 'Show Library' }).click()

    const custom = await localStorage.get<{
      preset: string
      order: string[]
      hidden: string[]
    }>(PREFERENCES_KEY)
    expect(custom?.preset).toBe('custom')
    expect(custom?.order.slice(0, 2)).toEqual(['pulse', 'focus'])
    expect(custom?.hidden).toContain('library')

    await page.getByTestId('reset-dashboard-order').click()
    const balanced = await localStorage.get<{
      preset: string
      order: string[]
      hidden: string[]
    }>(PREFERENCES_KEY)
    expect(balanced).toEqual({
      version: 2,
      preset: 'balanced',
      order: ['focus', 'pulse', 'progress', 'consistency', 'insights', 'library'],
      hidden: [],
    })
  })

  test('legacy order migrates once and obsolete tracking is removed', async ({
    page,
    localStorage,
  }) => {
    await freezeOverviewClock(page)
    await page.addInitScript(() => {
      localStorage.setItem(
        'dashboard-section-order',
        JSON.stringify({
          order: ['study-history', 'metrics-strip', 'recommended-next'],
          pinnedSections: ['course-gallery'],
          isManuallyOrdered: true,
        })
      )
      localStorage.setItem('dashboard-section-stats', JSON.stringify({ views: 42 }))
    })
    await page.goto('/overview', { waitUntil: 'domcontentloaded' })
    await seedOverviewLearner(page, 'active')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()

    expect(await localStorage.get(PREFERENCES_KEY)).toEqual({
      version: 2,
      preset: 'custom',
      order: ['library', 'consistency', 'pulse', 'focus', 'progress', 'insights'],
      hidden: [],
    })
    expect(await page.evaluate(() => localStorage.getItem('dashboard-section-order'))).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('dashboard-section-stats'))).toBeNull()

    await page.reload({ waitUntil: 'domcontentloaded' })
    expect(await localStorage.get(PREFERENCES_KEY)).toMatchObject({ preset: 'custom' })
  })
})

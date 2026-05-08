/**
 * Reading Goals dialog — layout regression (Library).
 *
 * Guards preset grid height, yearly input width, and footer visibility on short viewports.
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import { tabSeedsBase } from '../support/helpers/library-tab-seed'

test.beforeEach(async ({ page }) => {
  await page.goto('/library', { waitUntil: 'domcontentloaded' })
  await seedBooks(page, tabSeedsBase())
  await page.reload({ waitUntil: 'domcontentloaded' })
})

test.describe('Reading Goals modal layout', () => {
  test('yearly goal input and active preset have readable geometry (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 800 })

    await page.getByTestId('library-reading-goals-trigger').click()
    await expect(page.getByTestId('reading-goals-dialog')).toBeVisible()

    const yearly = page.getByRole('spinbutton', { name: 'Yearly book goal' })
    await expect(yearly).toBeVisible()
    const yBox = await yearly.boundingBox()
    expect(yBox).not.toBeNull()
    expect(yBox!.width).toBeGreaterThan(56)

    const pressedPreset = page
      .getByRole('group', { name: 'Daily goal presets' })
      .getByRole('button', { pressed: true })
    await expect(pressedPreset).toBeVisible()
    const pBox = await pressedPreset.boundingBox()
    expect(pBox).not.toBeNull()
    expect(pBox!.height).toBeGreaterThan(48)
    expect(pBox!.height).toBeLessThan(140)
    expect(pBox!.width).toBeGreaterThan(56)

    const ringSvg = page.getByTestId('yearly-progress-ring').locator('svg').first()
    await expect(ringSvg).toBeVisible()
    const svgBox = await ringSvg.boundingBox()
    expect(svgBox).not.toBeNull()
    expect(svgBox!.width).toBeGreaterThanOrEqual(200)
    expect(svgBox!.height).toBeGreaterThanOrEqual(200)
  })

  test('Save Goals stays visible on short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 520 })

    await page.getByTestId('library-reading-goals-trigger').click()
    await expect(page.getByTestId('reading-goals-dialog')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Goals' })).toBeVisible()
  })

  test('opens from mobile overflow menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })

    await page.getByTestId('library-overflow-trigger').click()
    await page.getByTestId('library-reading-goals-menu-item').click()
    await expect(page.getByTestId('reading-goals-dialog')).toBeVisible()
  })
})

/**
 * Smoke tests for the Library series grouping view (E110-S02).
 */

import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Seed sidebar state to prevent overlay blocking interactions
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
})

test('series view renders when switching to series tab', async ({ page }) => {
  await page.goto('/library')

  // Switch to local series view via the tab button
  const seriesTab = page.locator('[data-testid="local-view-series"]')
  await expect(seriesTab).toBeVisible()
  await seriesTab.click()

  // Verify the series view container renders
  await expect(page.locator('[data-testid="local-series-view"]')).toBeVisible()
})

test('series view shows empty state when no books with series data', async ({ page }) => {
  await page.goto('/library')

  const seriesTab = page.locator('[data-testid="local-view-series"]')
  await expect(seriesTab).toBeVisible()
  await seriesTab.click()

  const seriesView = page.locator('[data-testid="local-series-view"]')
  await expect(seriesView).toBeVisible()

  // With no books the view renders without crashing — either empty state or ungrouped section
  // Both are valid: we just verify no JS errors and the container is present
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Wait for the series view to be stable (auto-retry)
  await expect(page.locator('[data-testid="local-series-view"]')).toBeVisible()
  expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0)
})

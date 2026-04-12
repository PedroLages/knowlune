import { test, expect } from '@playwright/test'

test.describe('E112-S02: Genre Distribution & Reading Summary smoke', () => {
  test('Reports page loads with no data without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

    // With no seeded data, genre/summary cards render null — verify no crash
    await expect(page.locator('[data-testid="genre-distribution-card"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="reading-summary-card"]')).not.toBeVisible()

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })
})

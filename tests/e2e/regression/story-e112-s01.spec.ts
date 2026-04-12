import { test, expect } from '@playwright/test'

test.describe('E112-S01: Reading Stats & Patterns smoke', () => {
  test('Reports page Study tab loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

    // With no seeded data, components render null — no crash expected
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })
})

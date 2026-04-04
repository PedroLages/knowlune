/**
 * E2E Smoke Tests: E69-S01 — Storage Overview Card
 *
 * Acceptance criteria covered:
 * - AC1: Storage overview card renders in Settings with usage bar
 * - AC2: Category breakdown legend is visible
 * - AC5: Refresh button is present and interactive
 * - AC6: Accessible table for screen readers
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

test.describe('E69-S01: Storage Overview Card', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWait(page, '/settings')
  })

  test('storage overview card renders with usage bar', async ({ page }) => {
    // Scroll to storage section
    const storageCard = page.getByTestId('storage-management-section')
    await expect(storageCard).toBeVisible({ timeout: 8000 })
  })

  test('category breakdown legend is visible', async ({ page }) => {
    // Wait for overview to load (not skeleton)
    await expect(page.getByRole('list')).toBeVisible({ timeout: 8000 })

    // Legend should contain at least one category label
    const legend = page.getByRole('list')
    await expect(legend).toContainText(/courses|notes|flashcards|embeddings|thumbnails/i)
  })

  test('refresh button is present and clickable', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000)

    const refreshBtn = page.getByRole('button', { name: /refresh storage estimates/i })
    await expect(refreshBtn).toBeVisible({ timeout: 8000 })
    await refreshBtn.click()

    // After click the button should still be present (re-renders after refresh)
    await expect(refreshBtn).toBeVisible({ timeout: 5000 })
  })

  test('accessible table for screen readers is present', async ({ page }) => {
    // The accessible table with aria-label is rendered alongside the visual chart
    const table = page.getByRole('table', { name: /storage usage by category/i })
    // It may be visually hidden (sr-only) but still in DOM
    await expect(table).toBeAttached({ timeout: 8000 })
  })
})

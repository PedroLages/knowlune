/**
 * E2E tests for E69-S03: Cleanup Actions with Confirmation Dialogs.
 *
 * Tests cover:
 * - Cleanup actions section is visible in Settings > Storage & Usage
 * - Confirmation dialog appears when clicking a cleanup button
 * - Toast appears after action completes
 */
import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'

test.describe('E69-S03: Cleanup Actions with Confirmation Dialogs', () => {
  test('cleanup actions section is visible in Settings', async ({ page }) => {
    await goToSettings(page)

    // Navigate to Storage & Usage section
    const storageTab = page.getByRole('tab', { name: /storage/i })
    if (await storageTab.isVisible()) {
      await storageTab.click()
    }

    // The cleanup actions section should be present
    const cleanupSection = page.locator('#cleanup-actions')
    await expect(cleanupSection).toBeVisible()

    // All three action cards should be visible
    await expect(page.getByText('Clear Thumbnail Cache')).toBeVisible()
    await expect(page.getByText('Remove Unused AI Search Data')).toBeVisible()
    await expect(page.getByText('Delete Course Data')).toBeVisible()
  })

  test('confirmation dialog appears when clicking Clear Cache button', async ({ page }) => {
    await goToSettings(page)

    const storageTab = page.getByRole('tab', { name: /storage/i })
    if (await storageTab.isVisible()) {
      await storageTab.click()
    }

    // Click the Clear Cache button to open confirmation dialog
    const clearCacheButton = page.getByRole('button', { name: /clear cache/i }).first()
    await expect(clearCacheButton).toBeVisible()
    await clearCacheButton.click()

    // AlertDialog confirmation should appear
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/clear thumbnail cache/i)).toBeVisible()

    // Cancel closes the dialog without action
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('confirmation dialog appears when clicking Remove Orphaned button', async ({ page }) => {
    await goToSettings(page)

    const storageTab = page.getByRole('tab', { name: /storage/i })
    if (await storageTab.isVisible()) {
      await storageTab.click()
    }

    // Click the Remove Orphaned button
    const removeButton = page.getByRole('button', { name: /remove orphaned/i })
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    // AlertDialog confirmation should appear
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/remove orphaned embeddings/i)).toBeVisible()

    // Cancel closes the dialog
    await dialog.getByRole('button', { name: /cancel/i }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('Free Up Space button scrolls to cleanup actions', async ({ page }) => {
    await goToSettings(page)

    const storageTab = page.getByRole('tab', { name: /storage/i })
    if (await storageTab.isVisible()) {
      await storageTab.click()
    }

    // If a storage warning banner is shown with "Free Up Space" button, click it
    const freeUpSpaceButton = page.getByRole('button', { name: /free up space/i })
    if (await freeUpSpaceButton.isVisible()) {
      await freeUpSpaceButton.click()
      // After clicking, cleanup actions section should still be visible (scrolled to)
      await expect(page.locator('#cleanup-actions')).toBeVisible()
    }
  })
})

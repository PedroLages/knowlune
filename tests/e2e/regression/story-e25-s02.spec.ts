/**
 * ATDD E2E tests for E25-S02: Author CRUD Dialogs
 *
 * Tests the author management flow on the Authors page:
 * - Authors page renders with heading and Add Author button
 * - Add Author dialog opens with required Name field
 * - Creating an author via the dialog shows it on the page
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('E25-S02: Author CRUD Dialogs', () => {
  test('Authors page renders with heading and Add Author button', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    await expect(page.getByRole('heading', { name: 'Our Authors' })).toBeVisible()
    await expect(page.locator('[data-testid="add-author-button"]')).toBeVisible()
  })

  test('Add Author button opens create dialog with Name field', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    await page.locator('[data-testid="add-author-button"]').click()

    // Dialog should open
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Create Author' })).toBeVisible()

    // Name field should be present and required (has asterisk)
    await expect(dialog.getByLabel(/Name/)).toBeVisible()
  })

  test('creating an author shows it on the page', async ({ page }) => {
    await navigateAndWait(page, '/authors')

    // Open the create dialog
    await page.locator('[data-testid="add-author-button"]').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Fill in the name field
    await dialog.getByLabel(/Name/).fill('Test Author')

    // Submit the form
    await dialog.getByRole('button', { name: 'Create Author' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()

    // The new author should appear on the page
    await expect(page.getByText('Test Author')).toBeVisible()
  })
})

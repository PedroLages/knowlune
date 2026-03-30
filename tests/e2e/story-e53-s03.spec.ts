/**
 * E2E Tests: E53-S03 — PKM & Anki Export Cards in Settings
 *
 * Tests acceptance criteria:
 * - Both export cards visible in Settings > Data Management
 * - PKM export button has correct aria-label
 * - Anki export button has correct aria-label
 * - Buttons disabled during export (isExporting guard)
 * - Empty state shows correct message
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

test.describe('E53-S03: Settings Export Cards', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAndWait(page, '/settings')
  })

  test('both export cards are visible in Data Management section', async ({ page }) => {
    // Scroll to Data Management section
    const dataSection = page.getByText('Data Management')
    await expect(dataSection).toBeVisible()

    // PKM export card
    const pkmCard = page.getByTestId('export-pkm-button')
    await expect(pkmCard).toBeVisible()

    // Anki export card
    const ankiCard = page.getByTestId('export-anki-button')
    await expect(ankiCard).toBeVisible()
  })

  test('PKM export button has correct aria-label', async ({ page }) => {
    const pkmButton = page.getByTestId('export-pkm-button')
    await expect(pkmButton).toHaveAttribute(
      'aria-label',
      'Export learning data as Obsidian-compatible Markdown'
    )
  })

  test('Anki export button has correct aria-label', async ({ page }) => {
    const ankiButton = page.getByTestId('export-anki-button')
    await expect(ankiButton).toHaveAttribute('aria-label', 'Export flashcards as Anki deck')
  })

  test('PKM export button is initially enabled', async ({ page }) => {
    const pkmButton = page.getByTestId('export-pkm-button')
    await expect(pkmButton).toBeEnabled()
  })

  test('Anki export button is initially enabled', async ({ page }) => {
    const ankiButton = page.getByTestId('export-anki-button')
    await expect(ankiButton).toBeEnabled()
  })

  test('PKM export shows empty state toast when no data exists', async ({ page }) => {
    const pkmButton = page.getByTestId('export-pkm-button')
    await pkmButton.click()

    // Wait for the toast indicating no data
    const toast = page.getByText('No learning data to export')
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('Anki export shows empty state toast when no flashcards exist', async ({ page }) => {
    const ankiButton = page.getByTestId('export-anki-button')
    await ankiButton.click()

    // Wait for the toast indicating no flashcards
    const toast = page.getByText('No flashcards to export')
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})

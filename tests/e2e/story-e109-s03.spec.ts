/**
 * E109-S03: Highlight Export — E2E tests
 *
 * Tests the highlight export dialog with format selection (text, markdown, CSV, JSON)
 * and verifies the export flow triggers correctly from the HighlightReview page.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedBookHighlights } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

/** Seed a book with highlights into IndexedDB */
async function seedTestHighlights(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: 'book-export-1',
      title: 'Export Test Book',
      author: 'Test Author',
      format: 'epub',
      status: 'reading',
      progress: 30,
      createdAt: FIXED_DATE,
    },
  ])
  await seedBookHighlights(page, [
    {
      id: 'hl-export-1',
      bookId: 'book-export-1',
      textAnchor: 'The quick brown fox jumps over the lazy dog',
      color: 'yellow',
      note: 'Famous pangram',
      position: { type: 'epub-cfi', value: '/4/2/2[ch1]' },
      createdAt: FIXED_DATE,
    },
    {
      id: 'hl-export-2',
      bookId: 'book-export-1',
      textAnchor: 'To be or not to be, that is the question',
      color: 'blue',
      position: { type: 'epub-cfi', value: '/4/2/2[ch2]' },
      createdAt: FIXED_DATE,
    },
  ])
}

test.describe('Highlight Export (E109-S03)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('export button is visible on highlight review page when highlights exist', async ({
    page,
  }) => {
    await navigateAndWait(page, '/')
    await seedTestHighlights(page)
    await navigateAndWait(page, '/highlight-review')

    await expect(page.getByTestId('highlight-export-btn')).toBeVisible()
  })

  test('opens export dialog with format options', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedTestHighlights(page)
    await navigateAndWait(page, '/highlight-review')

    await page.getByTestId('highlight-export-btn').click()

    const dialog = page.getByTestId('highlight-export-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Export Highlights')).toBeVisible()
    await expect(dialog.getByText('Plain Text')).toBeVisible()
    await expect(dialog.getByText('Markdown')).toBeVisible()
    await expect(dialog.getByText('CSV')).toBeVisible()
    await expect(dialog.getByText('JSON')).toBeVisible()
  })

  test('can select different export formats', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedTestHighlights(page)
    await navigateAndWait(page, '/highlight-review')

    await page.getByTestId('highlight-export-btn').click()
    const dialog = page.getByTestId('highlight-export-dialog')

    // Default should be markdown
    const markdownRadio = dialog.locator('#format-markdown')
    await expect(markdownRadio).toBeChecked()

    // Switch to JSON
    await dialog.locator('#format-json').click()
    await expect(dialog.locator('#format-json')).toBeChecked()

    // Switch to CSV
    await dialog.locator('#format-csv').click()
    await expect(dialog.locator('#format-csv')).toBeChecked()

    // Switch to plain text
    await dialog.locator('#format-text').click()
    await expect(dialog.locator('#format-text')).toBeChecked()
  })

  test('export confirm button triggers download', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedTestHighlights(page)
    await navigateAndWait(page, '/highlight-review')

    await page.getByTestId('highlight-export-btn').click()
    const dialog = page.getByTestId('highlight-export-dialog')

    // Select JSON format (single file, easier to verify)
    await dialog.locator('#format-json').click()

    // Listen for download event
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByTestId('export-confirm-btn').click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('highlights-export.json')
  })

  test('cancel button closes the dialog', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedTestHighlights(page)
    await navigateAndWait(page, '/highlight-review')

    await page.getByTestId('highlight-export-btn').click()
    const dialog = page.getByTestId('highlight-export-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByText('Cancel').click()
    await expect(dialog).not.toBeVisible()
  })

  test('shows empty state when no highlights to export', async ({ page }) => {
    await navigateAndWait(page, '/highlight-review')

    // Export button should not be visible when there are no highlights
    // (the page shows empty state instead)
    await expect(page.getByTestId('highlight-review-empty')).toBeVisible()
  })
})

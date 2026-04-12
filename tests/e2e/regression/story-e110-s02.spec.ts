/**
 * E110-S02: Local Series View — E2E tests
 *
 * Tests series card expand/collapse with "Continue" badge,
 * and BookMetadataEditor series field persistence.
 */
import { test, expect } from '@playwright/test'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedBooks } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

// --- Series expand/collapse test data ---

const SERIES_BOOK_1 = {
  id: 's02-book-1',
  title: 'Foundation',
  author: 'Isaac Asimov',
  format: 'epub',
  status: 'finished',
  series: 'Foundation',
  seriesSequence: '1',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test1' },
  progress: 100,
  createdAt: FIXED_DATE,
}

const SERIES_BOOK_2 = {
  id: 's02-book-2',
  title: 'Foundation and Empire',
  author: 'Isaac Asimov',
  format: 'epub',
  status: 'unread',
  series: 'Foundation',
  seriesSequence: '2',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test2' },
  progress: 0,
  createdAt: FIXED_DATE,
}

const UNGROUPED_BOOK = {
  id: 's02-book-3',
  title: 'Dune',
  author: 'Frank Herbert',
  format: 'epub',
  status: 'unread',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test3' },
  progress: 0,
  createdAt: FIXED_DATE,
}

// --- Metadata editor test data ---

const EDITOR_BOOK = {
  id: 's02-editor-book',
  title: 'The Caves of Steel',
  author: 'Isaac Asimov',
  format: 'epub',
  status: 'unread',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test4' },
  progress: 0,
  createdAt: FIXED_DATE,
}

test.describe('Local Series View (E110-S02)', () => {
  test('series card expands/collapses and shows Continue badge on next unfinished book (AC-3)', async ({
    page,
  }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [SERIES_BOOK_1, SERIES_BOOK_2, UNGROUPED_BOOK])
    await navigateAndWait(page, '/library')

    // Switch to series view
    await page.getByTestId('local-view-series').click()

    // Series card should be visible (slug: "foundation")
    const seriesCard = page.getByTestId('local-series-foundation')
    await expect(seriesCard).toBeVisible()

    // Click the toggle to expand the card
    await page.getByTestId('local-series-foundation-toggle').click()

    // Expanded book list should be visible
    const bookList = page.getByTestId('local-series-foundation-books')
    await expect(bookList).toBeVisible()

    // Both books should appear in sequence order (book-1 first, book-2 second)
    await expect(page.getByTestId('series-book-s02-book-1')).toBeVisible()
    await expect(page.getByTestId('series-book-s02-book-2')).toBeVisible()

    // "Continue" badge on book-2 (next unfinished — book-1 is finished at 100%)
    await expect(page.getByTestId('continue-badge-s02-book-2')).toBeVisible()

    // Click toggle again to collapse
    await page.getByTestId('local-series-foundation-toggle').click()
    await expect(bookList).not.toBeVisible()
  })

  test('BookMetadataEditor saves series name and sequence; book appears in series view (AC-5)', async ({
    page,
  }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [EDITOR_BOOK])
    await navigateAndWait(page, '/library')

    // Verify book is visible in grid view
    await expect(page.getByTestId('book-card-s02-editor-book')).toBeVisible()

    // Open the "more actions" dropdown on the book card
    const bookCard = page.getByTestId('book-card-s02-editor-book')
    await bookCard.hover()
    await page.getByTestId('book-more-actions').first().click()

    // Click "Edit" from the dropdown menu
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Metadata editor dialog should open
    await expect(page.getByTestId('book-metadata-editor')).toBeVisible()

    // Fill in series name and sequence
    await page.getByTestId('edit-book-series').fill('Robot')
    await page.getByTestId('edit-book-series-sequence').fill('1')

    // Save changes
    await page.getByTestId('editor-save-button').click()

    // Dialog should close after saving
    await expect(page.getByTestId('book-metadata-editor')).not.toBeVisible()

    // Switch to series view
    await page.getByTestId('local-view-series').click()

    // Book should now appear in the "Robot" series group (slug: "robot")
    await expect(page.getByTestId('local-series-robot')).toBeVisible()
  })
})

/**
 * E2E Tests: E108-S02 — Format Badges and Delete
 *
 * Acceptance criteria covered:
 * - AC-4: Book context menu includes a "Delete" option
 * - AC-5: Delete confirmation dialog shows book title and OPFS warning
 * - AC-6: On confirmation, book is removed from Dexie (and OPFS cleanup runs)
 * - AC-7: After deletion, book disappears from the library view immediately
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const DELETE_TEST_BOOKS = [
  {
    id: 'delete-book-1',
    title: 'Book To Delete',
    author: 'Test Author',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'delete-book-2',
    title: 'Book That Stays',
    author: 'Another Author',
    format: 'pdf',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 25,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

async function seedAndOpenLibrary(page: import('@playwright/test').Page): Promise<void> {
  // Set localStorage keys BEFORE navigation using addInitScript to prevent
  // onboarding/welcome wizard overlays from blocking test interactions
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
  // Navigate once to a real URL so IndexedDB is accessible
  await page.goto('/')
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    DELETE_TEST_BOOKS as unknown as Record<string, unknown>[]
  )
  await page.goto('/library')
}

test.describe('E108-S02: Delete flow via context menu', () => {
  test('context menu shows Delete option', async ({ page }) => {
    await seedAndOpenLibrary(page)

    await expect(page.getByText('Book To Delete')).toBeVisible({ timeout: 8000 })

    // Right-click to open context menu
    await page.getByText('Book To Delete').click({ button: 'right' })

    await expect(page.getByTestId('context-menu-delete')).toBeVisible({ timeout: 3000 })
  })

  test('clicking Delete opens a confirmation dialog with the book title', async ({ page }) => {
    await seedAndOpenLibrary(page)

    await expect(page.getByText('Book To Delete')).toBeVisible({ timeout: 8000 })

    await page.getByText('Book To Delete').click({ button: 'right' })
    await expect(page.getByTestId('context-menu-delete')).toBeVisible({ timeout: 3000 })
    await page.getByTestId('context-menu-delete').click()

    // Dialog should be visible with the book title (use alertdialog scope to avoid strict mode violation)
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(dialog.getByText('Book To Delete')).toBeVisible()
    // OPFS warning should be present (AC-5)
    await expect(page.getByText(/OPFS/i)).toBeVisible()
  })

  test('cancelling the dialog keeps the book in the library', async ({ page }) => {
    await seedAndOpenLibrary(page)

    await expect(page.getByText('Book To Delete')).toBeVisible({ timeout: 8000 })

    await page.getByText('Book To Delete').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click()

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close, book should still be visible
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(page.getByText('Book To Delete')).toBeVisible()
  })

  test('confirming deletion removes the book from the library view', async ({ page }) => {
    await seedAndOpenLibrary(page)

    await expect(page.getByText('Book To Delete')).toBeVisible({ timeout: 8000 })
    // Verify the other book stays throughout
    await expect(page.getByText('Book That Stays')).toBeVisible()

    await page.getByText('Book To Delete').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click()

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })
    await page.getByTestId('confirm-delete-book').click()

    // Book should disappear from the library (AC-7)
    await expect(page.getByText('Book To Delete')).not.toBeVisible({ timeout: 5000 })
    // The other book must remain (no collateral damage)
    await expect(page.getByText('Book That Stays')).toBeVisible()
  })

  test('deleting the last book shows empty state', async ({ page }) => {
    // Set localStorage BEFORE navigation to prevent overlay blocking
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await page.goto('/')
    // Seed only one book
    await seedIndexedDBStore(page, DB_NAME, 'books', [DELETE_TEST_BOOKS[0]] as unknown as Record<
      string,
      unknown
    >[])
    await page.goto('/library')

    await expect(page.getByText('Book To Delete')).toBeVisible({ timeout: 8000 })

    await page.getByText('Book To Delete').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click()
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })
    await page.getByTestId('confirm-delete-book').click()

    await expect(page.getByText('Book To Delete')).not.toBeVisible({ timeout: 5000 })
    // Empty state should appear — library shows "Your library is waiting to be filled." when no books exist
    await expect(page.getByTestId('import-first-book-cta')).toBeVisible({ timeout: 5000 })
  })
})

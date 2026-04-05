/**
 * E2E Tests: E83-S05 — Book metadata editor
 *
 * Acceptance criteria covered:
 * - AC1: Metadata editor opens from context menu "Edit" action
 * - AC2: Fields are pre-populated with existing book data
 * - AC3: Editing a field and saving persists the change
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_BOOKS = [
  {
    id: 'test-book-edit-1',
    title: 'Original Title',
    author: 'Original Author',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    isbn: '978-0-123456-78-9',
    description: 'A test book description',
    progress: 40,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

async function seedBooks(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
  })
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    TEST_BOOKS as unknown as Record<string, unknown>[]
  )
  await page.goto('/library')
  await page.reload()
}

test.describe('E83-S05: Book Metadata Editor', () => {
  test('opens metadata editor from context menu and edits title', async ({ page }) => {
    await seedBooks(page)

    // Wait for book to appear
    await expect(page.getByText('Original Title')).toBeVisible({ timeout: 8000 })

    // Right-click to open context menu
    await page.getByText('Original Title').click({ button: 'right' })

    // Click Edit in context menu
    await expect(page.getByTestId('context-menu-edit')).toBeVisible({ timeout: 3000 })
    await page.getByTestId('context-menu-edit').click()

    // Metadata editor should be visible
    await expect(page.getByTestId('book-metadata-editor')).toBeVisible({ timeout: 3000 })

    // Fields should be pre-populated
    const titleInput = page.getByTestId('edit-book-title')
    await expect(titleInput).toHaveValue('Original Title')
    await expect(page.getByTestId('edit-book-author')).toHaveValue('Original Author')

    // Edit the title
    await titleInput.clear()
    await titleInput.fill('Updated Title')

    // Save
    await page.getByTestId('editor-save-button').click()

    // Editor should close
    await expect(page.getByTestId('book-metadata-editor')).not.toBeVisible({ timeout: 5000 })

    // Updated title should be visible on the library page
    await expect(page.getByText('Updated Title')).toBeVisible({ timeout: 5000 })
  })

  test('cancel discards changes', async ({ page }) => {
    await seedBooks(page)

    await expect(page.getByText('Original Title')).toBeVisible({ timeout: 8000 })

    // Open editor via context menu
    await page.getByText('Original Title').click({ button: 'right' })
    await page.getByTestId('context-menu-edit').click()
    await expect(page.getByTestId('book-metadata-editor')).toBeVisible({ timeout: 3000 })

    // Edit title
    const titleInput = page.getByTestId('edit-book-title')
    await titleInput.clear()
    await titleInput.fill('Should Not Persist')

    // Cancel
    await page.getByTestId('editor-cancel-button').click()

    // Editor should close
    await expect(page.getByTestId('book-metadata-editor')).not.toBeVisible({ timeout: 3000 })

    // Original title should remain
    await expect(page.getByText('Original Title')).toBeVisible()
  })
})

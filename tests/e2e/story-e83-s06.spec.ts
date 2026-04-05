/**
 * E2E Tests: E83-S06 — Book Deletion with OPFS Cleanup
 *
 * Acceptance criteria covered:
 * - AC1: Delete confirmation dialog shows correct title and description
 * - AC2: Deleting a book removes it from the library view
 * - AC3: Success toast appears after deletion
 * - AC4: Book with no highlights can still be deleted
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_BOOKS = [
  {
    id: 'delete-test-book-1',
    title: 'TypeScript Handbook',
    author: 'Microsoft',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 40,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'delete-test-book-2',
    title: 'Clean Code',
    author: 'Robert Martin',
    format: 'epub',
    status: 'finished',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 100,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

const TEST_HIGHLIGHTS = [
  {
    id: 'highlight-1',
    bookId: 'delete-test-book-1',
    text: 'Types are great',
    color: 'yellow',
    cfiRange: '/4/2/1:0,/4/2/1:15',
    createdAt: FIXED_DATE,
  },
]

async function seedBooksAndHighlights(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    TEST_BOOKS as unknown as Record<string, unknown>[]
  )
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'bookHighlights',
    TEST_HIGHLIGHTS as unknown as Record<string, unknown>[]
  )
  await page.evaluate(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
  })
  await page.goto('/library')
}

test.describe('E83-S06: Book Deletion with OPFS Cleanup', () => {
  test('AC1: delete confirmation dialog shows book title', async ({ page }) => {
    await seedBooksAndHighlights(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Right-click to open context menu
    await page.getByText('TypeScript Handbook').click({ button: 'right' })
    await expect(page.getByTestId('context-menu-delete')).toBeVisible({ timeout: 3000 })

    // Click Delete
    await page.getByTestId('context-menu-delete').click()

    // Verify AlertDialog content
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('alertdialog')).toContainText('Delete')
    await expect(page.getByRole('alertdialog')).toContainText('TypeScript Handbook')
    await expect(page.getByRole('alertdialog')).toContainText(
      'This will remove the book and all its highlights'
    )
  })

  test('AC2+AC3: confirming deletion removes book and shows success toast', async ({ page }) => {
    await seedBooksAndHighlights(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Right-click → Delete → Confirm
    await page.getByText('TypeScript Handbook').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click({ timeout: 3000 })
    await page.getByTestId('confirm-delete-book').click({ timeout: 3000 })

    // Book should disappear from library
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible({ timeout: 5000 })

    // Other book still visible
    await expect(page.getByText('Clean Code')).toBeVisible()

    // Success toast
    await expect(page.getByText('TypeScript Handbook removed from your library')).toBeVisible({
      timeout: 5000,
    })
  })

  test('AC1b: cancel button closes dialog without deleting', async ({ page }) => {
    await seedBooksAndHighlights(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Right-click → Delete → Cancel
    await page.getByText('TypeScript Handbook').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click({ timeout: 3000 })
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 })

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog closed, book still visible
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(page.getByText('TypeScript Handbook')).toBeVisible()
  })

  test('AC4: book with no highlights can be deleted', async ({ page }) => {
    await seedBooksAndHighlights(page)

    await expect(page.getByText('Clean Code')).toBeVisible({ timeout: 8000 })

    // Clean Code has no highlights — delete it
    await page.getByText('Clean Code').click({ button: 'right' })
    await page.getByTestId('context-menu-delete').click({ timeout: 3000 })
    await page.getByTestId('confirm-delete-book').click({ timeout: 3000 })

    // Book should disappear
    await expect(page.getByText('Clean Code')).not.toBeVisible({ timeout: 5000 })

    // Success toast
    await expect(page.getByText('Clean Code removed from your library')).toBeVisible({
      timeout: 5000,
    })
  })
})

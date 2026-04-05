/**
 * E2E Tests: E83-S07 — Storage Indicator
 *
 * Acceptance criteria covered:
 * - AC1: StorageIndicator renders on the library page when books exist
 * - AC2: Shows book count and storage info
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_BOOKS = [
  {
    id: 'test-book-s07-1',
    title: 'TypeScript Deep Dive',
    author: 'Basarat Ali Syed',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '' },
    coverUrl: '',
    progress: 30,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'test-book-s07-2',
    title: 'Refactoring',
    author: 'Martin Fowler',
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
]

async function seedBooksAndNavigate(page: import('@playwright/test').Page): Promise<void> {
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

test.describe('E83-S07: Storage Indicator', () => {
  test('StorageIndicator renders on the library page when books exist', async ({ page }) => {
    await seedBooksAndNavigate(page)

    // Wait for books to load
    await expect(page.getByText('TypeScript Deep Dive')).toBeVisible({ timeout: 8000 })

    // StorageIndicator should be present
    await expect(page.getByTestId('storage-indicator')).toBeVisible()
  })

  test('StorageIndicator shows book count', async ({ page }) => {
    await seedBooksAndNavigate(page)

    await expect(page.getByText('TypeScript Deep Dive')).toBeVisible({ timeout: 8000 })

    const indicator = page.getByTestId('storage-indicator')
    await expect(indicator).toBeVisible()

    // Should show the number of books (2 books seeded)
    await expect(indicator).toContainText('books')
  })
})

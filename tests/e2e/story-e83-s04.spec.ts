/**
 * E2E Tests: E83-S04 — Library search, filters, and context menu
 *
 * Acceptance criteria covered:
 * - AC1: Library page loads and displays books
 * - AC2: Search input filters books by title
 * - AC3: Status pills filter books by reading status
 * - AC4: Context menu opens on right-click
 */
import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_BOOKS = [
  {
    id: 'test-book-1',
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
    id: 'test-book-2',
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
  {
    id: 'test-book-3',
    title: 'Design Patterns',
    author: 'Gang of Four',
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

test.describe('E83-S04: Library Search, Filters & Context Menu', () => {
  test('library page loads and displays books', async ({ page }) => {
    await seedBooks(page)

    // Wait for books to appear
    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Clean Code')).toBeVisible()
    await expect(page.getByText('Design Patterns')).toBeVisible()
  })

  test('search input filters books by title', async ({ page }) => {
    await seedBooks(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    const searchInput = page.getByTestId('library-search-input')
    await searchInput.fill('TypeScript')

    // Wait for debounce (300ms) and filtering
    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Clean Code')).not.toBeVisible()
    await expect(page.getByText('Design Patterns')).not.toBeVisible()
  })

  test('status pills filter books by reading status', async ({ page }) => {
    await seedBooks(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Click "Reading" filter pill
    const readingPill = page.getByTestId('filter-pill-reading')
    await readingPill.click()

    await expect(page.getByText('TypeScript Handbook')).toBeVisible()
    await expect(page.getByText('Clean Code')).not.toBeVisible()
    await expect(page.getByText('Design Patterns')).not.toBeVisible()

    // Click "All" to reset
    const allPill = page.getByTestId('filter-pill-all')
    await allPill.click()

    await expect(page.getByText('Clean Code')).toBeVisible()
  })

  test('context menu opens on right-click', async ({ page }) => {
    await seedBooks(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Right-click on the first book card
    await page.getByText('TypeScript Handbook').click({ button: 'right' })

    // Context menu should be visible
    await expect(page.getByTestId('context-menu-edit')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('context-menu-change-status')).toBeVisible()
    await expect(page.getByTestId('context-menu-delete')).toBeVisible()
  })
})

/**
 * E107-S01: Cover Image Display
 *
 * Verifies book cover images display correctly in Library grid view,
 * list view, and the audiobook player. Also validates placeholder
 * fallback when no cover is available.
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const DB_NAME = 'ElearningDB'

const TEST_BOOKS = [
  {
    id: 'cover-test-epub',
    title: 'EPUB With Cover',
    author: 'Test Author',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [{ title: 'Chapter 1', href: 'ch1.xhtml' }],
    source: { type: 'local', opfsPath: '/books/cover-test-epub' },
    coverUrl: 'https://picsum.photos/200/300',
    progress: 25,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'no-cover-epub',
    title: 'EPUB Without Cover',
    author: 'No Cover Author',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [{ title: 'Chapter 1', href: 'ch1.xhtml' }],
    source: { type: 'local', opfsPath: '/books/no-cover-epub' },
    coverUrl: '',
    progress: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

async function seedBooksAndNavigate(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ sidebarState }) => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value as string)
      })
    },
    { sidebarState: closeSidebar() }
  )
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    TEST_BOOKS as unknown as Record<string, unknown>[]
  )
  await page.goto('/library')
  await page.reload()
}

test.describe('E107-S01: Cover Image Display', () => {
  test('should display cover image in Library grid view', async ({ page }) => {
    await seedBooksAndNavigate(page)

    // Wait for the book with cover to appear
    await expect(page.getByText('EPUB With Cover')).toBeVisible({ timeout: 8000 })

    // The book card should render an img element with a valid src
    const bookCard = page.getByTestId('book-card-cover-test-epub')
    const coverImg = bookCard.locator('img')
    await expect(coverImg).toBeVisible()

    const src = await coverImg.getAttribute('src')
    expect(src).toMatch(/^(blob:|https?:|data:image\/)/)
  })

  test('should show placeholder when no cover available', async ({ page }) => {
    await seedBooksAndNavigate(page)

    await expect(page.getByText('EPUB Without Cover')).toBeVisible({ timeout: 8000 })

    // The book card without cover should NOT have an img element
    const bookCard = page.getByTestId('book-card-no-cover-epub')
    const coverImg = bookCard.locator('img')
    await expect(coverImg).toHaveCount(0)
  })

  test('should display cover image in Library list view', async ({ page }) => {
    await seedBooksAndNavigate(page)

    await expect(page.getByText('EPUB With Cover')).toBeVisible({ timeout: 8000 })

    // Switch to list view
    await page.getByRole('button', { name: 'List view' }).click()

    const listItem = page.getByTestId('book-list-item-cover-test-epub')
    await expect(listItem).toBeVisible()

    const coverImg = listItem.locator('img')
    await expect(coverImg).toBeVisible()

    const src = await coverImg.getAttribute('src')
    expect(src).toMatch(/^(blob:|https?:|data:image\/)/)
  })

  test('should show placeholder in list view when no cover available', async ({ page }) => {
    await seedBooksAndNavigate(page)

    await expect(page.getByText('EPUB Without Cover')).toBeVisible({ timeout: 8000 })

    // Switch to list view
    await page.getByRole('button', { name: 'List view' }).click()

    const listItem = page.getByTestId('book-list-item-no-cover-epub')
    await expect(listItem).toBeVisible()

    // No img should be rendered — placeholder icon shown instead
    const coverImg = listItem.locator('img')
    await expect(coverImg).toHaveCount(0)
  })
})

/**
 * E2E Tests for E108-S05: Genre Detection & Pages Goal
 *
 * Acceptance Criteria:
 * - AC-1: Genre filter chip visible in library sidebar
 * - AC-2: Genre filter narrows book list
 * - AC-3: Genre shown on book card (where available)
 * - AC-4: Pages goal ring displays in library header (pages mode)
 * - AC-5: Pages count updates after reading session
 */

import { test, expect } from '../../support/fixtures'
import { seedBooks } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const fictionBook = {
  id: 'test-fiction-e108-s05',
  title: 'A Tale of Two Cities',
  author: 'Charles Dickens',
  format: 'epub' as const,
  status: 'reading' as const,
  progress: 35,
  genre: 'Fiction',
  tags: ['Fiction', 'classic'],
  source: { type: 'local' as const, opfsPath: '/test/fiction.epub' },
  totalPages: 400,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const scienceBook = {
  id: 'test-science-e108-s05',
  title: 'A Brief History of Time',
  author: 'Stephen Hawking',
  format: 'epub' as const,
  status: 'reading' as const,
  progress: 20,
  genre: 'Science',
  tags: ['Science', 'physics'],
  source: { type: 'local' as const, opfsPath: '/test/science.epub' },
  totalPages: 212,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const noGenreBook = {
  id: 'test-no-genre-e108-s05',
  title: 'Untitled Draft',
  author: 'Unknown',
  format: 'epub' as const,
  status: 'unread' as const,
  progress: 0,
  genre: undefined,
  tags: [],
  source: { type: 'local' as const, opfsPath: '/test/draft.epub' },
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

test.describe('E108-S05: Genre Detection & Pages Goal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    await page.goto('/library')
    await seedBooks(page, [fictionBook, scienceBook, noGenreBook])
    await page.reload({ waitUntil: 'domcontentloaded' })
  })

  test('AC-1: Genre filter section is visible in filter sidebar', async ({ page }) => {
    // Open filter sidebar
    await page.getByTestId('filter-sidebar-trigger').click()
    await expect(page.getByTestId('filter-sidebar')).toBeVisible()

    // Genre section should be present with at least one genre button
    await expect(page.getByTestId('genre-filter-unset')).toBeVisible()
    await expect(page.getByTestId('genre-filter-fiction')).toBeVisible()
    await expect(page.getByTestId('genre-filter-science')).toBeVisible()
  })

  test('AC-2: Genre filter narrows book list to matching books', async ({ page }) => {
    // Initially all 3 books visible
    await expect(page.locator('[data-testid^="book-card-"]')).toHaveCount(3)

    // Open filter sidebar and select Fiction genre
    await page.getByTestId('filter-sidebar-trigger').click()
    await expect(page.getByTestId('filter-sidebar')).toBeVisible()
    await page.getByTestId('genre-filter-fiction').click()

    // Close sidebar (click outside or press escape)
    await page.keyboard.press('Escape')

    // Only fiction book should show
    await expect(page.locator('[data-testid^="book-card-"]')).toHaveCount(1)
    await expect(page.getByText('A Tale of Two Cities')).toBeVisible()
  })

  test('AC-2: Unset genre filter shows only books without genre', async ({ page }) => {
    // Open filter sidebar and select Unset
    await page.getByTestId('filter-sidebar-trigger').click()
    await expect(page.getByTestId('filter-sidebar')).toBeVisible()
    await page.getByTestId('genre-filter-unset').click()
    await page.keyboard.press('Escape')

    // Only the no-genre book should show
    await expect(page.locator('[data-testid^="book-card-"]')).toHaveCount(1)
    await expect(page.getByText('Untitled Draft')).toBeVisible()
  })

  test('AC-3: Genre badge shown on book card when genre is set', async ({ page }) => {
    // Books with genre should show the genre label
    const fictionCard = page.getByTestId('book-card-test-fiction-e108-s05')
    await expect(fictionCard.getByText('Fiction')).toBeVisible()

    const scienceCard = page.getByTestId('book-card-test-science-e108-s05')
    await expect(scienceCard.getByText('Science')).toBeVisible()
  })

  test('AC-4: Pages goal ring displays when pages goal is set', async ({ page }) => {
    // Set a pages reading goal
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune:reading-goals',
        JSON.stringify({
          dailyType: 'pages',
          dailyTarget: 30,
          yearlyBookTarget: 12,
          updatedAt: new Date().toISOString(),
        })
      )
    })

    // Reload to pick up the goal
    await page.reload({ waitUntil: 'domcontentloaded' })

    // The daily goal ring should be visible
    const goalRing = page.getByRole('img', { name: /daily reading goal/i })
    await expect(goalRing).toBeVisible()

    // Should show pages unit
    await expect(page.getByText(/pages/i).first()).toBeVisible()
  })

  test('AC-1: Active genre filter chip appears in filter bar', async ({ page }) => {
    // Select a genre filter
    await page.getByTestId('filter-sidebar-trigger').click()
    await expect(page.getByTestId('filter-sidebar')).toBeVisible()
    await page.getByTestId('genre-filter-science').click()
    await page.keyboard.press('Escape')

    // Active filter chip should show in the main content area (not the sidebar)
    await expect(page.getByLabel(/Remove Genre: Science filter/i).first()).toBeVisible()
  })
})

/**
 * E109-S04: Annotation Summary View — E2E tests
 *
 * Tests the per-book annotation summary page showing all highlights/notes
 * with statistics, color filtering, chapter grouping, and reader navigation.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedBookHighlights } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

const BOOK_ID = 'book-annotation-test'

async function seedAnnotationData(page: import('@playwright/test').Page, count = 5) {
  await seedBooks(page, [
    {
      id: BOOK_ID,
      title: 'Annotation Test Book',
      author: 'Test Author',
      format: 'epub',
      status: 'reading',
      progress: 75,
      createdAt: FIXED_DATE,
    },
  ])
  await seedBookHighlights(
    page,
    Array.from({ length: count }, (_, i) => ({
      id: `ann-highlight-${i}`,
      bookId: BOOK_ID,
      textAnchor: `Highlighted passage number ${i + 1} from the book`,
      color: (['yellow', 'green', 'blue', 'pink', 'yellow'] as const)[i % 5],
      chapterHref: i < 3 ? 'OEBPS/chapter1.xhtml' : 'OEBPS/chapter2.xhtml',
      note: i % 2 === 0 ? `Note for highlight ${i + 1}` : undefined,
      position: { type: 'epub-cfi', value: `/4/2/2[ch${i}]` },
      createdAt: getRelativeDate(-i),
    }))
  )
}

test.describe('Annotation Summary (E109-S04)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('shows empty state when book has no highlights', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [
      {
        id: BOOK_ID,
        title: 'Empty Book',
        author: 'No Highlights',
        format: 'epub',
        status: 'reading',
        progress: 0,
        createdAt: FIXED_DATE,
      },
    ])
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    await expect(page.getByTestId('annotation-summary-page')).toBeVisible()
    await expect(page.getByTestId('annotation-empty')).toBeVisible()
    await expect(page.getByText('No annotations yet')).toBeVisible()
  })

  test('displays statistics cards with correct counts', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 5)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    await expect(page.getByTestId('annotation-summary-page')).toBeVisible()
    await expect(page.getByTestId('annotation-stats')).toBeVisible()

    // 5 total highlights
    const statCards = page.getByTestId('annotation-stat-card')
    await expect(statCards).toHaveCount(3)
    await expect(page.getByText('5')).toBeVisible()
  })

  test('shows highlights grouped by chapter', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 5)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    // Should see both chapter groups
    await expect(page.getByText('chapter1')).toBeVisible()
    await expect(page.getByText('chapter2')).toBeVisible()

    // Should see all 5 highlight items
    const items = page.getByTestId('annotation-highlight-item')
    await expect(items).toHaveCount(5)
  })

  test('filters highlights by color when badge is clicked', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 5)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    // Click the yellow color badge (should have 2 yellow highlights)
    await page.getByTestId('annotation-color-badge-yellow').click()

    const items = page.getByTestId('annotation-highlight-item')
    await expect(items).toHaveCount(2)

    // Clear filter
    await page.getByTestId('annotation-clear-filter').click()
    await expect(items).toHaveCount(5)
  })

  test('has working reader navigation links', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 1)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    const readerLink = page.getByTestId('annotation-goto-reader').first()
    await expect(readerLink).toBeVisible()
    await expect(readerLink).toHaveAttribute('href', /\/library\/book-annotation-test\/read/)
  })

  test('back button navigates to library', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 1)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    await page.getByTestId('annotation-back-btn').click()
    await expect(page).toHaveURL(/\/library/)
  })

  test('export button opens export dialog', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedAnnotationData(page, 3)
    await navigateAndWait(page, `/library/${BOOK_ID}/annotations`)

    await page.getByTestId('annotation-export-btn').click()
    // HighlightExportDialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

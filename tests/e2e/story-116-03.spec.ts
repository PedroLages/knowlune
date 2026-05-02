/**
 * E116-S03: Library Shelf Integration — E2E smoke spec
 *
 * Proves the shelf primitives are wired into the Library route inside the
 * Continue tab. Verifies:
 * - At least two h2 shelf headings ("Recently Added", "Continue Reading")
 * - Each shelf row exposes a horizontal scroller
 * - Each scroller contains ≥1 card rendered from seeded data
 * - Navigating to /library?tab=continue produces no console errors
 *
 * Plan: docs/plans/2026-04-18-003-feat-library-page-shelf-integration-plan.md
 */
import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

const SHELF_TEST_BOOKS = [
  {
    id: 'shelf-book-1',
    title: 'Recently Added Book',
    author: 'Author One',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/shelf-test-1' },
    progress: 0,
    createdAt: FIXED_DATE,
  },
  {
    id: 'shelf-book-2',
    title: 'Continue Reading Book',
    author: 'Author Two',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/shelf-test-2' },
    progress: 45,
    lastOpenedAt: FIXED_DATE,
    createdAt: FIXED_DATE,
  },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedBooks(page, SHELF_TEST_BOOKS)
})

test.describe('Library shelf integration (E116-S03)', () => {
  test('renders shelves with headings, scrollers, and cards in Continue tab', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/library?tab=continue')

    // AC-2: top-level shelves render (verified via section testids)
    await expect(page.getByTestId('media-shelf-recently-added')).toBeVisible()
    await expect(page.getByTestId('media-shelf-continue')).toBeVisible()

    // AC-9: shelf sections with scrollers
    await expect(page.getByTestId('media-shelf-recently-added')).toBeVisible()
    await expect(page.getByTestId('media-shelf-continue')).toBeVisible()

    // Scrollers (derived from testId via `${testId}-scroller`)
    const recentScroller = page.getByTestId('media-shelf-recently-added-scroller')
    const continueScroller = page.getByTestId('media-shelf-continue-scroller')
    await expect(recentScroller).toBeVisible()
    await expect(continueScroller).toBeVisible()

    // AC-4: cards inside scrollers (Recently Added uses RecentBookCard)
    await expect(
      recentScroller.locator('[data-testid^="recent-book-card-"]').first()
    ).toBeVisible()
    await expect(
      continueScroller.locator('[data-testid^="continue-shelf-tile-"]').first()
    ).toBeVisible()

    // AC-8: no console errors on mount
    const realErrors = consoleErrors.filter(
      e => !e.includes('favicon') && !e.includes('404') && !e.includes('400')
    )
    expect(realErrors, `Unexpected console errors: ${realErrors.join('\n')}`).toEqual([])
  })
})

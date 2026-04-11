/**
 * E109-S02: Daily Highlight Review — E2E tests
 *
 * Tests the enhanced highlight review page with spaced-repetition rating
 * (keep/dismiss), daily digest prioritization, and navigation.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedBookHighlights } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

/** Seed highlight + book data into IndexedDB after app has initialized the schema */
async function seedHighlights(page: import('@playwright/test').Page, count = 3) {
  await seedBooks(page, [
    {
      id: 'book-test-1',
      title: 'Test Book',
      author: 'Test Author',
      format: 'epub',
      status: 'reading',
      progress: 50,
      createdAt: FIXED_DATE,
    },
  ])
  await seedBookHighlights(
    page,
    Array.from({ length: count }, (_, i) => ({
      id: `highlight-${i}`,
      bookId: 'book-test-1',
      textAnchor: `Test highlight passage number ${i + 1}`,
      color: 'yellow',
      position: { type: 'epub-cfi', value: `/4/2/2[ch${i}]` },
      createdAt: FIXED_DATE,
    }))
  )
}

test.describe('Daily Highlight Review (E109-S02)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('shows empty state when no highlights exist', async ({ page }) => {
    await navigateAndWait(page, '/highlight-review')
    await expect(page.getByTestId('highlight-review-empty')).toBeVisible()
    await expect(page.getByText('No highlights yet')).toBeVisible()
  })

  test('displays highlight cards with quote text and book metadata', async ({ page }) => {
    // Navigate first to init the DB schema, then seed
    await navigateAndWait(page, '/')
    await seedHighlights(page, 3)
    await navigateAndWait(page, '/highlight-review')

    await expect(page.getByTestId('highlight-review-page')).toBeVisible()
    await expect(page.getByTestId('highlight-review-quote')).toBeVisible()
    await expect(page.getByText(/Test highlight passage number/)).toBeVisible()
  })

  test('rating buttons are visible and can be clicked', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedHighlights(page, 2)
    await navigateAndWait(page, '/highlight-review')

    await expect(page.getByTestId('highlight-rating-controls')).toBeVisible()

    // Click "Keep" button
    const keepBtn = page.getByTestId('rating-keep-btn')
    await expect(keepBtn).toBeVisible()
    await keepBtn.click()
    await expect(keepBtn).toHaveAttribute('aria-pressed', 'true')

    // Click "Dismiss" button — should toggle
    const dismissBtn = page.getByTestId('rating-dismiss-btn')
    await dismissBtn.click()
    await expect(dismissBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(keepBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('can navigate between highlight cards', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedHighlights(page, 3)
    await navigateAndWait(page, '/highlight-review')

    // Should show counter
    await expect(page.getByText(/1 \/ 3/)).toBeVisible()

    // Click Next
    await page.getByTestId('review-next-btn').click()
    await expect(page.getByText(/2 \/ 3/)).toBeVisible()

    // Click Next again
    await page.getByTestId('review-next-btn').click()
    await expect(page.getByText(/3 \/ 3/)).toBeVisible()
  })

  test('page title says Daily Highlight Review', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedHighlights(page, 1)
    await navigateAndWait(page, '/highlight-review')

    await expect(page.getByText('Daily Highlight Review')).toBeVisible()
  })
})

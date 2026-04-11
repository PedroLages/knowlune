/**
 * E109-S05: Cross-book Search — E2E tests
 *
 * Tests full-text search across highlights and vocabulary items,
 * grouped by book, with filter tabs and navigation links.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedBookHighlights, seedVocabularyItems } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

const BOOK_A = 'book-search-a'
const BOOK_B = 'book-search-b'

async function seedSearchData(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: BOOK_A,
      title: 'Deep Work',
      author: 'Cal Newport',
      format: 'epub',
      status: 'reading',
      createdAt: FIXED_DATE,
    },
    {
      id: BOOK_B,
      title: 'Atomic Habits',
      author: 'James Clear',
      format: 'epub',
      status: 'completed',
      createdAt: FIXED_DATE,
    },
  ])

  await seedBookHighlights(page, [
    {
      id: 'h1',
      bookId: BOOK_A,
      textAnchor: 'Deep work is the ability to focus without distraction',
      color: 'yellow',
      note: 'Key definition of deep work concept',
      position: { type: 'epub-cfi', value: '/4/2/2[ch1]' },
      createdAt: getRelativeDate(-1),
    },
    {
      id: 'h2',
      bookId: BOOK_B,
      textAnchor: 'Habits are the compound interest of self-improvement',
      color: 'green',
      position: { type: 'epub-cfi', value: '/4/2/2[ch2]' },
      createdAt: getRelativeDate(-2),
    },
    {
      id: 'h3',
      bookId: BOOK_A,
      textAnchor: 'The ability to perform deep work is becoming rare',
      color: 'blue',
      position: { type: 'epub-cfi', value: '/4/2/2[ch3]' },
      createdAt: getRelativeDate(-3),
    },
  ])

  await seedVocabularyItems(page, [
    {
      id: 'v1',
      bookId: BOOK_A,
      word: 'distraction',
      definition: 'A thing that prevents someone from concentrating',
      masteryLevel: 1,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    {
      id: 'v2',
      bookId: BOOK_B,
      word: 'compound',
      definition: 'A thing composed of two or more elements',
      note: 'Related to habit stacking concept',
      masteryLevel: 0,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
  ])
}

test.describe('Cross-book Search (E109-S05)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('shows empty state before searching', async ({ page }) => {
    await navigateAndWait(page, '/search-annotations')
    await expect(page.getByTestId('search-annotations-page')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('searches highlights by text', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=deep+work')

    await expect(page.getByTestId('search-results')).toBeVisible()
    const highlightResults = page.getByTestId('highlight-result')
    await expect(highlightResults).toHaveCount(2)
  })

  test('searches vocabulary by word', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=distraction')

    await expect(page.getByTestId('search-results')).toBeVisible()
    // Should find highlight containing "distraction" AND vocabulary word "distraction"
    await expect(page.getByTestId('highlight-result')).toHaveCount(1)
    await expect(page.getByTestId('vocabulary-result')).toHaveCount(1)
  })

  test('filters by highlights only', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=distraction')

    await page.getByTestId('filter-highlights').click()
    await expect(page.getByTestId('highlight-result')).toHaveCount(1)
    await expect(page.getByTestId('vocabulary-result')).toHaveCount(0)
  })

  test('filters by vocabulary only', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=distraction')

    await page.getByTestId('filter-vocabulary').click()
    await expect(page.getByTestId('vocabulary-result')).toHaveCount(1)
    await expect(page.getByTestId('highlight-result')).toHaveCount(0)
  })

  test('groups results by book', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=compound')

    await expect(page.getByTestId('search-results')).toBeVisible()
    // "compound" matches vocabulary word in Book B and highlight text in Book B
    const bookGroups = page.getByTestId('book-group')
    await expect(bookGroups).toHaveCount(1)
    await expect(page.getByTestId('book-group-title')).toContainText('Atomic Habits')
  })

  test('shows no results for unmatched query', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=xyznonexistent')

    await expect(page.getByTestId('no-results')).toBeVisible()
  })

  test('clears search with clear button', async ({ page }) => {
    await navigateAndWait(page, '/search-annotations?q=deep')
    await page.getByTestId('clear-search').click()
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('searches highlight notes', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=key+definition')

    await expect(page.getByTestId('highlight-result')).toHaveCount(1)
  })

  test('searches vocabulary definitions', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedSearchData(page)
    await navigateAndWait(page, '/search-annotations?q=concentrating')

    await expect(page.getByTestId('vocabulary-result')).toHaveCount(1)
  })
})

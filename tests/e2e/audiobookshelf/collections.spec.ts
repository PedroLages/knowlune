/**
 * E2E Tests: E102-S03 — Collections Browsing
 *
 * Acceptance criteria covered:
 * - AC1: Collections tab visible in ABS view toggle
 * - AC2: Collections display with correct book count badge
 * - AC3: Expanding a collection card shows its books
 * - AC4: Empty state shown when no collections exist
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const ABS_SERVER = {
  id: 'abs-server-1',
  name: 'Home Server',
  url: 'http://abs.test:13378',
  apiKey: 'test-api-key',
  libraryIds: ['lib-1'],
  status: 'connected',
  lastSyncedAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const ABS_BOOKS = [
  {
    id: 'book-col-1',
    title: 'The Fellowship of the Ring',
    author: 'J.R.R. Tolkien',
    narrator: 'Rob Inglis',
    format: 'audiobook',
    status: 'finished',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/item-lotr-1' },
    coverUrl: '',
    absServerId: 'abs-server-1',
    absItemId: 'item-lotr-1',
    totalDuration: 72000,
    progress: 100,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'book-col-2',
    title: 'The Two Towers',
    author: 'J.R.R. Tolkien',
    narrator: 'Rob Inglis',
    format: 'audiobook',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/item-lotr-2' },
    coverUrl: '',
    absServerId: 'abs-server-1',
    absItemId: 'item-lotr-2',
    totalDuration: 68400,
    progress: 60,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

const MOCK_COLLECTIONS_RESPONSE = {
  results: [
    {
      id: 'col-1',
      name: 'Lord of the Rings',
      description: 'The classic fantasy trilogy',
      libraryId: 'lib-1',
      books: [
        {
          id: 'item-lotr-1',
          media: { metadata: { title: 'The Fellowship of the Ring', duration: 72000 } },
        },
        {
          id: 'item-lotr-2',
          media: { metadata: { title: 'The Two Towers', duration: 68400 } },
        },
      ],
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
  ],
  total: 1,
  page: 0,
  limit: 50,
}

/** Seeds state and navigates to the library page with mocked ABS endpoints. */
async function seedAndNavigate(
  page: import('@playwright/test').Page,
  collectionsResponse: unknown = MOCK_COLLECTIONS_RESPONSE
): Promise<void> {
  // Override window.fetch before any navigation so cross-origin ABS requests are intercepted.
  // page.route() does not reliably intercept cross-origin fetches in Chromium — using
  // addInitScript window.fetch override (established pattern for ABS mocking in this project).
  await page.addInitScript((mockCollectionsResponse: unknown) => {
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z' })
    )
    localStorage.setItem('knowlune-sidebar-v1', 'false')

    const originalFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('abs.test')) {
        if (url.includes('/api/libraries/') && url.includes('/collections')) {
          // Mock collections endpoint — the main target of these tests
          return Promise.resolve(
            new Response(JSON.stringify(mockCollectionsResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        if (url.includes('/api/libraries/') && url.includes('/items')) {
          // Mock items endpoint so syncCatalog does not mark server 'offline'.
          // An empty results list is sufficient — books are already seeded in IDB.
          return Promise.resolve(
            new Response(JSON.stringify({ results: [], total: 0 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
      }
      return originalFetch(input, init)
    }
  }, collectionsResponse)

  await page.goto('/')
  await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
    ABS_SERVER,
  ] as unknown as Record<string, unknown>[])
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    ABS_BOOKS as unknown as Record<string, unknown>[]
  )
  await page.goto('/library')
  await page.waitForLoadState('domcontentloaded')
}

test.describe('E102-S03: Collections Browsing', () => {
  test('collections tab is visible in ABS view toggle', async ({ page }) => {
    await seedAndNavigate(page)

    // Wait for books to load
    await expect(page.getByText('The Fellowship of the Ring')).toBeVisible({ timeout: 10000 })

    // Click ABS source tab
    await page.getByTestId('source-tab-audiobookshelf').click()

    // View toggle should include a collections option
    await expect(page.getByTestId('abs-view-toggle')).toBeVisible()
    await expect(page.getByTestId('abs-view-collections')).toBeVisible()
  })

  test('collections view displays collection with correct book count', async ({ page }) => {
    await seedAndNavigate(page)

    await expect(page.getByText('The Fellowship of the Ring')).toBeVisible({ timeout: 10000 })

    // Switch to ABS tab then collections view
    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-collections').click()

    // Collection card should be visible
    await expect(page.getByTestId('collection-card-col-1')).toBeVisible({ timeout: 10000 })

    // Collection name and book count
    await expect(page.getByText('Lord of the Rings')).toBeVisible()
    await expect(page.getByTestId('collection-count-col-1')).toHaveText('2')
  })

  test('expanding collection card shows its books', async ({ page }) => {
    await seedAndNavigate(page)

    await expect(page.getByText('The Fellowship of the Ring')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-collections').click()

    await expect(page.getByTestId('collection-card-col-1')).toBeVisible({ timeout: 10000 })

    // Click to expand
    await page.getByTestId('collection-toggle-col-1').click()

    // Books panel should be visible
    const booksPanel = page.getByTestId('collection-books-col-1')
    await expect(booksPanel).toBeVisible()

    // Both books should be listed
    await expect(booksPanel.getByText('The Fellowship of the Ring')).toBeVisible()
    await expect(booksPanel.getByText('The Two Towers')).toBeVisible()
  })

  test('empty state is shown when no collections exist', async ({ page }) => {
    const emptyResponse = { results: [], total: 0, page: 0, limit: 50 }
    await seedAndNavigate(page, emptyResponse)

    await expect(page.getByText('The Fellowship of the Ring')).toBeVisible({ timeout: 10000 })

    // Switch to ABS tab then collections view
    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-collections').click()

    // Empty state message should appear
    await expect(page.getByTestId('collections-empty-state')).toBeVisible({ timeout: 10000 })
  })
})

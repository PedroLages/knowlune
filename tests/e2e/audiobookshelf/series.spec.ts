/**
 * E2E Tests: E102-S02 — Series Browsing
 *
 * Acceptance criteria covered:
 * - AC1: Series view shows books grouped by series name, ordered by sequence
 * - AC2: Series progress shows "{completed} of {total} books complete"
 * - AC3: Tap series card expands to show books; next unfinished book highlighted
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

// Books matching the series below — some finished, some in progress
const ABS_BOOKS = [
  {
    id: 'book-expanse-1',
    title: 'Leviathan Wakes',
    author: 'James S.A. Corey',
    narrator: 'Jefferson Mays',
    format: 'audiobook',
    status: 'finished',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/item-1' },
    coverUrl: '',
    absServerId: 'abs-server-1',
    absItemId: 'item-1',
    totalDuration: 72000,
    progress: 100,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'book-expanse-2',
    title: "Caliban's War",
    author: 'James S.A. Corey',
    narrator: 'Jefferson Mays',
    format: 'audiobook',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/item-2' },
    coverUrl: '',
    absServerId: 'abs-server-1',
    absItemId: 'item-2',
    totalDuration: 68400,
    progress: 45,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'book-expanse-3',
    title: "Abaddon's Gate",
    author: 'James S.A. Corey',
    narrator: 'Jefferson Mays',
    format: 'audiobook',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/item-3' },
    coverUrl: '',
    absServerId: 'abs-server-1',
    absItemId: 'item-3',
    totalDuration: 64800,
    progress: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

// Mock series API response that will be intercepted
const MOCK_SERIES_RESPONSE = {
  results: [
    {
      id: 'series-1',
      name: 'The Expanse',
      nameIgnorePrefix: 'Expanse, The',
      type: 'series',
      books: [
        {
          id: 'item-1',
          sequence: '1',
          media: { metadata: { title: 'Leviathan Wakes', duration: 72000 } },
        },
        {
          id: 'item-2',
          sequence: '2',
          media: { metadata: { title: "Caliban's War", duration: 68400 } },
        },
        {
          id: 'item-3',
          sequence: '3',
          media: { metadata: { title: "Abaddon's Gate", duration: 64800 } },
        },
      ],
      totalDuration: 205200,
      addedAt: 1700000000,
      updatedAt: 1700000000,
    },
  ],
  total: 1,
  page: 0,
  limit: 50,
}

async function seedAndNavigate(page: import('@playwright/test').Page): Promise<void> {
  // Override window.fetch before any navigation so cross-origin ABS requests are intercepted.
  // page.route() does not reliably intercept cross-origin fetches in Chromium — using
  // addInitScript window.fetch override (established pattern for ABS mocking in this project).
  await page.addInitScript((mockSeriesResponse: unknown) => {
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
        if (url.includes('/api/libraries/') && url.includes('/series')) {
          // Mock series endpoint — the main target of these tests
          return Promise.resolve(
            new Response(JSON.stringify(mockSeriesResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        if (url.includes('/api/libraries/') && url.includes('/items')) {
          // Mock items endpoint so syncCatalog does not fail and mark server 'offline'.
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
  }, MOCK_SERIES_RESPONSE)

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

test.describe('E102-S02: Series Browsing', () => {
  test('series view toggle appears when ABS source tab is selected', async ({ page }) => {
    await seedAndNavigate(page)

    // Wait for books to load
    await expect(page.getByText('Leviathan Wakes')).toBeVisible({ timeout: 10000 })

    // Click ABS source tab
    await page.getByTestId('source-tab-audiobookshelf').click()

    // View toggle should appear
    await expect(page.getByTestId('abs-view-toggle')).toBeVisible()
    await expect(page.getByTestId('abs-view-grid')).toBeVisible()
    await expect(page.getByTestId('abs-view-series')).toBeVisible()
  })

  test('series view shows books grouped by series with progress', async ({ page }) => {
    await seedAndNavigate(page)

    await expect(page.getByText('Leviathan Wakes')).toBeVisible({ timeout: 10000 })

    // Switch to ABS tab then series view
    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-series').click()

    // Series card should be visible
    await expect(page.getByTestId('series-card-series-1')).toBeVisible({ timeout: 10000 })

    // Series name and progress
    await expect(page.getByText('The Expanse')).toBeVisible()
    await expect(page.getByText('3 books · 1/3 complete')).toBeVisible()
  })

  test('expanding series card shows books in sequence order with continue badge', async ({
    page,
  }) => {
    await seedAndNavigate(page)

    await expect(page.getByText('Leviathan Wakes')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-series').click()

    await expect(page.getByTestId('series-card-series-1')).toBeVisible({ timeout: 10000 })

    // Click to expand
    await page.getByTestId('series-toggle-series-1').click()

    // Books should be visible in the expanded panel
    const booksPanel = page.getByTestId('series-books-series-1')
    await expect(booksPanel).toBeVisible()

    // All three books should be listed
    await expect(booksPanel.getByText('Leviathan Wakes')).toBeVisible()
    await expect(booksPanel.getByText("Caliban's War")).toBeVisible()
    await expect(booksPanel.getByText("Abaddon's Gate")).toBeVisible()

    // Sequence numbers
    await expect(booksPanel.getByText('#1')).toBeVisible()
    await expect(booksPanel.getByText('#2')).toBeVisible()
    await expect(booksPanel.getByText('#3')).toBeVisible()

    // "Continue" badge on the next unfinished book (Caliban's War, item-2)
    await expect(page.getByTestId('continue-badge-item-2')).toBeVisible()
  })

  test('empty series state shows message', async ({ page }) => {
    // Override window.fetch before any navigation (same cross-origin pattern as seedAndNavigate)
    await page.addInitScript(() => {
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
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (url.includes('abs.test')) {
          if (url.includes('/api/libraries/') && url.includes('/series')) {
            // Empty series response — tests the empty state UI
            return Promise.resolve(
              new Response(JSON.stringify({ results: [], total: 0, page: 0, limit: 50 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            )
          }
          if (url.includes('/api/libraries/') && url.includes('/items')) {
            // Mock items endpoint so syncCatalog does not mark server 'offline'
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
    })

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

    await expect(page.getByText('Leviathan Wakes')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('source-tab-audiobookshelf').click()
    await page.getByTestId('abs-view-series').click()

    await expect(page.getByTestId('series-empty-state')).toBeVisible({ timeout: 10000 })
  })
})

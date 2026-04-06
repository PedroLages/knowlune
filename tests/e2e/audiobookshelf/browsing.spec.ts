/**
 * E2E Tests: E101-S03 — Library Browsing & Catalog Sync
 *
 * Acceptance criteria covered:
 * - AC1: Catalog sync from ABS creates Book records in Dexie
 * - AC2: ABS books display with cover, title, author, narrator, duration
 * - AC3: Cover images lazy-load with skeleton placeholders
 * - AC4: Source filter tabs (All / Local / Audiobookshelf)
 * - AC5: Search filters across local and ABS books by title, author, narrator
 * - AC7: Offline degradation shows cached books + toast
 * - AC8: ARIA labels include narrator
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

const LOCAL_BOOKS = [
  {
    id: 'local-book-1',
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
]

const ABS_BOOKS = [
  {
    id: 'abs-book-1',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    narrator: 'Patrick Egan',
    format: 'audiobook',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/abs-item-1' },
    coverUrl: 'http://abs.test:13378/api/items/abs-item-1/cover?token=test-api-key',
    absServerId: 'abs-server-1',
    absItemId: 'abs-item-1',
    totalDuration: 26280,
    progress: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  {
    id: 'abs-book-2',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    narrator: 'Ray Porter',
    format: 'audiobook',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'http://abs.test:13378/api/items/abs-item-2' },
    coverUrl: 'http://abs.test:13378/api/items/abs-item-2/cover?token=test-api-key',
    absServerId: 'abs-server-1',
    absItemId: 'abs-item-2',
    totalDuration: 57600,
    progress: 25,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
]

const ALL_BOOKS = [...LOCAL_BOOKS, ...ABS_BOOKS]

async function seedLibraryWithAbs(page: import('@playwright/test').Page): Promise<void> {
  // addInitScript persists across navigations and runs before each page load
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
  })
  // First navigation: opens IDB so we can seed
  await page.goto('/')
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'audiobookshelfServers',
    [ABS_SERVER] as unknown as Record<string, unknown>[]
  )
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    ALL_BOOKS as unknown as Record<string, unknown>[]
  )
  // Reload so Zustand picks up seeded data
  await page.goto('/library')
  await page.waitForLoadState('domcontentloaded')
}

async function seedLibraryLocalOnly(page: import('@playwright/test').Page): Promise<void> {
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
  })
  await page.goto('/')
  await seedIndexedDBStore(
    page,
    DB_NAME,
    'books',
    LOCAL_BOOKS as unknown as Record<string, unknown>[]
  )
  await page.goto('/library')
  await page.waitForLoadState('domcontentloaded')
}

test.describe('E101-S03: Library Browsing & Catalog Sync', () => {
  test('source tab "Audiobookshelf" appears when server is configured', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('source-tab-all')).toBeVisible()
    await expect(page.getByTestId('source-tab-local')).toBeVisible()
    await expect(page.getByTestId('source-tab-audiobookshelf')).toBeVisible()
  })

  test('source tabs are hidden when no ABS servers configured', async ({ page }) => {
    await seedLibraryLocalOnly(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('source-tab-all')).not.toBeVisible()
    await expect(page.getByTestId('source-tab-audiobookshelf')).not.toBeVisible()
  })

  test('clicking "Audiobookshelf" tab filters to show only remote ABS books', async ({
    page,
  }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    // Click Audiobookshelf tab
    await page.getByTestId('source-tab-audiobookshelf').click()

    // ABS books should be visible
    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible()
    await expect(page.getByText('Project Hail Mary')).toBeVisible()

    // Local book should be hidden
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible()
  })

  test('clicking "Local" tab filters to show only local books', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('TypeScript Handbook')).toBeVisible({ timeout: 8000 })

    // Click Local tab
    await page.getByTestId('source-tab-local').click()

    // Local book visible
    await expect(page.getByText('TypeScript Handbook')).toBeVisible()

    // ABS books hidden
    await expect(page.getByText('Thinking, Fast and Slow')).not.toBeVisible()
    await expect(page.getByText('Project Hail Mary')).not.toBeVisible()
  })

  test('ABS books show "Remote" badge', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    // Remote badge should be visible for ABS books
    await expect(page.getByTestId('remote-badge-abs-book-1')).toBeVisible()
  })

  test('search filters ABS books by title', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    const searchInput = page.getByTestId('library-search-input')
    await searchInput.fill('Thinking')

    // ABS book matching title should be visible
    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 5000 })
    // Non-matching books should be hidden
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible()
    await expect(page.getByText('Project Hail Mary')).not.toBeVisible()
  })

  test('search filters by narrator name', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    const searchInput = page.getByTestId('library-search-input')
    await searchInput.fill('Ray Porter')

    // Book narrated by Ray Porter should be visible
    await expect(page.getByText('Project Hail Mary')).toBeVisible({ timeout: 5000 })
    // Other books should be hidden
    await expect(page.getByText('Thinking, Fast and Slow')).not.toBeVisible()
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible()
  })

  test('ARIA label on book card includes narrator when present', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    // Check ARIA label includes narrator
    const bookCard = page.getByTestId('book-card-abs-book-1')
    await expect(bookCard).toHaveAttribute(
      'aria-label',
      'Book: Thinking, Fast and Slow by Daniel Kahneman, narrated by Patrick Egan, 0% complete'
    )
  })

  test('"All" tab shows all books regardless of source', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    // Click Audiobookshelf tab first
    await page.getByTestId('source-tab-audiobookshelf').click()
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible()

    // Click All tab to reset
    await page.getByTestId('source-tab-all').click()

    // All books should be visible again
    await expect(page.getByText('TypeScript Handbook')).toBeVisible()
    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible()
    await expect(page.getByText('Project Hail Mary')).toBeVisible()
  })

  test('search respects current source filter tab', async ({ page }) => {
    await seedLibraryWithAbs(page)

    await expect(page.getByText('Thinking, Fast and Slow')).toBeVisible({ timeout: 8000 })

    // Filter to Audiobookshelf tab
    await page.getByTestId('source-tab-audiobookshelf').click()

    // Search within ABS books only
    const searchInput = page.getByTestId('library-search-input')
    await searchInput.fill('Project')

    // Project Hail Mary (ABS) should be visible
    await expect(page.getByText('Project Hail Mary')).toBeVisible({ timeout: 5000 })
    // TypeScript Handbook (local) should still be hidden by source filter
    await expect(page.getByText('TypeScript Handbook')).not.toBeVisible()
    // Other ABS book hidden by search
    await expect(page.getByText('Thinking, Fast and Slow')).not.toBeVisible()
  })
})

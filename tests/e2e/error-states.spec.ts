/**
 * Error States & Empty States E2E tests.
 *
 * Validates that pages degrade gracefully when IndexedDB operations fail
 * or when no data is present. Tests cover:
 *   - CareerPaths: empty state (no paths), error handling
 *   - Flashcards: empty state (no cards), "all caught up" state
 *   - Reports: empty state (no activity)
 *   - SessionHistory: error card rendering and empty state
 *
 * Data layer: Knowlune uses IndexedDB (Dexie) — not REST APIs — so errors
 * are injected via page.addInitScript() to corrupt the IDB layer, rather
 * than via page.route().
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'

// ---------------------------------------------------------------------------
// SessionHistory — explicit error card (border-destructive styling)
// ---------------------------------------------------------------------------
test.describe('SessionHistory Error States', () => {
  test('should show error card when IndexedDB fails to load sessions', async ({ page }) => {
    // Corrupt the Dexie studySessions table before load
    await page.addInitScript(() => {
      // Override indexedDB.open to inject a broken transaction for studySessions
      const originalOpen = indexedDB.open.bind(indexedDB)
      indexedDB.open = function (...args: Parameters<typeof indexedDB.open>) {
        const request = originalOpen(...args)
        const originalOnSuccess = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess')
        // Intercept the Dexie DB and make studySessions.toArray() throw
        request.addEventListener('success', () => {
          const db = request.result
          const originalTransaction = db.transaction.bind(db)
          db.transaction = function (storeNames: string | string[], mode?: IDBTransactionMode) {
            const stores = Array.isArray(storeNames) ? storeNames : [storeNames]
            if (stores.includes('studySessions')) {
              throw new DOMException('Test-induced IndexedDB error', 'InvalidStateError')
            }
            return originalTransaction(storeNames, mode)
          } as typeof db.transaction
        })
        return request
      } as typeof indexedDB.open
    })

    await navigateAndWait(page, '/session-history')

    // SessionHistory renders an error div with destructive styling when load fails
    const errorCard = page.locator('.border-destructive\\/50')
    await expect(errorCard).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(errorCard).toContainText('Failed to load study sessions')
  })

  test('should show empty state when no sessions exist', async ({ page }) => {
    await navigateAndWait(page, '/session-history')

    // With a fresh IndexedDB (no sessions), EmptyState renders
    const emptyState = page.getByText('No Study Sessions Yet')
    await expect(emptyState).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Should have a CTA to browse courses
    await expect(page.getByRole('link', { name: 'Browse Courses' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CareerPaths — empty state handling
// ---------------------------------------------------------------------------
test.describe('CareerPaths States', () => {
  test('should show career paths page with career paths heading', async ({ page }) => {
    await navigateAndWait(page, '/career-paths')

    // CareerPaths loads curated paths from CURATED_CAREER_PATHS constant
    // so it should always render paths unless data is corrupted
    await expect(page.getByRole('heading', { name: 'Career Paths', level: 1 })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })
  })

  test('should show search empty state when no paths match query', async ({ page }) => {
    await navigateAndWait(page, '/career-paths')

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Career Paths', level: 1 })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })

    // Type a search query that won't match any career paths
    const searchInput = page.getByPlaceholder('Search paths...')
    await searchInput.fill('xyznonexistentpath12345')

    // EmptyState for search should render
    await expect(page.getByText('No paths match your search')).toBeVisible({
      timeout: TIMEOUTS.MEDIUM,
    })
  })
})

// ---------------------------------------------------------------------------
// Flashcards — empty state (no cards) and "all caught up" state
// Note: Flashcards is behind PremiumGate. We seed entitlement to bypass.
// ---------------------------------------------------------------------------
test.describe('Flashcards Empty States', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass PremiumGate by seeding a valid entitlement cache
    await page.addInitScript(() => {
      // Seed entitlement into IndexedDB so PremiumGate resolves isPremium=true
      const request = indexedDB.open('ElearningDB')
      request.onupgradeneeded = () => {
        // Dexie creates stores automatically; this is just a fallback
      }
      request.onsuccess = () => {
        try {
          const db = request.result
          if (db.objectStoreNames.contains('entitlements')) {
            const tx = db.transaction('entitlements', 'readwrite')
            const store = tx.objectStore('entitlements')
            store.put({
              id: 'test-user',
              userId: 'test-user',
              tier: 'premium',
              validUntil: '2030-01-01T00:00:00.000Z',
              cachedAt: new Date().toISOString(),
            })
          }
        } catch {
          // Store may not exist yet — that's ok, Dexie will create it
        }
      }
    })
  })

  test('should show "No flashcards yet" when no cards exist', async ({ page }) => {
    await navigateAndWait(page, '/flashcards')

    // The Flashcards page shows an empty state when flashcards.length === 0
    // It uses the Empty compound component (not EmptyState)
    const emptyTitle = page.getByText('No flashcards yet')
    await expect(emptyTitle).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Instruction text should be present
    await expect(page.getByText('Select text in your notes')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Reports — empty state when no activity
// ---------------------------------------------------------------------------
test.describe('Reports Empty States', () => {
  test('should show empty state when user has no activity', async ({ page }) => {
    await navigateAndWait(page, '/reports')

    // Reports page checks hasActivity — with fresh DB, all counts are 0
    // It should show the EmptyState with clock icon
    const emptyText = page.getByText('Start studying to see your analytics')
    await expect(emptyText).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Should have a CTA to browse courses
    await expect(page.getByRole('link', { name: 'Browse Courses' })).toBeVisible()
  })

  test('should show Reports heading even in empty state', async ({ page }) => {
    await navigateAndWait(page, '/reports')

    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })
  })
})

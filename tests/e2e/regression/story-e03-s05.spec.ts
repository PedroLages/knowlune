/**
 * Story 3.5: Full-Text Note Search — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: MiniSearch returns results via Cmd+K with snippets, tags, relevance ranking
 *   - AC2: Fuzzy matching and prefix search handle typos and partial queries
 *   - AC3: Clicking a note result navigates to Lesson Player with ?panel=notes
 *   - AC4: Empty results show helpful message
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

/** Seed notes directly into IndexedDB for search tests.
 *  Must be called after navigateAndWait so the DB and stores exist. */
async function seedNotes(
  page: Parameters<typeof navigateAndWait>[0],
  notes: Array<{
    id: string
    courseId: string
    videoId: string
    content: string
    tags: string[]
    timestamp?: number
    createdAt: string
    updatedAt: string
  }>
) {
  await page.evaluate(
    async ({ dbName, storeName, data }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            reject(new Error(`Store "${storeName}" not found — was the app loaded first?`))
            return
          }
          const tx = db.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          for (const item of data) store.put(item)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: 'ElearningDB', storeName: 'notes', data: notes }
  )
}

const TEST_NOTES = [
  {
    id: 'note-search-1',
    courseId: 'operative-six',
    videoId: 'op6-introduction',
    content:
      'Understanding custom hooks in React allows us to extract component logic into reusable functions.',
    tags: ['react', 'hooks'],
    timestamp: 42,
    createdAt: '2026-02-20T10:00:00Z',
    updatedAt: '2026-02-20T10:00:00Z',
  },
  {
    id: 'note-search-2',
    courseId: 'operative-six',
    videoId: 'op6-pillars-of-influence',
    content:
      'JavaScript closures capture variables from their enclosing scope, enabling powerful patterns.',
    tags: ['javascript', 'closures'],
    createdAt: '2026-02-21T10:00:00Z',
    updatedAt: '2026-02-21T10:00:00Z',
  },
  {
    id: 'note-search-3',
    courseId: 'operative-six',
    videoId: 'op6-introduction',
    content:
      'TypeScript generics provide type safety while maintaining flexibility in function signatures.',
    tags: ['typescript', 'generics'],
    createdAt: '2026-02-22T10:00:00Z',
    updatedAt: '2026-02-22T10:00:00Z',
  },
]

/** Navigate to overview, suppress sidebar, seed notes, reload to pick up data. */
async function setupWithNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, '/')
  await seedNotes(page, TEST_NOTES)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Clear seeded notes from IndexedDB to prevent test pollution. */
async function clearSeededNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (db.objectStoreNames.contains('notes')) {
          const tx = db.transaction('notes', 'readwrite')
          tx.objectStore('notes').clear()
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            resolve()
          }
        } else {
          db.close()
          resolve()
        }
      }
      request.onerror = () => resolve()
    })
  })
}

/** Open the command palette via keyboard shortcut. */
async function openCommandPalette(page: Parameters<typeof navigateAndWait>[0]) {
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.LONG })
}

// ---------------------------------------------------------------------------
// AC1: Search results with snippets, tags, and relevance ranking
// ---------------------------------------------------------------------------
test.describe('AC1: Search results via Cmd+K command palette', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await setupWithNotes(page)
  })

  test.afterEach(async ({ page }) => {
    await clearSeededNotes(page)
  })

  test('Cmd+K opens search and typing a query returns matching notes', async ({ page }) => {
    await openCommandPalette(page)

    // Type a query that should match note content
    await page.keyboard.type('custom hooks')

    // Notes group should appear with matching results
    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Result should show snippet with matching content
    const noteResult = notesGroup.getByRole('option').first()
    await expect(noteResult).toBeVisible()
    await expect(noteResult).toContainText(/custom hooks/i)
  })

  test('results show note snippet, course name, and tag badges', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.type('react')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    const noteResult = notesGroup.getByRole('option').first()
    // Result should contain tag badge
    await expect(noteResult).toContainText(/react/i)
    // Result should show course context
    await expect(noteResult).toContainText(/operative/i)
    // Result should show video title
    await expect(noteResult).toContainText(/introduction/i)
  })

  test('results highlight matching keywords with mark elements', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.type('react')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Matching keywords should be wrapped in <mark> elements
    const marks = notesGroup.locator('mark')
    await expect(marks.first()).toBeVisible()
    await expect(marks.first()).toHaveText(/react/i)
  })

  test('results are ranked by relevance — tag matches rank higher', async ({ page }) => {
    await openCommandPalette(page)

    // Search for "react" — note-search-1 has tag "react" (boosted 2x), should rank first
    await page.keyboard.type('react')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    const results = notesGroup.getByRole('option')
    const firstResult = results.first()
    // The note with the "react" tag should appear first due to 2x boost
    await expect(firstResult).toContainText(/hooks/i)
  })
})

// ---------------------------------------------------------------------------
// AC2: Fuzzy matching and prefix search
// ---------------------------------------------------------------------------
test.describe('AC2: Fuzzy matching and prefix search', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await setupWithNotes(page)
  })

  test.afterEach(async ({ page }) => {
    await clearSeededNotes(page)
  })

  test('fuzzy matching finds results despite typos', async ({ page }) => {
    await openCommandPalette(page)

    // "custm hooks" has a typo — should still find "custom hooks"
    await page.keyboard.type('custm hooks')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    const results = notesGroup.getByRole('option')
    await expect(results.first()).toBeVisible()
  })

  test('prefix search matches partial queries', async ({ page }) => {
    await openCommandPalette(page)

    // "java" should match "javascript" via prefix search
    await page.keyboard.type('java')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    const results = notesGroup.getByRole('option')
    await expect(results.first()).toContainText(/javascript/i)
  })
})

// ---------------------------------------------------------------------------
// AC3: Clicking a result navigates to Lesson Player with ?panel=notes
// ---------------------------------------------------------------------------
test.describe('AC3: Result navigation to Lesson Player', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await setupWithNotes(page)
  })

  test.afterEach(async ({ page }) => {
    await clearSeededNotes(page)
  })

  test('clicking a note result opens the Lesson Player with notes panel', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.type('custom hooks')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Click the first note result
    await notesGroup.getByRole('option').first().click()

    // Should navigate to Lesson Player with ?panel=notes
    await page.waitForURL(/\/courses\/.*\?panel=notes/, { timeout: TIMEOUTS.NETWORK })
    expect(page.url()).toContain('panel=notes')

    // Verify notes panel is actually open in the DOM
    const notesToggle = page.getByRole('button', { name: 'Notes', exact: true })
    await expect(notesToggle).toHaveAttribute('aria-expanded', 'true', { timeout: TIMEOUTS.LONG })
  })

  test('note with timestamp seeks video to that position', async ({ page }) => {
    await openCommandPalette(page)
    await page.keyboard.type('custom hooks')

    const notesGroup = page.getByRole('group', { name: /notes/i })
    await expect(notesGroup).toBeVisible({ timeout: TIMEOUTS.LONG })

    await notesGroup.getByRole('option').first().click()

    // URL should include the timestamp parameter (note has timestamp: 42)
    await page.waitForURL(/\/courses\/.*t=42/, { timeout: TIMEOUTS.NETWORK })
    expect(page.url()).toContain('t=42')
  })
})

// ---------------------------------------------------------------------------
// AC4: Empty results message
// ---------------------------------------------------------------------------
test.describe('AC4: Empty results show helpful message', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await setupWithNotes(page)
  })

  test.afterEach(async ({ page }) => {
    await clearSeededNotes(page)
  })

  test('searching for non-existent content shows empty state', async ({ page }) => {
    await openCommandPalette(page)

    // Search for something that doesn't exist in any notes
    await page.keyboard.type('xyznonexistentquery123')

    // Should show the exact empty state message from CommandEmpty
    await expect(
      page.getByText('No results found. Try different keywords or browse by tag.')
    ).toBeVisible({ timeout: TIMEOUTS.LONG })
  })
})

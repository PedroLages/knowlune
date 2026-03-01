/**
 * Story 3.8: Global Notes Dashboard — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Notes page displays all notes across courses with context
 *   - AC2: Full-text search filters notes in real-time with highlights
 *   - AC3: Tag-based filtering with AND semantics when combined with search
 *   - AC4: Sort controls (Most Recent, Oldest First, By Course)
 *   - AC5: Expand note card with full content and "Open in Lesson" navigation
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const NOTES_URL = '/notes'

/** Suppress sidebar overlay and navigate to Notes page. */
async function goToNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, NOTES_URL)
}

/** Seed notes into IndexedDB across two courses (with retry for Dexie init). */
async function seedNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(async () => {
    const notes = [
      {
        id: 'global-note-1',
        courseId: 'operative-six',
        videoId: 'op6-introduction',
        content: '<p>Introduction notes about the operative training program.</p>',
        timestamp: 30,
        createdAt: '2026-02-18T10:00:00.000Z',
        updatedAt: '2026-02-28T10:00:00.000Z',
        tags: ['overview', 'training'],
      },
      {
        id: 'global-note-2',
        courseId: 'operative-six',
        videoId: 'op6-pillars-of-influence',
        content: '<p>Key takeaways from the pillars of influence lesson.</p>',
        timestamp: 120,
        createdAt: '2026-02-19T14:30:00.000Z',
        updatedAt: '2026-02-27T09:00:00.000Z',
        tags: ['influence', 'psychology'],
      },
      {
        id: 'global-note-3',
        courseId: 'authority',
        videoId: 'authority-lesson-01-communication-laws',
        content: '<p>Communication laws and strategies for authority building.</p>',
        timestamp: 60,
        createdAt: '2026-02-20T08:00:00.000Z',
        updatedAt: '2026-02-26T15:00:00.000Z',
        tags: ['communication', 'training'],
      },
      {
        id: 'global-note-4',
        courseId: 'authority',
        videoId: 'authority-lesson-02-composure-confidence',
        content: '<p>Composure techniques and confidence building exercises.</p>',
        timestamp: 45,
        createdAt: '2026-02-21T11:00:00.000Z',
        updatedAt: '2026-02-25T12:00:00.000Z',
        tags: ['confidence', 'psychology'],
      },
    ]

    const maxRetries = 10
    const retryDelay = 200

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('notes')) {
            db.close()
            resolve('store-missing')
            return
          }
          const tx = db.transaction('notes', 'readwrite')
          const store = tx.objectStore('notes')
          for (const note of notes) {
            store.put(note)
          }
          tx.oncomplete = () => { db.close(); resolve('ok') }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
        request.onerror = () => reject(request.error)
      })
      if (result === 'ok') return
      await new Promise(r => setTimeout(r, retryDelay))
    }
    throw new Error('notes store not found in ElearningDB after 10 retries')
  })
}

/** Clear all notes from IndexedDB. */
async function clearNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('notes')) {
          db.close()
          resolve()
          return
        }
        const tx = db.transaction('notes', 'readwrite')
        tx.objectStore('notes').clear()
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      request.onerror = () => reject(request.error)
    })
  })
}

test.describe('AC1: Notes page displays all notes across courses', () => {
  test('navigates to Notes page via sidebar', async ({ page }) => {
    await goToNotes(page)

    // Notes nav link should be active
    const navLink = page.getByRole('link', { name: /notes/i })
    await expect(navLink).toBeVisible()
  })

  test('displays note cards with course context', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Total note count in header
    await expect(page.getByText(/my notes/i)).toBeVisible()
    await expect(page.getByText('(4)')).toBeVisible()

    // Note cards show course title, lesson title, content preview, tags, date
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.filter({ hasText: 'Operative Six' })).toHaveCount(2)
    await expect(noteCards.filter({ hasText: 'Authority' })).toHaveCount(2)
    await expect(noteCards.filter({ hasText: /introduction notes about/i }).first()).toBeVisible()
    await expect(noteCards.filter({ hasText: /communication laws and strategies/i }).first()).toBeVisible()
  })

  test('notes are sorted by most recently updated first', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // First card should be the most recently updated note (global-note-1, Feb 28)
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.first()).toContainText(/introduction notes about/i)
  })

  test('shows tags as badges on note cards', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Tags appear in both the filter bar and on note cards — scope to cards
    const cards = page.locator('[data-testid="note-card"]')
    await expect(cards.filter({ hasText: 'overview' }).first()).toBeVisible()
    await expect(cards.filter({ hasText: 'training' }).first()).toBeVisible()
    await expect(cards.filter({ hasText: 'influence' }).first()).toBeVisible()
    await expect(cards.filter({ hasText: 'psychology' }).first()).toBeVisible()
  })

  test('shows empty state when no notes exist', async ({ page }) => {
    await goToNotes(page)
    await clearNotes(page)
    await page.reload()

    await expect(page.getByText(/no notes/i)).toBeVisible()
  })
})

test.describe('AC2: Full-text search filters notes in real-time', () => {
  test('search input filters notes by content', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await searchInput.fill('influence')

    // Should show the pillars of influence note (text appears in lesson title and content)
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.filter({ hasText: /pillars of influence/i }).first()).toBeVisible()

    // Should NOT show unrelated notes
    await expect(noteCards.filter({ hasText: /composure techniques/i })).toHaveCount(0)
  })

  test('highlights matching terms in search results', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await searchInput.fill('influence')

    // Highlighted matches should use <mark> elements
    await expect(page.locator('mark').filter({ hasText: /influence/i })).toBeVisible()
  })

  test('shows no results empty state', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await searchInput.fill('xyznonexistent')

    await expect(page.getByText(/no results/i)).toBeVisible()
  })
})

test.describe('AC3: Tag-based filtering', () => {
  test('clicking a tag badge filters notes to that tag', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Click the "psychology" tag
    await page.getByText('psychology').first().click()

    // Should show notes with "psychology" tag (note-2 and note-4)
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.filter({ hasText: /pillars of influence/i }).first()).toBeVisible()
    await expect(noteCards.filter({ hasText: /composure techniques/i }).first()).toBeVisible()

    // Should NOT show notes without "psychology" tag
    await expect(noteCards.filter({ hasText: /introduction notes about/i })).toHaveCount(0)
  })

  test('active tag filter is visually indicated', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Click a tag in the filter bar
    await page.getByText('training').first().click()

    // Active tag should have distinct styling (blue background) — scope to filter bar
    const filterBar = page.getByRole('group', { name: /filter by tag/i })
    const activeChip = filterBar.locator('[data-active="true"]')
    await expect(activeChip.filter({ hasText: 'training' })).toBeVisible()
  })

  test('clearing tag filter returns all notes', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Scope clicks to the filter bar to avoid ambiguity with note card content
    const filterBar = page.getByRole('group', { name: /filter by tag/i })

    // Activate filter
    await filterBar.getByText('training').click()
    // Click again to deactivate
    await filterBar.getByText('training').click()

    // All 4 notes should be visible again
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards).toHaveCount(4)
  })

  test('tag filter AND search combine with AND semantics', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Filter by "training" tag (matches note-1 and note-3)
    await page.getByText('training').first().click()

    // Then search for "operative" (matches only note-1 from "training" tagged notes)
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i))
    await searchInput.fill('operative')

    // Only note-1 should match both criteria
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.filter({ hasText: /introduction notes about/i }).first()).toBeVisible()
    await expect(noteCards.filter({ hasText: /communication laws/i })).toHaveCount(0)
  })
})

test.describe('AC4: Sort controls', () => {
  test('sort dropdown displays with default "Most Recent"', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    const sortTrigger = page.getByRole('combobox')
    await expect(sortTrigger).toBeVisible()
    await expect(sortTrigger).toContainText(/most recent/i)
  })

  test('sorting by "Oldest First" reverses order', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Open sort dropdown and select Oldest First
    const sortTrigger = page.getByRole('combobox')
    await sortTrigger.click()
    await page.getByText(/oldest first/i).click()

    // First card should now be the oldest updated note (global-note-4, Feb 25)
    const noteCards = page.locator('[data-testid="note-card"]')
    await expect(noteCards.first()).toContainText(/composure techniques/i)
  })

  test('sorting by "By Course" groups notes under course headings', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Open sort dropdown and select By Course
    const sortTrigger = page.getByRole('combobox')
    await sortTrigger.click()
    await page.getByText(/by course/i).click()

    // Course group headings should appear
    await expect(page.getByRole('heading', { name: /authority/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /operative/i })).toBeVisible()
  })
})

test.describe('AC5: Expand note card with navigation', () => {
  test('clicking note card expands to show full content', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Click first note card to expand
    await page.locator('[data-testid="note-card"]').first().click()

    // Full TipTap content should render
    await expect(
      page.locator('.ProseMirror').filter({ hasText: /introduction notes about the operative training program/i }),
    ).toBeVisible()
  })

  test('"Open in Lesson" button navigates to source video', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Expand the first note card
    await page.locator('[data-testid="note-card"]').first().click()

    // Click "Open in Lesson" button
    await page.getByRole('button', { name: /open in lesson/i }).click()

    // Should navigate to lesson player with notes panel and timestamp
    await expect(page).toHaveURL(/courses\/operative-six\/op6-introduction/)
    await expect(page).toHaveURL(/panel=notes/)
    await expect(page).toHaveURL(/t=30/)
  })

  test('timestamp in expanded note seeks video when clicked', async ({ page }) => {
    await goToNotes(page)
    await seedNotes(page)
    await page.reload()

    // Expand note with timestamp
    await page.locator('[data-testid="note-card"]').first().click()

    // Timestamp button should be visible (0:30 for 30 seconds)
    const timestampButton = page.getByRole('button', { name: /0:30/ })
    await expect(timestampButton).toBeVisible()

    // Click timestamp and verify navigation includes t= param
    await timestampButton.click()
    await expect(page).toHaveURL(/courses\/operative-six\/op6-introduction/)
    await expect(page).toHaveURL(/t=30/)
  })
})

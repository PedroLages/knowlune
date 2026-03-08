/**
 * Story 3.8: Global Notes Dashboard — ATDD Acceptance Tests (Part 2)
 *
 * Tests verify:
 *   - AC4: Sort controls (Most Recent, Oldest First, By Course)
 *   - AC5: Expand note card with full content and "Open in Lesson" navigation
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { RETRY_CONFIG } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const NOTES_URL = '/notes'

/** Suppress sidebar overlay and navigate to Notes page. */
async function goToNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
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

    const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
    const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL

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
          tx.oncomplete = () => {
            db.close()
            resolve('ok')
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
      if (result === 'ok') return
      // Frame-accurate wait using requestAnimationFrame tick counting
      // Assumes 60fps (~16.67ms per frame)
      await new Promise<void>(resolve => {
        let ticks = 0
        const targetTicks = Math.ceil(retryDelay / 16.67)
        const tick = () => {
          ticks++
          if (ticks >= targetTicks) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
    }
    throw new Error('notes store not found in ElearningDB after 10 retries')
  })
}

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
      page
        .locator('.ProseMirror')
        .filter({ hasText: /introduction notes about the operative training program/i })
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

/**
 * Story 3.7: Bookmarks Page — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Bookmarks page lists all bookmarks with course title, video title, timestamp, date (sorted by most recent)
 *   - AC2: Clicking a bookmark navigates to lesson player at that timestamp
 *   - AC3: Seek bar shows visual indicators at bookmarked positions
 *   - AC4: Delete bookmark with confirmation dialog (NFR23)
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const BOOKMARKS_URL = '/library'

/** Suppress sidebar overlay and navigate to bookmarks page. */
async function goToBookmarks(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, BOOKMARKS_URL)
}

/** Seed bookmarks into IndexedDB across multiple courses. */
async function seedBookmarks(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.close()
          reject(new Error('bookmarks store not found'))
          return
        }
        const tx = db.transaction('bookmarks', 'readwrite')
        const store = tx.objectStore('bookmarks')

        const bookmarks = [
          {
            id: 'bm-1',
            courseId: 'operative-six',
            lessonId: 'op6-introduction',
            timestamp: 90,
            label: '1:30',
            createdAt: '2026-02-28T10:00:00.000Z',
          },
          {
            id: 'bm-2',
            courseId: 'operative-six',
            lessonId: 'op6-pillars-of-influence',
            timestamp: 245,
            label: '4:05',
            createdAt: '2026-03-01T09:00:00.000Z',
          },
          {
            id: 'bm-3',
            courseId: 'design-thinking-101',
            lessonId: 'dt-empathy-mapping',
            timestamp: 30,
            label: '0:30',
            createdAt: '2026-02-27T14:30:00.000Z',
          },
        ]

        for (const bm of bookmarks) {
          store.put(bm)
        }

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
  })
}

/** Clear all bookmarks from IndexedDB. */
async function clearBookmarks(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.close()
          resolve()
          return
        }
        const tx = db.transaction('bookmarks', 'readwrite')
        tx.objectStore('bookmarks').clear()
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
  })
}

test.describe('AC1: Bookmarks page lists all bookmarks', () => {
  test('shows bookmarks tab/section on library page', async ({ page }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    // Bookmarks tab or section should be visible
    const bookmarksTab = page.getByRole('tab', { name: /bookmarks/i })
    await expect(bookmarksTab).toBeVisible()
  })

  test('displays bookmarks with course title, video title, timestamp, and date', async ({
    page,
  }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    // Click bookmarks tab
    await page.getByRole('tab', { name: /bookmarks/i }).click()

    // Each bookmark should show course title, video/lesson title, timestamp, and date
    // bm-2 is most recent (2026-03-01)
    const bookmarkEntries = page.getByTestId('bookmark-entry')
    await expect(bookmarkEntries).toHaveCount(3)

    // Verify first entry (most recent: bm-2, operative-six / op6-pillars-of-influence)
    const firstEntry = bookmarkEntries.first()
    await expect(firstEntry).toContainText('Operative Six') // course title
    await expect(firstEntry).toContainText('The Pillars of Influence') // lesson title
    await expect(firstEntry).toContainText('4:05') // timestamp
    await expect(firstEntry).toContainText('Mar 1, 2026') // date
  })

  test('bookmarks are sorted by most recent first', async ({ page }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    const bookmarkEntries = page.getByTestId('bookmark-entry')

    // bm-2 (Mar 1) should appear before bm-1 (Feb 28) which is before bm-3 (Feb 27)
    const firstText = await bookmarkEntries.nth(0).textContent()
    const lastText = await bookmarkEntries.nth(2).textContent()
    expect(firstText).toContain('4:05') // bm-2 (most recent)
    expect(lastText).toContain('0:30') // bm-3 (oldest)
  })

  test('shows empty state when no bookmarks exist', async ({ page }) => {
    await goToBookmarks(page)
    await clearBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    await expect(page.getByText(/no bookmarks/i)).toBeVisible()
  })
})

test.describe('AC2: Click bookmark to navigate to lesson player', () => {
  test('clicking a bookmark navigates to the lesson player at the bookmarked timestamp', async ({
    page,
  }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    // Click on the first bookmark entry
    const bookmarkEntries = page.getByTestId('bookmark-entry')
    await bookmarkEntries.first().click()

    // Should navigate to the exact lesson player URL with timestamp parameter
    // bm-2 (most recent) = operative-six / op6-pillars-of-influence at t=245
    await expect(page).toHaveURL('/courses/operative-six/op6-pillars-of-influence?t=245')
  })
})

test.describe('AC3: Seek bar bookmark indicators', () => {
  test('video seek bar shows markers at bookmarked positions', async ({ page }) => {
    await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())

    // Navigate to a lesson that has bookmarks (seedBookmarks includes bm-1 for op6-introduction)
    await navigateAndWait(page, '/courses/operative-six/op6-introduction')
    await seedBookmarks(page)
    await page.reload()

    // Bookmark indicators should be visible on the seek bar
    const bookmarkMarkers = page.getByTestId('bookmark-marker')
    await expect(bookmarkMarkers.first()).toBeVisible()

    // Marker should be positioned at a non-zero offset (not all at 0%)
    const leftStyle = await bookmarkMarkers.first().getAttribute('style')
    expect(leftStyle).toMatch(/left:\s*[\d.]+%/)
    const leftValue = parseFloat(leftStyle?.match(/left:\s*([\d.]+)%/)?.[1] || '0')
    expect(leftValue).toBeGreaterThan(0)
  })
})

test.describe('AC4: Delete bookmark with confirmation', () => {
  test('delete button shows confirmation dialog (NFR23)', async ({ page }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    // Click delete on the first bookmark
    const bookmarkEntries = page.getByTestId('bookmark-entry')
    await bookmarkEntries
      .first()
      .getByRole('button', { name: /delete/i })
      .click()

    // Confirmation dialog should appear
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText(/delete this bookmark/i)).toBeVisible()
  })

  test('cancel dismisses dialog without deleting', async ({ page }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    const bookmarkEntries = page.getByTestId('bookmark-entry')
    const initialCount = await bookmarkEntries.count()

    // Click delete, then cancel
    await bookmarkEntries
      .first()
      .getByRole('button', { name: /delete/i })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /cancel/i })
      .click()

    // Dialog dismissed, bookmark still present
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(bookmarkEntries).toHaveCount(initialCount)
  })

  test('confirming delete removes the bookmark', async ({ page }) => {
    await goToBookmarks(page)
    await seedBookmarks(page)
    await page.reload()

    await page.getByRole('tab', { name: /bookmarks/i }).click()

    const bookmarkEntries = page.getByTestId('bookmark-entry')
    await expect(bookmarkEntries).toHaveCount(3)

    // Delete first bookmark
    await bookmarkEntries
      .first()
      .getByRole('button', { name: /delete/i })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()

    // One fewer bookmark
    await expect(bookmarkEntries).toHaveCount(2)
  })
})

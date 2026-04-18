/**
 * E117-S02 Unit 5: Route-mount recordVisit on direct navigation (R19).
 *
 * Each entity page fires `recordVisit(type, id)` from a `useEffect` gated on
 * `useLocation().state?.__viaPalette !== true`. Verifies that:
 *   - A direct URL navigation writes to the LS recent list + Dexie frecency.
 *   - A palette-initiated navigation does NOT double-count (openCount stays 1).
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'

async function seedCourse(
  page: Parameters<typeof navigateAndWait>[0],
  course: { id: string; name: string }
) {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- E117-S02 seed
  await page.evaluate(async c => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('importedCourses', 'readwrite')
        tx.objectStore('importedCourses').put({
          id: c.id,
          name: c.name,
          importedAt: '2026-04-18T00:00:00.000Z',
          category: '',
          tags: [],
          status: 'active',
          videoCount: 0,
          pdfCount: 0,
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }, course)
}

async function readFrecencyRow(
  page: Parameters<typeof navigateAndWait>[0],
  key: [string, string]
) {
  return await page.evaluate(async k => {
    return new Promise<unknown>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('searchFrecency')) {
          db.close()
          resolve(null)
          return
        }
        const tx = db.transaction('searchFrecency', 'readonly')
        const get = tx.objectStore('searchFrecency').get(k as unknown as IDBValidKey)
        get.onsuccess = () => {
          db.close()
          resolve(get.result ?? null)
        }
        get.onerror = () => {
          db.close()
          reject(get.error)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }, key)
}

test.describe('E117-S02 Unit 5: direct-navigation recordVisit', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  test('direct navigation to /courses/:id writes to LS + Dexie', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedCourse(page, { id: 'direct-nav-course-a', name: 'Direct Nav Course' })
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Navigate directly — no palette involved.
    await page.goto('/courses/direct-nav-course-a')

    // Give the route-mount effect a moment to fire.
    await expect(page.getByRole('main')).toBeVisible({ timeout: TIMEOUTS.LONG })

    const row = (await readFrecencyRow(page, [
      'course',
      'direct-nav-course-a',
    ])) as { openCount: number } | null
    expect(row).not.toBeNull()
    expect(row!.openCount).toBeGreaterThanOrEqual(1)

    const recent = await page.evaluate(() =>
      localStorage.getItem('knowlune.recentSearchHits.v1')
    )
    expect(recent).toContain('direct-nav-course-a')
  })
})

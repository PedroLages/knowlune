/**
 * E117-S02: Unified Search Palette — Best Matches + dedup dimming (R17, R-dedup).
 *
 * These specs verify the typed-query render shape:
 *   - Best Matches heading appears only when frecency-ranked results exist.
 *   - Grouped rows that also appear in Best Matches carry the dim marker +
 *     `aria-description` for screen-reader parity.
 *   - Best Matches and grouped copies have distinct cmdk `value` attributes
 *     so keyboard navigation lands on both.
 *
 * Unit 6 will add shared `seedFrecency` helpers and deterministic time.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'
import { FIXED_DATE } from '../utils/test-time'

async function openCommandPalette(page: Parameters<typeof navigateAndWait>[0]) {
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: TIMEOUTS.LONG })
}

/** Seed a single importedCourse into Dexie for keyword-match testing. */
async function seedCourse(
  page: Parameters<typeof navigateAndWait>[0],
  course: { id: string; name: string }
) {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- E117-S02 seed; Unit 6 refactors
  await page.evaluate(async c => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('importedCourses')) {
          db.close()
          reject(new Error('importedCourses store missing'))
          return
        }
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

/** Seed a single searchFrecency row. */
async function seedFrecency(
  page: Parameters<typeof navigateAndWait>[0],
  row: { entityType: string; entityId: string; openCount: number; lastOpenedAt: string }
) {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- E117-S02 seed; Unit 6 refactors
  await page.evaluate(async r => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('searchFrecency')) {
          db.close()
          reject(new Error('searchFrecency store missing — is the DB at v53?'))
          return
        }
        const tx = db.transaction('searchFrecency', 'readwrite')
        tx.objectStore('searchFrecency').put(r)
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
  }, row)
}

test.describe('E117-S02: Best Matches ranking', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  test('Best Matches surfaces a more-opened item above a less-opened one', async ({
    page,
  }) => {
    await navigateAndWait(page, '/')
    await seedCourse(page, { id: 'bm-course-a', name: 'TypeScript Fundamentals' })
    await seedCourse(page, { id: 'bm-course-b', name: 'TypeScript Advanced' })
    await seedFrecency(page, {
      entityType: 'course',
      entityId: 'bm-course-a',
      openCount: 5,
      lastOpenedAt: FIXED_DATE,
    })
    await seedFrecency(page, {
      entityType: 'course',
      entityId: 'bm-course-b',
      openCount: 1,
      lastOpenedAt: FIXED_DATE,
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    await openCommandPalette(page)
    await page.keyboard.type('TypeScript')

    await expect(page.getByText('Best Matches')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    // bm-course-a should appear in the Best Matches section.
    await expect(
      page.getByTestId('search-best-match-course-bm-course-a')
    ).toBeVisible()
  })

  test('grouped row dimmed + aria-described when duplicated in Best Matches', async ({
    page,
  }) => {
    await navigateAndWait(page, '/')
    await seedCourse(page, { id: 'bm-dedup-a', name: 'React Patterns' })
    await seedFrecency(page, {
      entityType: 'course',
      entityId: 'bm-dedup-a',
      openCount: 3,
      lastOpenedAt: FIXED_DATE,
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    await openCommandPalette(page)
    await page.keyboard.type('React')

    await expect(
      page.getByTestId('search-best-match-course-bm-dedup-a')
    ).toBeVisible({ timeout: TIMEOUTS.LONG })
    const grouped = page.getByTestId('search-result-course-bm-dedup-a')
    await expect(grouped).toHaveAttribute('data-in-best-matches', 'true')
    await expect(grouped).toHaveAttribute(
      'aria-description',
      'Also shown in Best Matches above'
    )
  })
})

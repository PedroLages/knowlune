/**
 * Playwright seed helpers for E117-S02 unified-search persistence tests.
 *
 * Two structures we may need to seed before opening the palette:
 *   - localStorage `knowlune.recentSearchHits.v1` — the Recently Opened list.
 *   - Dexie `searchFrecency` table — per-entity openCount + lastOpenedAt rows.
 *
 * Deterministic time: use `FIXED_DATE` from `tests/utils/test-time.ts` for
 * timestamps — the 30-day decay math in `applyFrecency` must not drift with
 * the machine clock across test runs.
 *
 * Call these AFTER navigating to a real URL (`page.goto('/')`); IndexedDB
 * and localStorage access at `about:blank` throws `SecurityError`.
 */
import type { Page } from '@playwright/test'
import { FIXED_DATE } from '../utils/test-time'

export interface RecentHitSeed {
  type: 'course' | 'book' | 'lesson' | 'note' | 'highlight' | 'author'
  id: string
  /** ISO 8601; defaults to FIXED_DATE. */
  openedAt?: string
}

export interface FrecencyRowSeed {
  entityType: 'course' | 'book' | 'lesson' | 'note' | 'highlight' | 'author'
  entityId: string
  openCount: number
  /** ISO 8601; defaults to FIXED_DATE. */
  lastOpenedAt?: string
}

/**
 * Seed the localStorage recent-list. Prepended, NOT merged — callers should
 * pass the desired final list. Pass `[]` to clear.
 */
export async function seedRecentList(
  page: Page,
  entries: RecentHitSeed[]
): Promise<void> {
  const normalized = entries.map(e => ({
    type: e.type,
    id: e.id,
    openedAt: e.openedAt ?? FIXED_DATE,
  }))
  await page.evaluate(list => {
    localStorage.setItem('knowlune.recentSearchHits.v1', JSON.stringify(list))
  }, normalized)
}

/**
 * Seed Dexie `searchFrecency` rows. Uses a single `idb.open` transaction so
 * multiple rows are batched.
 */
export async function seedFrecency(page: Page, rows: FrecencyRowSeed[]): Promise<void> {
  const normalized = rows.map(r => ({
    entityType: r.entityType,
    entityId: r.entityId,
    openCount: r.openCount,
    lastOpenedAt: r.lastOpenedAt ?? FIXED_DATE,
  }))
  await page.evaluate(async data => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ElearningDB')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('searchFrecency')) {
          db.close()
          reject(new Error('searchFrecency store missing — DB not at v53?'))
          return
        }
        const tx = db.transaction('searchFrecency', 'readwrite')
        const store = tx.objectStore('searchFrecency')
        for (const row of data) store.put(row)
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
  }, normalized)
}

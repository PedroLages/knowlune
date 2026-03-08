/**
 * ATDD acceptance tests for E06-S03: Challenge Milestone Celebrations
 *
 * Tests milestone toast notifications at 25%, 50%, 75%, 100% thresholds,
 * completion state visual treatment, prefers-reduced-motion support,
 * and sequential staggering of simultaneous milestones.
 */
import { test, expect } from '../../support/fixtures'
import { createChallenge } from '../../support/fixtures/factories/challenge-factory'
import { RETRY_CONFIG, TIMEOUTS } from '../../utils/constants'
import type { Page } from '@playwright/test'
import { FIXED_DATE } from './../../utils/test-time'
import { closeSidebar } from '@/tests/support/fixtures/constants/sidebar-constants'

const DB_NAME = 'ElearningDB'

// ── Helpers ─────────────────────────────────────────────

async function goToChallenges(page: Page) {
  await page.goto('/challenges')
  await page.waitForLoadState('load')
}

/** Seed records into a named IndexedDB store with retry for Dexie init */
async function seedStore(page: Page, storeName: string, records: unknown[]) {
  await page.evaluate(
    async ({ dbName, store, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open(dbName)
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(store)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(store, 'readwrite')
            const objectStore = tx.objectStore(store)
            for (const item of data) {
              objectStore.put(item)
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
      throw new Error(`Store "${store}" not found after ${maxRetries} retries`)
    },
    { dbName: DB_NAME, store: storeName, data: records, maxRetries: RETRY_CONFIG.MAX_ATTEMPTS, retryDelay: RETRY_CONFIG.POLL_INTERVAL }
  )
}

// ── Setup ───────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
})

test.afterEach(async ({ page, indexedDB }) => {
  try {
    await indexedDB.clearStore('challenges')
    await indexedDB.clearStore('contentProgress')
  } catch {
    // Page may already be closed
  }
})

// ── AC1: 25% milestone toast ────────────────────────────

test.describe('AC1: 25% milestone celebration', () => {
  test('displays toast with "25% Complete" badge and challenge name', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [],
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 1 completed item → 1/4 = 25%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    // Then: toast with 25% milestone badge appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: challenge name shown in toast
    await expect(toast).toContainText('Watch 4 Videos')

    // Verify milestone recorded in IndexedDB
    const challenges = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('challenges', 'readonly')
          const store = tx.objectStore('challenges')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            db.close()
            resolve(getAll.result)
          }
          getAll.onerror = () => {
            db.close()
            reject(getAll.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    })
    expect((challenges as any[])[0].celebratedMilestones).toContain(25)
  })

  test('milestone is recorded in IndexedDB and not triggered again', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [25], // already celebrated
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 1 completed item → 25% but already celebrated
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    // Then: no milestone toast should appear — wait for page to settle, then assert absence
    await page.waitForSelector('[data-testid="header-create-challenge"]', { state: 'visible' })
    // Deterministic check: assert no 25% toast appears within stagger window
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    ).toHaveCount(0, { timeout: TIMEOUTS.MEDIUM })
  })
})

// ── AC2: 50% milestone toast ────────────────────────────

test.describe('AC2: 50% milestone celebration', () => {
  test('displays toast with "Halfway There" badge and supportive message', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [25], // 25% already celebrated
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 2 completed items → 2/4 = 50%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Halfway There/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: supportive message is shown
    await expect(toast).toContainText("Keep it up — you're doing great!")
  })
})

// ── AC3: 75% milestone toast ────────────────────────────

test.describe('AC3: 75% milestone celebration', () => {
  test('displays toast with "Almost There" badge and encouraging message', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [25, 50], // prior milestones celebrated
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 3 completed items → 3/4 = 75%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Almost There/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: encouraging message is shown
    await expect(toast).toContainText('The finish line is in sight!')
  })
})

// ── AC4: 100% completion celebration ────────────────────

test.describe('AC4: 100% completion celebration', () => {
  test('displays "Challenge Complete" toast with celebratory visual treatment', async ({
    page,
  }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [25, 50, 75],
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 4 completed items → 4/4 = 100%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l4', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    // Then: "Challenge Complete" toast appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Challenge Complete/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: confetti animation fires (canvas-confetti injects a <canvas>)
    await expect(page.locator('canvas')).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: challenge card transitions to completed state in Completed section
    const completedSection = page.locator('[data-testid="completed-section"]')
    await expect(completedSection).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: Completed section trigger shows count
    const completedTrigger = completedSection.getByRole('button', { name: /Completed \(\d+\)/i })
    await expect(completedTrigger).toBeVisible()

    // And: challenge name appears within completed section (open by default)
    await expect(completedSection.getByText('Watch 4 Videos')).toBeVisible()

    // And: "Completed" badge is visible in the completed section
    await expect(completedSection.getByText('Completed', { exact: true })).toBeVisible()
  })
})

// ── AC5: prefers-reduced-motion ─────────────────────────

test.describe('AC5: prefers-reduced-motion support', () => {
  test('suppresses animations but keeps toast and badge visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [],
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 1 completed item → 25%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    // Then: toast still appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // And: no confetti canvas should be rendered
    await expect(page.locator('canvas')).toHaveCount(0)

    // And: badge content remains accessible
    await expect(toast.locator('[role="status"]')).toBeVisible()
    await expect(toast.locator('[aria-hidden="true"]')).toHaveCount(1) // icon hidden from SR
  })
})

// ── AC6: Simultaneous milestone staggering ──────────────

test.describe('AC6: Simultaneous milestone crossing', () => {
  test('triggers sequential toasts for each uncelebrated threshold', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Watch 4 Videos',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [], // no prior celebrations
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 3 completed items → 3/4 = 75% — crosses 25%, 50%, 75% simultaneously
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: FIXED_DATE },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: FIXED_DATE },
    ])
    await page.reload()

    // Then: all three milestone toasts appear (staggered)
    const toast25 = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    const toast50 = page.locator('[data-sonner-toast]').filter({ hasText: /Halfway There/i })
    const toast75 = page.locator('[data-sonner-toast]').filter({ hasText: /Almost There/i })

    await expect(toast25).toBeVisible({ timeout: TIMEOUTS.MEDIA })
    await expect(toast50).toBeVisible({ timeout: TIMEOUTS.MEDIA })
    await expect(toast75).toBeVisible({ timeout: TIMEOUTS.MEDIA })

    // And: each milestone is individually recorded in IndexedDB
    const celebrated = await page.evaluate(async dbName => {
      return new Promise<number[]>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('challenges', 'readonly')
          const store = tx.objectStore('challenges')
          const all = store.getAll()
          all.onsuccess = () => {
            db.close()
            resolve(all.result[0]?.celebratedMilestones ?? [])
          }
          all.onerror = () => {
            db.close()
            reject(all.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    }, DB_NAME)
    expect(celebrated).toEqual(expect.arrayContaining([25, 50, 75]))
  })
})

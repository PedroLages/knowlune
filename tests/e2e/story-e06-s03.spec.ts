/**
 * ATDD acceptance tests for E06-S03: Challenge Milestone Celebrations
 *
 * Tests milestone toast notifications at 25%, 50%, 75%, 100% thresholds,
 * completion state visual treatment, prefers-reduced-motion support,
 * and sequential staggering of simultaneous milestones.
 */
import { test, expect } from '../support/fixtures'
import { createChallenge } from '../support/fixtures/factories/challenge-factory'
import type { Page } from '@playwright/test'

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
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "${store}" not found after ${maxRetries} retries`)
    },
    { dbName: DB_NAME, store: storeName, data: records, maxRetries: 10, retryDelay: 200 }
  )
}

// ── Setup ───────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    // Then: toast with 25% milestone badge appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    // And: challenge name shown in toast
    await expect(toast).toContainText('Watch 4 Videos')
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    // Then: no milestone toast should appear
    await page.waitForTimeout(3000)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    await expect(toast).toHaveCount(0)
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Halfway There/i })
    await expect(toast).toBeVisible({ timeout: 10000 })
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Almost There/i })
    await expect(toast).toBeVisible({ timeout: 10000 })
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l4', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    // Then: "Challenge Complete" toast appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Challenge Complete/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    // And: confetti animation fires (canvas-confetti injects a <canvas>)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 })

    // And: challenge card transitions to completed state
    const completedSection = page.getByText(/completed/i)
    await expect(completedSection).toBeVisible()
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    // Then: toast still appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    await expect(toast).toBeVisible({ timeout: 10000 })

    // And: no confetti canvas should be rendered
    await expect(page.locator('canvas')).toHaveCount(0)
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
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: new Date().toISOString() },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: new Date().toISOString() },
    ])
    await page.reload()

    // Then: all three milestone toasts appear (staggered)
    const toast25 = page.locator('[data-sonner-toast]').filter({ hasText: /25%.*Complete/i })
    const toast50 = page.locator('[data-sonner-toast]').filter({ hasText: /Halfway There/i })
    const toast75 = page.locator('[data-sonner-toast]').filter({ hasText: /Almost There/i })

    await expect(toast25).toBeVisible({ timeout: 15000 })
    await expect(toast50).toBeVisible({ timeout: 15000 })
    await expect(toast75).toBeVisible({ timeout: 15000 })
  })
})

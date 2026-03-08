import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
import { RETRY_CONFIG } from '../../utils/constants'
/**
 * ATDD tests for E06-S02: Track Challenge Progress
 *
 * Tests verify that challenge progress is calculated from source data
 * (contentProgress, studySessions, study-log) and displayed correctly.
 */
import { test, expect } from '../../support/fixtures'
import { createChallenge } from '../../support/fixtures/factories/challenge-factory'
import type { Page } from '@playwright/test'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

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
  // Prevent tablet sidebar overlay from blocking interactions
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
})

test.afterEach(async ({ page, indexedDB }) => {
  try {
    await indexedDB.clearStore('challenges')
    await indexedDB.clearStore('studySessions')
    await indexedDB.clearStore('contentProgress')
  } catch (e) {
    console.warn('Test cleanup failed:', e)
  }
})

// ── AC1: Dashboard widget displays active challenges ────

test.describe('AC1: Challenge dashboard widget', () => {
  test('displays active challenge with name, progress bar, percentage, and remaining time', async ({
    page,
  }) => {
    const challenge = createChallenge({
      name: 'Complete 10 Videos',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
      createdAt: '2020-01-01T00:00:00.000Z',
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 3 completed content items so refreshAllProgress calculates 3/10 = 30%
    await seedStore(page, 'contentProgress', [
      { courseId: 'c1', itemId: 'l1', status: 'completed', updatedAt: '2025-01-01T00:00:00.000Z' },
      { courseId: 'c1', itemId: 'l2', status: 'completed', updatedAt: '2025-01-02T00:00:00.000Z' },
      { courseId: 'c1', itemId: 'l3', status: 'completed', updatedAt: '2025-01-03T00:00:00.000Z' },
    ])
    await page.reload()

    // Challenge name visible
    await expect(page.getByText('Complete 10 Videos')).toBeVisible()

    // Progress bar exists
    await expect(page.getByRole('progressbar')).toBeVisible()

    // Percentage displayed (30%)
    await expect(page.getByText('30%')).toBeVisible()

    // Remaining time shown
    await expect(page.getByText(/remaining|days left/i)).toBeVisible()
  })
})

// ── AC2: Completion-based progress ──────────────────────

test.describe('AC2: Completion-based challenge progress', () => {
  test('counts completed videos since challenge creation date', async ({ page }) => {
    const createdAt = '2026-03-01T00:00:00.000Z'
    const challenge = createChallenge({
      name: 'Watch 5 Videos',
      type: 'completion',
      targetValue: 5,
      currentProgress: 0,
      createdAt,
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed 3 completed content items after challenge creation
    const completedItems = [
      {
        courseId: 'course-1',
        itemId: 'lesson-1',
        status: 'completed',
        updatedAt: '2026-03-02T10:00:00.000Z',
      },
      {
        courseId: 'course-1',
        itemId: 'lesson-2',
        status: 'completed',
        updatedAt: '2026-03-03T10:00:00.000Z',
      },
      {
        courseId: 'course-2',
        itemId: 'lesson-3',
        status: 'completed',
        updatedAt: '2026-03-04T10:00:00.000Z',
      },
    ]
    await seedStore(page, 'contentProgress', completedItems)
    await page.reload()

    // Progress should reflect 3/5 = 60%
    await expect(page.getByText('60%')).toBeVisible()
  })
})

// ── AC3: Time-based progress ────────────────────────────

test.describe('AC3: Time-based challenge progress', () => {
  test('sums study session durations since challenge creation date', async ({ page }) => {
    const createdAt = '2026-03-01T00:00:00.000Z'
    const challenge = createChallenge({
      name: 'Study 10 Hours',
      type: 'time',
      targetValue: 10,
      currentProgress: 0,
      createdAt,
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed study sessions totaling 4 hours after creation
    const sessions = [
      {
        id: crypto.randomUUID(),
        courseId: 'course-1',
        contentItemId: 'lesson-1',
        startTime: '2026-03-02T09:00:00.000Z',
        endTime: '2026-03-02T11:00:00.000Z',
        duration: 7200, // 2 hours
        idleTime: 0,
        videosWatched: [],
        lastActivity: '2026-03-02T11:00:00.000Z',
        sessionType: 'video',
      },
      {
        id: crypto.randomUUID(),
        courseId: 'course-1',
        contentItemId: 'lesson-2',
        startTime: '2026-03-03T14:00:00.000Z',
        endTime: '2026-03-03T16:00:00.000Z',
        duration: 7200, // 2 hours
        idleTime: 0,
        videosWatched: [],
        lastActivity: '2026-03-03T16:00:00.000Z',
        sessionType: 'video',
      },
    ]
    await seedStore(page, 'studySessions', sessions)
    await page.reload()

    // Progress should reflect 4/10 = 40%
    await expect(page.getByText('40%')).toBeVisible()
  })
})

// ── AC4: Streak-based progress ──────────────────────────

test.describe('AC4: Streak-based challenge progress', () => {
  test('reads current streak and displays progress', async ({ page }) => {
    const challenge = createChallenge({
      name: 'Maintain 30-Day Streak',
      type: 'streak',
      targetValue: 30,
      currentProgress: 0,
      createdAt: '2020-01-01T00:00:00.000Z',
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [challenge])

    // Seed a 7-day streak ending today so getCurrentStreak() returns 7
    const today = new Date(FIXED_DATE)
    const studyLog = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(FIXED_DATE)
      date.setDate(date.getDate() - (6 - i)) // 6 days ago through today
      return {
        type: 'lesson_complete',
        timestamp: date.toISOString(),
        courseId: 'course-1',
        lessonId: `lesson-${i + 1}`,
      }
    })

    await page.evaluate(log => {
      localStorage.setItem('study-log', JSON.stringify(log))
    }, studyLog)
    await page.reload()

    // Progress should reflect 7/30 ≈ 23%
    await expect(page.getByText('23%')).toBeVisible()
  })
})

// ── AC5: Expired challenges ─────────────────────────────

test.describe('AC5: Expired challenges', () => {
  test('shows expired challenge in collapsed section, separated from active', async ({ page }) => {
    const yesterday = new Date(getRelativeDate(-1))
    const expiredDeadline = yesterday.toISOString().split('T')[0]

    const expiredChallenge = createChallenge({
      name: 'Expired Challenge',
      type: 'completion',
      targetValue: 20,
      currentProgress: 0,
      deadline: expiredDeadline,
    })

    const activeChallenge = createChallenge({
      name: 'Active Challenge',
      type: 'time',
      targetValue: 10,
      currentProgress: 0,
      deadline: '2030-12-31',
    })

    await goToChallenges(page)
    await seedStore(page, 'challenges', [expiredChallenge, activeChallenge])
    await page.reload()

    // Active challenge visible in main grid
    await expect(page.getByText('Active Challenge', { exact: true })).toBeVisible()

    // Expired section trigger visible with count
    const expiredTrigger = page.getByText(/expired\s*\(1\)/i)
    await expect(expiredTrigger).toBeVisible()

    // Expired challenge hidden until section is expanded
    await expect(page.getByText('Expired Challenge')).not.toBeVisible()

    // Click to expand expired section
    await expiredTrigger.click()

    // Now the expired challenge is visible
    await expect(page.getByText('Expired Challenge')).toBeVisible()

    // Verify muted styling (opacity-60) on expired card
    const expiredCard = page
      .getByText('Expired Challenge')
      .locator('xpath=ancestor::div[contains(@class, "opacity")]')
    await expect(expiredCard).toHaveCSS('opacity', '0.6')
  })
})

// ── AC6: Empty state ────────────────────────────────────

test.describe('AC6: Empty state', () => {
  test('displays empty state with message and CTA when no active challenges exist', async ({
    page,
  }) => {
    await goToChallenges(page)

    // Empty state message
    await expect(page.getByText(/no.*challenge|create.*first/i)).toBeVisible()

    // CTA button in empty state (second Create Challenge button, after header button)
    const ctaButtons = page.getByRole('button', { name: /create.*challenge/i })
    await expect(ctaButtons).toHaveCount(2)
    await expect(ctaButtons.nth(1)).toBeVisible()
  })
})

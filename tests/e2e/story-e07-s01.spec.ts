/**
 * E07-S01: Momentum Score Calculation & Display
 *
 * Tests the momentum badge indicator on course cards and the "Sort by Momentum"
 * option in the courses library.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
}

const DB_NAME = 'ElearningDB'
const STORE_NAME = 'studySessions'

/**
 * Seeds study sessions into IndexedDB via page.evaluate with retry logic
 * for waiting on Dexie to create the object store.
 */
async function seedStudySessions(
  page: import('@playwright/test').Page,
  sessions: Record<string, unknown>[]
) {
  await page.evaluate(
    async ({ dbName, storeName, data }) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open(dbName)
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(storeName)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            for (const item of data) {
              store.put(item)
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
        await new Promise(r => setTimeout(r, 200))
      }
      throw new Error(`Store "${storeName}" not found after retries`)
    },
    { dbName: DB_NAME, storeName: STORE_NAME, data: sessions }
  )
}

/** Helper to select a value from a shadcn/Radix Select by data-testid */
async function selectSortOption(page: import('@playwright/test').Page, value: string) {
  const trigger = page.getByTestId('sort-select')
  await trigger.click()
  // Radix Select renders items in a portal with role="option"
  await page.getByRole('option', { name: value }).click()
}

test.describe('E07-S01: Momentum Score Display', () => {
  test('momentum badges appear on courses with study sessions', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    // Navigate first so Dexie creates the DB
    await goToCourses(page)

    // Seed a study session so at least one course has score > 0
    const now = Date.now()
    await seedStudySessions(page, [
      {
        id: 'test-badge-vis-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: new Date(now).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(),
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: new Date(now + 30 * 60 * 1000).toISOString(),
        sessionType: 'video',
      },
    ])

    // Reload to pick up seeded data
    await goToCourses(page)

    // Wait for async momentum load and badge render via Playwright auto-retry
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Clean up
    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum badge has correct tier label text', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await goToCourses(page)

    // Seed session for badge to appear
    const now = Date.now()
    await seedStudySessions(page, [
      {
        id: 'test-tier-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: new Date(now).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(),
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: new Date(now + 30 * 60 * 1000).toISOString(),
        sessionType: 'video',
      },
    ])

    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const text = await firstBadge.textContent()
    expect(['Hot', 'Warm', 'Cold'].some(t => text?.includes(t))).toBe(true)

    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum badge has accessible aria-label', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await goToCourses(page)

    const now = Date.now()
    await seedStudySessions(page, [
      {
        id: 'test-aria-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: new Date(now).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(),
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: new Date(now + 30 * 60 * 1000).toISOString(),
        sessionType: 'video',
      },
    ])

    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const ariaLabel = await firstBadge.getAttribute('aria-label')
    expect(ariaLabel).toMatch(/^Momentum: (Hot|Warm|Cold) \(\d+\)$/)

    await indexedDB.clearStore(STORE_NAME)
  })

  test('sort by momentum option is present in courses page', async ({ page }) => {
    await seedSidebar(page)
    await goToCourses(page)

    const trigger = page.getByTestId('sort-select')
    await expect(trigger).toBeVisible()

    // Default value should show "Most Recent"
    await expect(trigger).toHaveText(/Most Recent/)

    // Open and check both options exist
    await trigger.click()
    await expect(page.getByRole('option', { name: 'Most Recent' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Sort by Momentum' })).toBeVisible()

    // Close by pressing Escape
    await page.keyboard.press('Escape')
  })

  test('selecting sort by momentum reorders the course list', async ({ page, indexedDB }) => {
    await seedSidebar(page)

    const now = Date.now()

    // Navigate first so Dexie creates the DB and stores
    await goToCourses(page)

    // Build study session records
    const highMomentumSessions = Array.from({ length: 8 }, (_, i) => ({
      id: `test-high-${i}`,
      courseId: 'nci-access',
      contentItemId: `lesson-${i}`,
      startTime: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(now - i * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      duration: 1800,
      idleTime: 0,
      videosWatched: [`video-${i}`],
      lastActivity: new Date(now - i * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      sessionType: 'video' as const,
    }))

    const lowMomentumSessions = [
      {
        id: 'test-low-0',
        courseId: 'authority',
        contentItemId: 'lesson-0',
        startTime: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now - 12 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        duration: 600,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: new Date(now - 12 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        sessionType: 'video' as const,
      },
    ]

    await seedStudySessions(page, [...highMomentumSessions, ...lowMomentumSessions])

    // Reload so the Courses page re-reads studySessions from IndexedDB
    await goToCourses(page)

    // Switch to momentum sort via shadcn Select
    await selectSortOption(page, 'Sort by Momentum')

    // Wait for badges to re-render after sort
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Extract momentum scores from aria-labels: "Momentum: Hot|Warm|Cold (N)"
    const badges = page.getByTestId('momentum-badge')
    const ariaLabels = await badges.evaluateAll(els =>
      els.map(el => el.getAttribute('aria-label') ?? '')
    )
    const scores = ariaLabels.map(label => {
      const match = label.match(/\((\d+)\)$/)
      return match ? Number(match[1]) : 0
    })

    // Verify monotonically non-increasing order
    expect(scores.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }

    // The highest-scored course should be nci-access (seeded with 8 recent sessions)
    expect(scores[0]).toBeGreaterThan(0)

    // Clean up seeded study sessions
    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum score updates reactively after study-log-updated event', async ({
    page,
    indexedDB,
  }) => {
    await seedSidebar(page)

    // Navigate to create DB, then seed one session
    await goToCourses(page)

    const now = Date.now()
    await seedStudySessions(page, [
      {
        id: 'test-reactive-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now - 10 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        duration: 600,
        idleTime: 0,
        videosWatched: [],
        lastActivity: new Date(now - 10 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        sessionType: 'video',
      },
    ])

    // Reload to pick up initial session
    await goToCourses(page)
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Capture initial score
    const initialLabel = await page.getByTestId('momentum-badge').first().getAttribute('aria-label')
    const initialMatch = initialLabel?.match(/\((\d+)\)$/)
    const initialScore = initialMatch ? Number(initialMatch[1]) : 0

    // Seed a very recent session directly into IndexedDB (simulating endSession persistence)
    await seedStudySessions(page, [
      {
        id: 'test-reactive-1',
        courseId: 'nci-access',
        contentItemId: 'lesson-1',
        startTime: new Date(now).toISOString(),
        endTime: new Date(now + 30 * 60 * 1000).toISOString(),
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-1'],
        lastActivity: new Date(now + 30 * 60 * 1000).toISOString(),
        sessionType: 'video',
      },
    ])

    // Dispatch the event that endSession() now fires — no page reload
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('study-log-updated'))
    })

    // Wait for the score to update (Playwright auto-retry)
    await expect(page.getByTestId('momentum-badge').first()).toHaveAttribute(
      'aria-label',
      /Momentum: (Hot|Warm|Cold) \(\d+\)/
    )

    // Verify score increased
    const updatedLabel = await page.getByTestId('momentum-badge').first().getAttribute('aria-label')
    const updatedMatch = updatedLabel?.match(/\((\d+)\)$/)
    const updatedScore = updatedMatch ? Number(updatedMatch[1]) : 0

    expect(updatedScore).toBeGreaterThan(initialScore)

    // Clean up
    await indexedDB.clearStore(STORE_NAME)
  })
})

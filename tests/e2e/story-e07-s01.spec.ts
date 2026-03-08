/**
 * E07-S01: Momentum Score Calculation & Display
 *
 * Tests the momentum badge indicator on course cards and the "Sort by Momentum"
 * option in the courses library.
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'

test.describe('E07-S01: Momentum Score Display', () => {
  test('momentum badges are visible on course cards in the library', async ({ page }) => {
    await goToCourses(page)

    // Badges render when momentumMap is loaded — wait for them
    const badges = page.getByTestId('momentum-badge')
    const count = await badges.count()
    // With no study sessions, all courses get score 0 (cold tier), badges still render
    expect(count).toBeGreaterThan(0)
  })

  test('momentum badge has correct tier label text', async ({ page }) => {
    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    // Label should be one of the three tier labels
    const text = await firstBadge.textContent()
    expect(['Hot', 'Warm', 'Cold'].some(t => text?.includes(t))).toBe(true)
  })

  test('momentum badge has accessible aria-label', async ({ page }) => {
    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const ariaLabel = await firstBadge.getAttribute('aria-label')
    expect(ariaLabel).toMatch(/^Momentum: (Hot|Warm|Cold) \(\d+\)$/)
  })

  test('sort by momentum option is present in courses page', async ({ page }) => {
    await goToCourses(page)

    const sortSelect = page.getByTestId('sort-select')
    await expect(sortSelect).toBeVisible()

    // Check both options exist
    await expect(sortSelect.locator('option[value="recent"]')).toHaveText('Most Recent')
    await expect(sortSelect.locator('option[value="momentum"]')).toHaveText('Sort by Momentum')
  })

  test('selecting sort by momentum reorders the course list', async ({ page, indexedDB }) => {
    // Seed study sessions so two courses have differentiated momentum scores.
    // 'nci-access' gets many recent sessions (high score) while 'authority' gets one old session (low score).
    const now = Date.now()
    const DB_NAME = 'ElearningDB'
    const STORE_NAME = 'studySessions'

    // Navigate first so Dexie creates the DB and stores
    await goToCourses(page)

    // Build study session records
    const highMomentumSessions = Array.from({ length: 8 }, (_, i) => ({
      id: `test-high-${i}`,
      courseId: 'nci-access',
      contentItemId: `lesson-${i}`,
      startTime: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(), // daily for last 8 days
      endTime: new Date(now - i * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      duration: 1800,
      idleTime: 0,
      videosWatched: [`video-${i}`],
      lastActivity: new Date(now - i * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      sessionType: 'video' as const,
    }))

    const lowMomentumSessions = [{
      id: 'test-low-0',
      courseId: 'authority',
      contentItemId: 'lesson-0',
      startTime: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days ago
      endTime: new Date(now - 12 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
      duration: 600,
      idleTime: 0,
      videosWatched: ['video-0'],
      lastActivity: new Date(now - 12 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
      sessionType: 'video' as const,
    }]

    const allSessions = [...highMomentumSessions, ...lowMomentumSessions]

    // Seed study sessions into IndexedDB
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
      { dbName: DB_NAME, storeName: STORE_NAME, data: allSessions }
    )

    // Reload so the Courses page re-reads studySessions from IndexedDB
    await goToCourses(page)

    // Switch to momentum sort
    const sortSelect = page.getByTestId('sort-select')
    await sortSelect.selectOption('momentum')
    await expect(sortSelect).toHaveValue('momentum')

    // Wait for badges to re-render after sort
    const badges = page.getByTestId('momentum-badge')
    await expect(badges.first()).toBeVisible()

    // Extract momentum scores from aria-labels: "Momentum: Hot|Warm|Cold (N)"
    const ariaLabels = await badges.evaluateAll(els =>
      els.map(el => el.getAttribute('aria-label') ?? '')
    )
    const scores = ariaLabels.map(label => {
      const match = label.match(/\((\d+)\)$/)
      return match ? Number(match[1]) : 0
    })

    // There should be at least two scores and they should be in descending order
    expect(scores.length).toBeGreaterThanOrEqual(2)
    const firstScore = scores[0]
    const lastScore = scores[scores.length - 1]
    expect(firstScore).toBeGreaterThan(lastScore)

    // The highest-scored course should be nci-access (seeded with 8 recent sessions)
    expect(firstScore).toBeGreaterThan(0)

    // Clean up seeded study sessions
    await indexedDB.clearStore(STORE_NAME)
  })
})

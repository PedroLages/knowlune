/**
 * Error Path: Corrupted IndexedDB Sessions (Story 7-7)
 *
 * Tests data integrity and error resilience when studySessions
 * contain corrupted or malformed data. The app should:
 * - Gracefully handle invalid session data without crashing
 * - Skip corrupted sessions in momentum calculations
 * - Continue to function with valid sessions
 * - Not break UI rendering or navigation
 *
 * Related: E07-S01 (Momentum Score), E07-S04 (Completion Estimates)
 */
import { test, expect } from '../support/fixtures'
import { goToCourses } from '../support/helpers/navigation'
import { FIXED_DATE, addMinutes } from '../utils/test-time'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
}

// Mock Date.now() to return FIXED_TIMESTAMP for deterministic momentum calculations
async function mockDateNow(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ fixedTimestamp }) => {
      const originalNow = Date.now
      Date.now = () => fixedTimestamp
      // @ts-expect-error - Store original for debugging
      Date._originalNow = originalNow
    },
    { fixedTimestamp: new Date(FIXED_DATE).getTime() }
  )
}

/**
 * Seed corrupted sessions directly into IndexedDB
 * This bypasses factory validation to test error resilience
 */
async function seedCorruptedSessions(page: import('@playwright/test').Page, sessions: unknown[]) {
  await page.evaluate(
    async ({ corruptedSessions }) => {
      const DB_NAME = 'ElearningDB'
      const STORE_NAME = 'studySessions'

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME)

        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)

          // Add each corrupted session
          corruptedSessions.forEach((session: unknown) => {
            store.add(session)
          })

          tx.oncomplete = () => {
            db.close()
            resolve(undefined)
          }

          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }

        request.onerror = () => reject(request.error)
      })
    },
    { corruptedSessions: sessions }
  )
}

const STORE_NAME = 'studySessions'

test.describe('Error Path: Corrupted IndexedDB Sessions', () => {
  test('app loads without crashing when sessions have missing required fields', async ({
    page,
    indexedDB,
  }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed sessions missing required fields
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-missing-fields-1',
        // Missing courseId, contentItemId, startTime, duration, etc.
        sessionType: 'video',
      },
      {
        id: 'corrupt-missing-fields-2',
        courseId: 'nci-access',
        // Missing contentItemId, startTime, duration
        sessionType: 'video',
      },
    ])

    // Reload to trigger data load
    await page.reload()

    // Page should load without error (no crash)
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()

    // Course cards should render (even with corrupted sessions)
    await expect(page.getByTestId('course-card').first()).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })

  test('app handles sessions with invalid data types gracefully', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed sessions with wrong data types
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-invalid-types-1',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: '1800', // String instead of number
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
      {
        id: 'corrupt-invalid-types-2',
        courseId: 123, // Number instead of string
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
    ])

    await page.reload()

    // App should not crash
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })

  test('app handles sessions with malformed timestamps', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed sessions with invalid ISO timestamps
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-bad-timestamp-1',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: 'not-a-valid-date',
        endTime: 'also-invalid',
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: 'bad-timestamp',
        sessionType: 'video',
      },
      {
        id: 'corrupt-bad-timestamp-2',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: '2025-13-99T99:99:99.999Z', // Invalid date components
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: FIXED_DATE,
        sessionType: 'video',
      },
    ])

    await page.reload()

    // App should not crash
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })

  test('app handles sessions with negative or NaN duration values', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed sessions with invalid duration values
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-negative-duration',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: -1800, // Negative duration
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
      {
        id: 'corrupt-nan-duration',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        duration: NaN, // Not a number
        idleTime: 0,
        videosWatched: [],
        lastActivity: FIXED_DATE,
        sessionType: 'video',
      },
      {
        id: 'corrupt-infinity-duration',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        duration: Infinity, // Infinite duration
        idleTime: 0,
        videosWatched: [],
        lastActivity: FIXED_DATE,
        sessionType: 'video',
      },
    ])

    await page.reload()

    // App should not crash
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })

  test('app handles sessions with invalid sessionType values', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed sessions with invalid sessionType
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-invalid-session-type-1',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: FIXED_DATE,
        sessionType: 'invalid-type', // Not 'video' | 'pdf' | 'mixed'
      },
      {
        id: 'corrupt-invalid-session-type-2',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: FIXED_DATE,
        sessionType: null, // null instead of union type
      },
    ])

    await page.reload()

    // App should not crash
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum calculation skips corrupted sessions and uses valid ones', async ({
    page,
    indexedDB,
  }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed a mix of valid and corrupted sessions
    await seedCorruptedSessions(page, [
      // Valid session - should contribute to momentum
      {
        id: 'valid-session',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
      // Corrupted session - should be skipped
      {
        id: 'corrupt-skip-me',
        courseId: 'nci-access',
        // Missing critical fields
        sessionType: 'video',
      },
    ])

    await page.reload()

    // Momentum badge should appear (calculated from valid session)
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Badge should have valid tier text (not error state)
    const badge = page.getByTestId('momentum-badge').first()
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/HOT|WARM|COLD/)

    await indexedDB.clearStore(STORE_NAME)
  })

  test('app navigates correctly even with corrupted session data', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed corrupted sessions
    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-nav-test',
        // Minimal corrupted data
        sessionType: 'video',
      },
    ])

    await page.reload()

    // Navigate to different pages - should all work
    await page.getByRole('link', { name: /overview/i }).click()
    await expect(page).toHaveURL(/\//)
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await page.getByRole('link', { name: /my courses/i }).click()
    await expect(page).toHaveURL(/\/myclass/)
    await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()

    await indexedDB.clearStore(STORE_NAME)
  })
})

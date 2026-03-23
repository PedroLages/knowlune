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
import { test, expect } from '../../support/fixtures'
import { goToCourses } from '../../support/helpers/navigation'
import { FIXED_DATE, addMinutes } from '../../utils/test-time'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const STORE_NAME = 'studySessions'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.addInitScript(sidebarState => {
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
 * Seed corrupted sessions directly into IndexedDB from within the browser context.
 * This bypasses factory validation to test error resilience.
 * NaN/Infinity values must be constructed inside page.evaluate() because
 * Playwright's structured-clone serialization converts them to null.
 */
async function seedCorruptedSessions(
  page: import('@playwright/test').Page,
  sessions: unknown[],
  /** Session IDs that need NaN/Infinity constructed in-browser */
  specialValues?: { id: string; field: string; expr: 'NaN' | 'Infinity' | '-Infinity' }[]
) {
  await page.evaluate(
    async ({ corruptedSessions, specials }) => {
      const DB_NAME = 'ElearningDB'
      const STORE = 'studySessions'

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME)

        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(STORE, 'readwrite')
          const store = tx.objectStore(STORE)

          for (const session of corruptedSessions) {
            store.add(session)
          }

          // Construct NaN/Infinity in-browser (survives IDB but not structured-clone)
          if (specials) {
            for (const { id, field, expr } of specials) {
              const found = corruptedSessions.find((s: Record<string, unknown>) => s.id === id) as
                | Record<string, unknown>
                | undefined
              if (found) {
                const clone = { ...found }
                if (expr === 'NaN') clone[field] = Number('not-a-number')
                else if (expr === 'Infinity') clone[field] = 1 / 0
                else if (expr === '-Infinity') clone[field] = -1 / 0
                // Delete the placeholder and re-add with real value
                const delReq = store.delete(id)
                delReq.onsuccess = () => store.add(clone)
              }
            }
          }

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
    { corruptedSessions: sessions, specials: specialValues }
  )
}

/** Assert momentum badges show "Cold" for courses with only corrupted sessions */
async function expectColdBadges(page: import('@playwright/test').Page) {
  const badges = page.getByTestId('momentum-badge')
  const count = await badges.count()
  for (let i = 0; i < count; i++) {
    const text = await badges.nth(i).textContent()
    expect(text?.toLowerCase()).toContain('cold')
  }
}

test.describe('Error Path: Corrupted IndexedDB Sessions', () => {
  // Collect console.error calls — AC1 requires no console errors
  let consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
  })

  test.afterEach(async ({ indexedDB }) => {
    await indexedDB.clearStore(STORE_NAME)
  })

  test('app loads without crashing when sessions have missing required fields', async ({
    page,
  }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-missing-fields-1',
        sessionType: 'video',
      },
      {
        id: 'corrupt-missing-fields-2',
        courseId: 'nci-access',
        sessionType: 'video',
      },
    ])

    await page.reload()

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
    await expect(page.locator('[data-testid^="course-card-"]').first()).toBeVisible()
    await expectColdBadges(page)

    // AC1: no console errors from corrupted data
    const courseErrors = consoleErrors.filter(e => e.includes('[Courses]'))
    expect(courseErrors).toHaveLength(0)
  })

  test('app handles sessions with invalid data types gracefully', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

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

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
    await expectColdBadges(page)
  })

  test('app handles sessions with malformed timestamps', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

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

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
    await expectColdBadges(page)
  })

  test('app handles sessions with negative, NaN, and Infinity duration values', async ({
    page,
  }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed with placeholder durations — NaN/Infinity are constructed in-browser
    // because Playwright's structured-clone serializes them as null
    await seedCorruptedSessions(
      page,
      [
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
          duration: 0, // Placeholder — replaced with NaN in-browser
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
          duration: 0, // Placeholder — replaced with Infinity in-browser
          idleTime: 0,
          videosWatched: [],
          lastActivity: FIXED_DATE,
          sessionType: 'video',
        },
      ],
      [
        { id: 'corrupt-nan-duration', field: 'duration', expr: 'NaN' },
        { id: 'corrupt-infinity-duration', field: 'duration', expr: 'Infinity' },
      ]
    )

    await page.reload()

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
    await expectColdBadges(page)
  })

  test('app handles sessions with invalid sessionType values', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

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
        sessionType: 'invalid-type',
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
        sessionType: null,
      },
    ])

    await page.reload()

    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
  })

  test('momentum calculation skips corrupted sessions and uses valid ones', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed a mix: valid session for nci-access + corrupted session for same course
    await seedCorruptedSessions(page, [
      // Valid session — startTime = FIXED_DATE, recency 0 days = score ~100
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
      // Corrupted session — should be skipped
      {
        id: 'corrupt-skip-me',
        courseId: 'nci-access',
        sessionType: 'video',
      },
    ])

    await page.reload()

    // Momentum badge should appear (calculated from valid session only)
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // With recency 0 days and 1 session in 30 days, the valid session should
    // produce a non-cold tier. Assert specifically NOT cold to prove the valid
    // session contributed (all-corrupted would yield cold).
    const badge = page.getByTestId('momentum-badge').first()
    const badgeText = await badge.textContent()
    expect(badgeText?.toLowerCase()).not.toContain('cold')
  })

  test('app navigates correctly even with corrupted session data', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    await seedCorruptedSessions(page, [
      {
        id: 'corrupt-nav-test',
        sessionType: 'video',
      },
    ])

    await page.reload()

    // Navigate to different pages — should all work
    await page.getByRole('link', { name: /overview/i }).click()
    await expect(page).toHaveURL(/\//)
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await page.getByRole('link', { name: /my courses/i }).click()
    await expect(page).toHaveURL(/\/my-class/)
    await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()

    // Navigate back to Courses — re-triggers loadCourseMetrics with corrupted data
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await expect(page).toHaveURL(/\/courses/)
    await expect(page.getByRole('heading', { name: 'All Courses', level: 1 })).toBeVisible()
    await expect(page.locator('[data-testid^="course-card-"]').first()).toBeVisible()
  })
})

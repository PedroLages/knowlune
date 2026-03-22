/**
 * E2E tests for Story E04-S03: Automatic Study Session Logging - History & Reporting
 *
 * Acceptance criteria:
 *   AC4: Display aggregate total study time across courses
 *   AC5: Detect and close orphaned sessions on app load
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../../support/helpers/navigation'
import { seedStudySessions, seedImportedVideos } from '../../support/helpers/seed-helpers'
import type { Page } from '@playwright/test'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'course-study-tracking',
  name: 'Study Tracking Test Course',
  videoCount: 2,
  pdfCount: 0,
})

interface ImportedVideoTestData {
  id: string
  courseId: string
  filename: string
  order: number
  duration?: number
}

const TEST_VIDEOS: ImportedVideoTestData[] = [
  {
    id: 'video-lesson-1',
    courseId: 'course-study-tracking',
    filename: '01-Introduction.mp4',
    order: 0,
    duration: 300,
  },
  {
    id: 'video-lesson-2',
    courseId: 'course-study-tracking',
    filename: '02-Advanced.mp4',
    order: 1,
    duration: 600,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to Courses page, seed course + videos, reload. */
async function seedCourseAndReload(
  page: Page,
  indexedDB: {
    seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  }
) {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Story E04-S03: Study Session History & Reporting', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Seed localStorage to prevent sidebar overlay
    await page.goto('/')
    await localStorage.seed({ 'knowlune-sidebar-v1': 'false' })
    await page.reload()
  })

  test('AC4: displays aggregate total study time across all courses', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN multiple study sessions have been logged
    await seedCourseAndReload(page, indexedDB)

    // Seed study sessions into IndexedDB
    const sessions = [
      {
        id: 'session-1',
        courseId: 'course-study-tracking',
        contentItemId: 'video-lesson-1',
        startTime: getRelativeDate(-0.0833), // 2 hours ago
        endTime: getRelativeDate(-0.0417), // 1 hour ago
        duration: 3600, // 1 hour in seconds
        idleTime: 0,
        videosWatched: ['video-lesson-1'],
        lastActivity: getRelativeDate(-0.0417),
        sessionType: 'video',
      },
      {
        id: 'session-2',
        courseId: 'course-study-tracking',
        contentItemId: 'video-lesson-2',
        startTime: getRelativeDate(-0.0208), // 30 min ago
        endTime: FIXED_DATE,
        duration: 1800, // 30 min in seconds
        idleTime: 0,
        videosWatched: ['video-lesson-2'],
        lastActivity: FIXED_DATE,
        sessionType: 'video',
      },
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // WHEN the user views their total study time (Overview page)
    await navigateAndWait(page, '/')

    // THEN aggregate total is calculated correctly
    const totalStudyTime = await page.evaluate(async () => {
      const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
      const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('studySessions')) {
          db.close()
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
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const sessions = await new Promise<SessionRecord[]>((resolve, reject) => {
          const req = tx.objectStore('studySessions').getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (sessions.length > 0) {
          return sessions.reduce((total, s) => total + (s.duration || 0), 0)
        }
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
      return 0
    })

    expect(totalStudyTime).toBe(3600 + 1800) // 1.5 hours in seconds

    // AND the UI displays the total study time correctly
    const totalStudyTimeDisplay = await page.getByTestId('total-study-time')
    await expect(totalStudyTimeDisplay).toBeVisible()
    await expect(totalStudyTimeDisplay).toHaveText('1.5h') // 5400 seconds = 1.5 hours
  })

  test('AC5: detects and closes orphaned sessions on app load', async ({ page, indexedDB }) => {
    // GIVEN orphaned session records exist
    await seedCourseAndReload(page, indexedDB)

    const orphanedSession = {
      id: 'orphaned-session-1',
      courseId: 'course-study-tracking',
      contentItemId: 'video-lesson-1',
      startTime: getRelativeDate(-1), // 24 hours ago
      endTime: undefined,
      duration: 0,
      idleTime: 0,
      videosWatched: [],
      lastActivity: getRelativeDate(-0.9931), // ~23h50m ago (86000000ms / 86400000ms per day)
      sessionType: 'video',
    }

    await seedStudySessions(page, [orphanedSession])

    // WHEN the application loads
    await page.reload()

    // THEN orphaned sessions are closed with last activity timestamp
    const orphanedSessionClosed = await page.evaluate(async () => {
      const maxRetries = 10 // RETRY_CONFIG.MAX_ATTEMPTS
      const retryDelay = 200 // RETRY_CONFIG.POLL_INTERVAL

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('studySessions')) {
          db.close()
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
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const session = await new Promise<SessionRecord | undefined>((resolve, reject) => {
          const req = tx.objectStore('studySessions').get('orphaned-session-1')
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (!session) {
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
          continue
        }

        if (session.endTime !== null && session.endTime !== undefined) {
          return true
        }

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
      return false
    })

    expect(orphanedSessionClosed).toBe(true)
  })
})

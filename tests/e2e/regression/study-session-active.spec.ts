/**
 * E2E tests for Story E04-S03: Automatic Study Session Logging - Active Sessions
 *
 * Acceptance criteria:
 *   AC1: Create session on content mount with course/content metadata
 *   AC2: Record session end on navigation/visibility change
 *   AC3: Auto-pause after 5min idle, resume on activity
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../../support/helpers/navigation'
import { RETRY_CONFIG } from '../../utils/constants'
import type { Page } from '@playwright/test'

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

const DB_NAME = 'ElearningDB'

/** Seed imported videos into IndexedDB with retry logic for Dexie initialization. */
async function seedImportedVideos(page: Page, videos: ImportedVideoTestData[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open(dbName)
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('importedVideos')) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction('importedVideos', 'readwrite')
            const store = tx.objectStore('importedVideos')
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
        // Store not yet created by Dexie — wait and retry
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
      throw new Error(`Store "importedVideos" not found in "${dbName}" after ${maxRetries} retries`)
    },
    {
      dbName: DB_NAME,
      data: videos,
      maxRetries: RETRY_CONFIG.MAX_ATTEMPTS,
      retryDelay: RETRY_CONFIG.POLL_INTERVAL,
    }
  )
}

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

/** Navigate to imported lesson player. */
async function goToLessonPlayer(page: Page, courseId: string, lessonId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}/lessons/${lessonId}`)
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Story E04-S03: Active Study Session Logging', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Seed localStorage to prevent sidebar overlay
    await page.goto('/')
    await localStorage.seed({ 'knowlune-sidebar-v1': 'false' })
    await page.reload()
  })

  test('AC1: creates session record when user enters lesson player', async ({
    page,
    indexedDB,
  }) => {
    // GIVEN a user has imported courses available
    await seedCourseAndReload(page, indexedDB)

    // WHEN the user navigates to the lesson player
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // THEN a new study session record is created with metadata
    // Wait with retry for database to be ready
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const sessionExists = await page.evaluate(async () => {
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
        const store = tx.objectStore('studySessions')
        const countReq = store.count()

        const count = await new Promise<number>((resolve, reject) => {
          countReq.onsuccess = () => resolve(countReq.result)
          countReq.onerror = () => reject(countReq.error)
        })

        db.close()
        if (count > 0) return true
        // Session might not be created yet - retry
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

    expect(sessionExists).toBe(true)

    // AND session has required fields
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const session = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const store = tx.objectStore('studySessions')
      const getAllReq = store.getAll()

      const sessions = await new Promise<SessionRecord[]>((resolve, reject) => {
        getAllReq.onsuccess = () => resolve(getAllReq.result)
        getAllReq.onerror = () => reject(getAllReq.error)
      })

      db.close()
      return sessions[0]
    })

    expect(session).toBeDefined()
    expect(session).toHaveProperty('startTime')
    expect(session).toHaveProperty('courseId')
    expect(session).toHaveProperty('contentItemId')
    expect(session.courseId).toBe('course-study-tracking')
    expect(session.contentItemId).toBe('video-lesson-1')
  })

  test('AC2: records session end timestamp on navigation away', async ({ page, indexedDB }) => {
    // GIVEN an active study session is in progress
    await seedCourseAndReload(page, indexedDB)
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // WHEN the user navigates away
    await navigateAndWait(page, '/courses')

    // THEN session end timestamp is recorded (wait with retry for async persistence)
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const sessionHasEndTime = await page.evaluate(async () => {
      const maxRetries = 20 // Longer wait for async endSession
      const retryDelay = 200

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

        if (sessions.length === 0) {
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

        const lastSession = sessions[sessions.length - 1]
        if (lastSession.endTime !== undefined && lastSession.endTime !== null) {
          return true
        }

        // endTime not set yet - retry
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

    expect(sessionHasEndTime).toBe(true)

    // AND duration is calculated
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const sessionHasDuration = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const sessions = await new Promise<SessionRecord[]>((resolve, reject) => {
        const req = tx.objectStore('studySessions').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      db.close()
      const lastSession = sessions[sessions.length - 1]
      return typeof lastSession.duration === 'number' && lastSession.duration >= 0
    })

    expect(sessionHasDuration).toBe(true)
  })

  test('AC3: auto-pauses session after 5 minutes of inactivity', async ({ page, indexedDB }) => {
    // Install clock BEFORE page loads (so React timers are mocked)
    const startTime = performance.now()
    await page.clock.install({ time: startTime })

    // GIVEN an active study session is in progress
    await seedCourseAndReload(page, indexedDB)
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // Use real timeout for page load, then fast-forward for idle detection
    await page.clock.runFor(500)

    // WHEN the user is idle for more than 5 minutes
    await page.clock.fastForward(5 * 60 * 1000 + 1000) // 5 minutes 1 second in milliseconds

    // Wait for idle detection to trigger pauseSession (using clock time)
    await page.clock.runFor(2000)

    // THEN idle time should be recorded in the session
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const idleTimeRecorded = await page.evaluate(async () => {
      const maxRetries = 20
      const retryDelay = 200

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

        if (sessions.length === 0) {
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

        const session = sessions[sessions.length - 1]
        // Verify idleTime >= 300 seconds (5 minutes) and is persisted
        if (session.idleTime !== undefined && session.idleTime >= 300) {
          return {
            success: true,
            idleTime: session.idleTime,
            duration: session.duration,
          }
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
      return { success: false, idleTime: 0, duration: 0 }
    })

    expect(idleTimeRecorded.success).toBe(true)
    expect(idleTimeRecorded.idleTime).toBeGreaterThanOrEqual(300) // 5 minutes

    // Simulate activity to resume
    await page.mouse.move(100, 100)

    // AND session resumes correctly (still exists, endTime is undefined = still active)
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    const sessionResumed = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const sessions = await new Promise<SessionRecord[]>((resolve, reject) => {
        const req = tx.objectStore('studySessions').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      db.close()

      if (sessions.length === 0) return { exists: false, isActive: false }

      const session = sessions[sessions.length - 1]
      return {
        exists: true,
        isActive: session.endTime === undefined, // Active if no endTime
        hasIdleTime: session.idleTime >= 300,
      }
    })

    expect(sessionResumed.exists).toBe(true)
    expect(sessionResumed.isActive).toBe(true) // Session should still be active after resume
    expect(sessionResumed.hasIdleTime).toBe(true) // Idle time should be preserved
  })
})

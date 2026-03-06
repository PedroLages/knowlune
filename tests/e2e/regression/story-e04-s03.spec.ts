/**
 * E2E tests for Story E04-S03: Automatic Study Session Logging
 *
 * Acceptance criteria:
 *   AC1: Create session on content mount with course/content metadata
 *   AC2: Record session end on navigation/visibility change
 *   AC3: Auto-pause after 5min idle, resume on activity
 *   AC4: Display aggregate total study time across courses
 *   AC5: Detect and close orphaned sessions on app load
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../support/helpers/navigation'
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
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "importedVideos" not found in "${dbName}" after ${maxRetries} retries`)
    },
    { dbName: DB_NAME, data: videos, maxRetries: 10, retryDelay: 200 }
  )
}

/** Seed study sessions into IndexedDB with retry logic for Dexie initialization. */
async function seedStudySessions(page: Page, sessions: any[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open(dbName)
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('studySessions')) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction('studySessions', 'readwrite')
            const store = tx.objectStore('studySessions')
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
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "studySessions" not found in "${dbName}" after ${maxRetries} retries`)
    },
    { dbName: DB_NAME, data: sessions, maxRetries: 10, retryDelay: 200 }
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
  await navigateAndWait(page, `/imported-courses/${courseId}/lessons/${lessonId}`)
}

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Story E04-S03: Automatic Study Session Logging', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Seed localStorage to prevent sidebar overlay
    await page.goto('/')
    await localStorage.seed({ 'eduvi-sidebar-v1': 'false' })
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
    const sessionExists = await page.evaluate(async () => {
      const maxRetries = 10
      const retryDelay = 200

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('studySessions')) {
          db.close()
          await new Promise(r => setTimeout(r, retryDelay))
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
        await new Promise(r => setTimeout(r, retryDelay))
      }
      return false
    })

    expect(sessionExists).toBe(true)

    // AND session has required fields
    const session = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const store = tx.objectStore('studySessions')
      const getAllReq = store.getAll()

      const sessions = await new Promise<any[]>((resolve, reject) => {
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
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const sessions = await new Promise<any[]>((resolve, reject) => {
          const req = tx.objectStore('studySessions').getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (sessions.length === 0) {
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        const lastSession = sessions[sessions.length - 1]
        if (lastSession.endTime !== undefined && lastSession.endTime !== null) {
          return true
        }

        // endTime not set yet - retry
        await new Promise(r => setTimeout(r, retryDelay))
      }
      return false
    })

    expect(sessionHasEndTime).toBe(true)

    // AND duration is calculated
    const sessionHasDuration = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const sessions = await new Promise<any[]>((resolve, reject) => {
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
    const startTime = Date.now()
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
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const sessions = await new Promise<any[]>((resolve, reject) => {
          const req = tx.objectStore('studySessions').getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (sessions.length === 0) {
          await new Promise(r => setTimeout(r, retryDelay))
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

        await new Promise(r => setTimeout(r, retryDelay))
      }
      return { success: false, idleTime: 0, duration: 0 }
    })

    expect(idleTimeRecorded.success).toBe(true)
    expect(idleTimeRecorded.idleTime).toBeGreaterThanOrEqual(300) // 5 minutes

    // Simulate activity to resume
    await page.mouse.move(100, 100)

    // AND session resumes correctly (still exists, endTime is undefined = still active)
    const sessionResumed = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const tx = db.transaction('studySessions', 'readonly')
      const sessions = await new Promise<any[]>((resolve, reject) => {
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
        startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        endTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        duration: 3600, // 1 hour in seconds
        idleTime: 0,
        videosWatched: ['video-lesson-1'],
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
        sessionType: 'video',
      },
      {
        id: 'session-2',
        courseId: 'course-study-tracking',
        contentItemId: 'video-lesson-2',
        startTime: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
        endTime: new Date().toISOString(),
        duration: 1800, // 30 min in seconds
        idleTime: 0,
        videosWatched: ['video-lesson-2'],
        lastActivity: new Date().toISOString(),
        sessionType: 'video',
      },
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // WHEN the user views their total study time (Overview page)
    await navigateAndWait(page, '/')

    // THEN aggregate total is calculated correctly
    const totalStudyTime = await page.evaluate(async () => {
      const maxRetries = 10
      const retryDelay = 200

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('studySessions')) {
          db.close()
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const sessions = await new Promise<any[]>((resolve, reject) => {
          const req = tx.objectStore('studySessions').getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (sessions.length > 0) {
          return sessions.reduce((total, s) => total + (s.duration || 0), 0)
        }
        await new Promise(r => setTimeout(r, retryDelay))
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
      startTime: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
      endTime: undefined,
      duration: 0,
      idleTime: 0,
      videosWatched: [],
      lastActivity: new Date(Date.now() - 86000000).toISOString(), // ~23h50m ago
      sessionType: 'video',
    }

    await seedStudySessions(page, [orphanedSession])

    // WHEN the application loads
    await page.reload()

    // THEN orphaned sessions are closed with last activity timestamp
    const orphanedSessionClosed = await page.evaluate(async () => {
      const maxRetries = 10
      const retryDelay = 200

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('studySessions')) {
          db.close()
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        const tx = db.transaction('studySessions', 'readonly')
        const session = await new Promise<any>((resolve, reject) => {
          const req = tx.objectStore('studySessions').get('orphaned-session-1')
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })

        db.close()

        if (!session) {
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }

        if (session.endTime !== null && session.endTime !== undefined) {
          return true
        }

        await new Promise(r => setTimeout(r, retryDelay))
      }
      return false
    })

    expect(orphanedSessionClosed).toBe(true)
  })
})

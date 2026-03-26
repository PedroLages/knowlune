/**
 * Shared helpers for study session E2E tests
 */
import type { Page } from '@playwright/test'
import type { StudySession } from '@/data/types'
import { createImportedCourse } from '../fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from './navigation'
import { RETRY_CONFIG } from '../../utils/constants'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

export const TEST_COURSE = createImportedCourse({
  id: 'course-study-tracking',
  name: 'Study Tracking Test Course',
  videoCount: 2,
  pdfCount: 0,
})

export interface ImportedVideoTestData {
  id: string
  courseId: string
  filename: string
  order: number
  duration?: number
}

export const TEST_VIDEOS: ImportedVideoTestData[] = [
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
// IndexedDB Helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'ElearningDB'

/** Seed imported videos into IndexedDB with retry logic for Dexie initialization. */
export async function seedImportedVideos(
  page: Page,
  videos: ImportedVideoTestData[]
): Promise<void> {
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
export async function seedCourseAndReload(
  page: Page,
  indexedDB: {
    seedImportedCourses: (courses: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  }
): Promise<void> {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

/** Navigate to imported lesson player. */
export async function goToLessonPlayer(
  page: Page,
  courseId: string,
  lessonId: string
): Promise<void> {
  await navigateAndWait(page, `/imported-courses/${courseId}/lessons/${lessonId}`)
}

// ---------------------------------------------------------------------------
// Session Verification Helpers
// ---------------------------------------------------------------------------

export interface StudySession {
  id?: string
  startTime: number
  endTime?: number
  duration?: number
  idleTime?: number
  courseId: string
  contentItemId: string
}

/**
 * Wait for a study session to exist in IndexedDB with retry logic.
 * Returns true if session found within timeout.
 */
export async function waitForSessionExists(
  page: Page,
  maxRetries = 10,
  retryDelay = 200
): Promise<boolean> {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
  return await page.evaluate(
    async ({ maxRetries, retryDelay }) => {
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
    },
    { maxRetries, retryDelay }
  )
}

/**
 * Get the latest study session from IndexedDB.
 */
export async function getLatestSession(page: Page): Promise<StudySession | null> {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
  return await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const tx = db.transaction('studySessions', 'readonly')
    const store = tx.objectStore('studySessions')
    const getAllReq = store.getAll()

    const sessions = await new Promise<StudySession[]>((resolve, reject) => {
      getAllReq.onsuccess = () => resolve(getAllReq.result)
      getAllReq.onerror = () => reject(getAllReq.error)
    })

    db.close()
    return sessions.length > 0 ? sessions[sessions.length - 1] : null
  })
}

/**
 * Wait for session endTime to be recorded with retry logic.
 */
export async function waitForSessionEnd(
  page: Page,
  maxRetries = 20,
  retryDelay = 200
): Promise<boolean> {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
  return await page.evaluate(
    async ({ maxRetries, retryDelay }) => {
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
        const sessions = await new Promise<StudySession[]>((resolve, reject) => {
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
    },
    { maxRetries, retryDelay }
  )
}

/**
 * Wait for idle time to be recorded in session with retry logic.
 * Returns session data with success status.
 */
export async function waitForIdleTimeRecorded(
  page: Page,
  minIdleSeconds = 300,
  maxRetries = 20,
  retryDelay = 200
): Promise<{ success: boolean; idleTime: number; duration: number }> {
  // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
  return await page.evaluate(
    async ({ minIdleSeconds, maxRetries, retryDelay }) => {
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
        const sessions = await new Promise<StudySession[]>((resolve, reject) => {
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
        if (session.idleTime !== undefined && session.idleTime >= minIdleSeconds) {
          return {
            success: true,
            idleTime: session.idleTime,
            duration: session.duration || 0,
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
    },
    { minIdleSeconds, maxRetries, retryDelay }
  )
}
